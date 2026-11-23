import { sql, init } from './_db.js'
import { verify } from './_auth.js'

const colQ = cols => [sql`DELETE FROM so_columns`, ...(cols.length ? [sql`INSERT INTO so_columns(pos,buyer,so)
  SELECT * FROM unnest(${cols.map((_, i) => i)}::int[], ${cols.map(c => c.buyer || '')}::text[], ${cols.map(c => c.so || '')}::text[])`] : [])]
const insRes = r => sql`INSERT INTO reservasi(so,kode,deskripsi,qty,uom) SELECT * FROM unnest(
  ${r.map(x => String(x.so))}::text[], ${r.map(x => x.kode)}::text[], ${r.map(x => x.desk || '')}::text[], ${r.map(x => x.qty)}::numeric[], ${r.map(x => x.uom || '')}::text[])`
const stats = async () => {
  const [s] = await sql`SELECT count(DISTINCT so)::int AS so_count, count(*)::int AS row_count FROM reservasi`
  return { soCount: s.so_count, rowCount: s.row_count }
}

export default async function handler(req, res) {
  try {
    if (!verify(req)) return res.status(401).json({ error: 'Sesi habis, silakan masuk lagi' })
    if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL belum diatur di server' })
    await init()
    if (req.method === 'GET') {
      const q = req.query || {}
      // Lazy load: hanya ambil baris RESERVASI untuk SO yang diminta
      if (q.so) {
        const list = String(q.so).split(',').map(s => s.trim()).filter(Boolean).slice(0, 1000)
        const rows = await sql`SELECT so, kode, deskripsi AS desk, qty, uom FROM reservasi WHERE so = ANY(${list}::text[])`
        return res.json({ rows: rows.map(x => ({ ...x, qty: Number(x.qty) })) })
      }
      if (q.stats) return res.json({ stats: await stats() })
      // Cari No. SO yang cocok (untuk kolom cari di Monitoring)
      if (q.sofind) {
        const s = String(q.sofind).replace(/[^0-9A-Za-z-]/g, '').slice(0, 30)
        const rows = s ? await sql`SELECT DISTINCT so FROM reservasi WHERE so LIKE ${'%' + s + '%'} ORDER BY so LIMIT 50` : []
        return res.json({ sos: rows.map(r => r.so) })
      }
      // Tabel RESERVASI lengkap, dipaging dari database
      if (q.res) {
        const s = String(q.q || '').trim().slice(0, 60), like = '%' + s + '%'
        const size = Math.min(Math.max(Number(q.size) || 100, 10), 500), off = Math.max(Number(q.page) || 0, 0) * size
        const [rows, [c]] = await Promise.all([
          sql`SELECT so, kode, deskripsi AS desk, qty, uom FROM reservasi WHERE ${s} = '' OR so ILIKE ${like} OR kode ILIKE ${like} OR deskripsi ILIKE ${like} ORDER BY so, kode LIMIT ${size} OFFSET ${off}`,
          sql`SELECT count(*)::int AS n FROM reservasi WHERE ${s} = '' OR so ILIKE ${like} OR kode ILIKE ${like} OR deskripsi ILIKE ${like}`])
        return res.json({ rows: rows.map(x => ({ ...x, qty: Number(x.qty) })), total: c.n })
      }
      const [m, c, p, s] = await Promise.all([
        sql`SELECT kode, deskripsi AS desk, uom, stok FROM materials ORDER BY kode`,
        sql`SELECT buyer, so FROM so_columns ORDER BY pos`,
        sql`SELECT kode, po1, po2, po3 FROM plan`, stats()])
      return res.json({
        materials: m.map(x => ({ ...x, stok: Number(x.stok) })), columns: c, stats: s,
        plan: Object.fromEntries(p.map(x => [x.kode, { po1: x.po1 || '', po2: x.po2 || '', po3: x.po3 || '' }]))
      })
    }
    if (req.method !== 'POST') return res.status(405).end()
    const b = req.body || {}, q = []
    if (b.action === 'upload') {   // daftar material/stok + kolom SO awal
      if (b.materials) {
        const m = [...new Map(b.materials.map(x => [x.kode, x])).values()]
        q.push(sql`DELETE FROM materials WHERE kode <> ALL(${m.map(x => x.kode)}::text[])`)
        if (m.length) q.push(sql`INSERT INTO materials(kode,deskripsi,uom,stok) SELECT * FROM unnest(
          ${m.map(x => x.kode)}::text[], ${m.map(x => x.desk || '')}::text[], ${m.map(x => x.uom || '')}::text[], ${m.map(x => x.stok)}::numeric[])
          ON CONFLICT (kode) DO UPDATE SET deskripsi=EXCLUDED.deskripsi, uom=EXCLUDED.uom, stok=EXCLUDED.stok`)
      }
      if (b.columns) q.push(...colQ(b.columns))
    } else if (b.action === 'reservasi') {   // dikirim per potongan (chunk); potongan pertama menghapus data lama
      if (b.first) q.push(b.mode === 'replace' ? sql`DELETE FROM reservasi` : sql`DELETE FROM reservasi WHERE so = ANY(${(b.soList || []).map(String)}::text[])`)
      if ((b.rows || []).length) q.push(insRes(b.rows))
    } else if (b.action === 'batch') {   // semua perubahan (stok, PO, kolom SO) dalam satu transaksi
      const st = b.stok || [], pl = b.plan || []
      // Cek bentrok: data di database harus masih sama dengan data awal yang dilihat pengguna (kecuali force)
      if (!b.force) {
        const bad = [], P = r => ({ po1: r?.po1 || '', po2: r?.po2 || '', po3: r?.po3 || '' })
        if (st.length) {
          const cur = new Map((await sql`SELECT kode, stok FROM materials WHERE kode = ANY(${st.map(x => x.kode)}::text[])`).map(r => [r.kode, Number(r.stok)]))
          st.forEach(x => { if (cur.has(x.kode) && cur.get(x.kode) !== Number(x.old)) bad.push(`Stok ${x.kode}: di database sekarang ${cur.get(x.kode)} (kamu mulai dari ${x.old})`) })
        }
        if (pl.length) {
          const cur = new Map((await sql`SELECT kode, po1, po2, po3 FROM plan WHERE kode = ANY(${pl.map(x => x.kode)}::text[])`).map(r => [r.kode, P(r)]))
          pl.forEach(x => { if (JSON.stringify(cur.get(x.kode) || P()) !== JSON.stringify(P(x.old))) bad.push(`Rencana PO ${x.kode} sudah diubah pengguna lain`) })
        }
        if (b.columns) {
          const key = a => JSON.stringify((a || []).map(c => [c.buyer || '', c.so || '']))
          if (key(await sql`SELECT buyer, so FROM so_columns ORDER BY pos`) !== key(b.oldColumns)) bad.push('Kolom SO / buyer sudah diubah pengguna lain')
        }
        if (bad.length) return res.status(409).json({ error: 'Data sudah diubah oleh pengguna lain', conflicts: bad })
      }
      if (st.length) q.push(sql`UPDATE materials m SET stok = v.stok FROM (SELECT * FROM unnest(${st.map(x => x.kode)}::text[], ${st.map(x => Number(x.stok) || 0)}::numeric[]) AS t(kode, stok)) v WHERE m.kode = v.kode`)
      if (pl.length) q.push(sql`INSERT INTO plan(kode,po1,po2,po3) SELECT * FROM unnest(${pl.map(x => x.kode)}::text[], ${pl.map(x => x.po1 || '')}::text[], ${pl.map(x => x.po2 || '')}::text[], ${pl.map(x => x.po3 || '')}::text[])
        ON CONFLICT (kode) DO UPDATE SET po1=EXCLUDED.po1, po2=EXCLUDED.po2, po3=EXCLUDED.po3`)
      if (b.columns) q.push(...colQ(b.columns))
    } else if (b.action === 'columns') q.push(...colQ(b.columns || []))
    else if (b.action === 'stok') q.push(sql`UPDATE materials SET stok=${Number(b.stok) || 0} WHERE kode=${b.kode}`)
    else if (b.action === 'plan') q.push(sql`INSERT INTO plan(kode,po1,po2,po3) VALUES(${b.kode},${b.po1 || ''},${b.po2 || ''},${b.po3 || ''})
      ON CONFLICT (kode) DO UPDATE SET po1=EXCLUDED.po1, po2=EXCLUDED.po2, po3=EXCLUDED.po3`)
    else if (b.action === 'reset') q.push(sql`DELETE FROM reservasi`, sql`DELETE FROM materials`, sql`DELETE FROM so_columns`, sql`DELETE FROM plan`)
    else return res.status(400).json({ error: 'Aksi tidak dikenal' })
    if (q.length) await sql.transaction(q)
    res.json({ ok: true })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Database error: ' + e.message }) }
}
