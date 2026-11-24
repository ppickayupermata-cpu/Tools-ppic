import { useEffect, useMemo, useRef, useState } from 'react'
const TK = 'ppic-token', UK = 'ppic-user', CK = 'ppic-cache-v3'
export const getSession = () => { try { return sessionStorage.getItem(TK) ? JSON.parse(sessionStorage.getItem(UK)) : null } catch { return null } }
export const logout = () => { [TK, UK, CK].forEach(k => sessionStorage.removeItem(k)) }

// Semua request punya batas waktu supaya tombol/antrian tidak "macet" selamanya kalau server tidak merespons
async function call(path, opt = {}, ms = 30000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms)
  try {
    const r = await fetch(path, { ...opt, signal: ac.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.getItem(TK) } })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw Object.assign(new Error(j.error || 'Gagal (' + r.status + ')'), { status: r.status, data: j })
    return j
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Server tidak merespons (timeout). Pastikan server berjalan dan koneksi internet stabil.')
    throw e
  } finally { clearTimeout(t) }
}
export const api = call
export async function login(u, p) {
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ u, p }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `API login tidak ditemukan (status ${r.status}). Jalankan dengan "npm run dev" atau "npx vercel dev".`)
  sessionStorage.setItem(TK, j.token); sessionStorage.setItem(UK, JSON.stringify(j.user)); return j.user
}

const empty = { materials: [], columns: [], plan: {}, stats: { soCount: 0, rowCount: 0 }, reservasi: [], soInfo: {}, saved: { stok: {}, plan: {}, columns: [] } }
const readCache = () => { try { return JSON.parse(sessionStorage.getItem(CK)) } catch { return null } }
const mark = (list, state, n = {}) => Object.fromEntries(list.map(s => [s, { state, n: n[s] || 0 }]))
const clone = o => JSON.parse(JSON.stringify(o))
const snap = x => ({ stok: Object.fromEntries(x.materials.map(m => [m.kode, m.stok])), plan: clone(x.plan), columns: clone(x.columns) })
const P0 = { po1: '', po2: '', po3: '' }

// Perubahan yang belum disubmit = selisih data di layar vs data yang terakhir tersimpan di database
export function diff(d) {
  const sv = d.saved || empty.saved, stok = [], plan = [], errors = [], warnings = []
  d.materials.forEach(m => { if (m.kode in sv.stok && sv.stok[m.kode] !== m.stok) stok.push({ kode: m.kode, desk: m.desk, stok: m.stok, old: sv.stok[m.kode] }) })
  for (const k of new Set([...Object.keys(d.plan), ...Object.keys(sv.plan)])) {
    const a = { ...P0, ...d.plan[k] }, b = { ...P0, ...sv.plan[k] }
    if (JSON.stringify(a) !== JSON.stringify(b)) plan.push({ kode: k, ...a, old: b })
  }
  const colsChanged = JSON.stringify(d.columns) !== JSON.stringify(sv.columns)
  // validasi: errors memblokir Submit, warnings hanya peringatan
  const sos = d.columns.map(c => String(c.so).trim()).filter(Boolean)
  ;[...new Set(sos.filter((s, i) => sos.indexOf(s) !== i))].forEach(s => warnings.push(`No. SO ${s} dipakai di lebih dari satu kolom (kebutuhannya akan terhitung ganda)`))
  d.columns.forEach((c, i) => {
    const s = String(c.so).trim()
    if (!s && c.buyer) warnings.push(`Kolom ${i + 1} (${c.buyer}) belum punya No. SO`)
    if (s && !c.buyer) warnings.push(`SO ${s} belum punya nama buyer`)
    if (s && d.soInfo?.[s]?.state === 'ok' && d.soInfo[s].n === 0) warnings.push(`SO ${s} tidak ditemukan di RESERVASI`)
  })
  stok.filter(x => x.stok < 0).forEach(x => warnings.push(`Stok ${x.kode} bernilai negatif (${x.stok})`))
  return { stok, plan, colsChanged, colsFrom: sv.columns, colsTo: d.columns, errors, warnings, count: stok.length + plan.length + (colsChanged ? 1 : 0) }
}

/* Lazy load + cache + submit:
   - Data dasar diambil sekali, disimpan di cache sesi. Baris RESERVASI diambil per SO yang dipakai (sekali per SO).
   - Edit (stok, PO, kolom SO) hanya mengubah draft di layar; dikirim ke Neon setelah tombol Submit.
   - Upload juga lewat tahap pratinjau + tombol Submit (lihat halaman Upload). */
export function useData(onAuthFail) {
  const [init] = useState(readCache)
  const [d, setD] = useState(init || empty)
  const ref = useRef(d)
  const apply = f => { ref.current = f(ref.current); setD(ref.current) }
  const [st, setSt] = useState({ loading: !init, error: '', saving: 0 })
  const fail = e => { if (e.status === 401) onAuthFail(); setSt(s => ({ ...s, error: e.message })) }

  useEffect(() => {
    if (st.loading) return
    try {
      const soInfo = Object.fromEntries(Object.entries(d.soInfo).filter(([, v]) => v.state === 'ok'))
      sessionStorage.setItem(CK, JSON.stringify({ ...d, soInfo }))
    } catch {}
  }, [d, st.loading])

  const fetchBase = async () => {
    const j = await call('/api/data')
    apply(x => { const n = { ...x, materials: j.materials, columns: j.columns, plan: j.plan, stats: j.stats }; return { ...n, saved: snap(n) } })
  }
  const ensureSO = async list => {
    const need = [...new Set(list.map(s => String(s || '').trim()).filter(Boolean))]
      .filter(s => { const i = ref.current.soInfo[s]; return !i || i.state === 'error' })
    if (!need.length) return
    apply(x => ({ ...x, soInfo: { ...x.soInfo, ...mark(need, 'loading') } }))
    try {
      const j = await call('/api/data?so=' + encodeURIComponent(need.join(',')))
      const n = {}; j.rows.forEach(r => n[r.so] = (n[r.so] || 0) + 1)
      apply(x => ({ ...x, reservasi: [...x.reservasi.filter(r => !need.includes(r.so)), ...j.rows], soInfo: { ...x.soInfo, ...mark(need, 'ok', n) } }))
    } catch (e) { fail(e); apply(x => ({ ...x, soInfo: { ...x.soInfo, ...mark(need, 'error') } })) }
  }
  const active = () => ref.current.columns.map(c => c.so)

  useEffect(() => {
    (async () => {
      try { if (!init) await fetchBase(); await ensureSO(active()) } catch (e) { fail(e) }
      finally { setSt(s => ({ ...s, loading: false })) }
    })()
  }, [])

  const queue = useRef(Promise.resolve())
  const enqueue = (body, quiet) => {
    setSt(s => ({ ...s, saving: s.saving + 1, error: '' }))
    const p = queue.current.then(() => call('/api/data', { method: 'POST', body: JSON.stringify(body) }, body.action === 'reservasi' || body.action === 'upload' ? 120000 : 30000))
    queue.current = p.catch(() => {})
    return p.catch(e => { if (!quiet) fail(e); throw e }).finally(() => setSt(s => ({ ...s, saving: s.saving - 1 })))
  }
  const sendReservasi = async (rows, mode, onProgress) => {
    const soList = [...new Set(rows.map(r => r.so))], SIZE = 3000
    for (let i = 0; i < rows.length; i += SIZE) {
      await enqueue({ action: 'reservasi', mode, first: i === 0, soList: i === 0 ? soList : undefined, rows: rows.slice(i, i + SIZE) })
      onProgress?.(Math.min(i + SIZE, rows.length), rows.length)
    }
    const set = new Set(soList)
    apply(x => mode === 'replace' ? { ...x, reservasi: [], soInfo: {} }
      : { ...x, reservasi: x.reservasi.filter(r => !set.has(r.so)), soInfo: Object.fromEntries(Object.entries(x.soInfo).filter(([k]) => !set.has(k))) })
    const j = await call('/api/data?stats=1'); apply(x => ({ ...x, stats: j.stats }))
    await ensureSO(active())
  }

  const changes = useMemo(() => diff(d), [d])
  const actions = {
    uploadAll: async (p, onProgress) => {
      const cols = ref.current.columns.length ? undefined : p.columns
      if (p.stok || cols) {
        await enqueue({ action: 'upload', materials: p.stok, columns: cols })
        apply(x => { const n = { ...x, materials: p.stok || x.materials, columns: cols || x.columns }; return { ...n, saved: snap(n) } })
      }
      if (p.reservasi) await sendReservasi(p.reservasi, 'replace', onProgress)
    },
    uploadReservasi: (rows, mode, onProgress) => sendReservasi(rows, mode, onProgress),
    // Edit = draft saja (belum ke database)
    setColumns: cols => { apply(x => ({ ...x, columns: cols })); ensureSO(cols.map(c => c.so)) },
    setStok: (kode, v) => apply(x => ({ ...x, materials: x.materials.map(m => m.kode === kode ? { ...m, stok: v } : m) })),
    setPlan: (kode, k, v) => apply(x => ({ ...x, plan: { ...x.plan, [kode]: { ...P0, ...x.plan[kode], [k]: v } } })),
    // Submit aman: validasi -> cek bentrok dengan pengguna lain di server -> satu transaksi
    submit: async (force = false) => {
      const ch = diff(ref.current)
      if (ch.errors.length) return { ok: false, error: ch.errors.join('. ') }
      const snapshot = snap(ref.current)
      try {
        await enqueue({ action: 'batch', force, stok: ch.stok, plan: ch.plan, columns: ch.colsChanged ? ref.current.columns : undefined, oldColumns: ch.colsChanged ? ch.colsFrom : undefined }, true)
        apply(x => ({ ...x, saved: snapshot })); return { ok: true, n: ch.count }
      } catch (e) {
        if (e.status === 409) return { ok: false, conflicts: e.data?.conflicts || [] }
        if (e.status === 401) onAuthFail()
        return { ok: false, error: e.message }
      }
    },
    revertStok: kode => apply(x => ({ ...x, materials: x.materials.map(m => m.kode === kode && kode in x.saved.stok ? { ...m, stok: x.saved.stok[kode] } : m) })),
    revertPlan: kode => apply(x => { const p = { ...x.plan }; x.saved.plan[kode] ? p[kode] = clone(x.saved.plan[kode]) : delete p[kode]; return { ...x, plan: p } }),
    revertColumns: () => { apply(x => ({ ...x, columns: clone(x.saved.columns) })); ensureSO(active()) },
    discard: () => {
      apply(x => ({ ...x, materials: x.materials.map(m => m.kode in x.saved.stok ? { ...m, stok: x.saved.stok[m.kode] } : m), plan: clone(x.saved.plan), columns: clone(x.saved.columns) }))
      ensureSO(active())
    },
    findSO: async q => { try { await ensureSO((await call('/api/data?sofind=' + encodeURIComponent(q))).sos) } catch (e) { fail(e) } },
    reset: async () => { await enqueue({ action: 'reset' }); apply(() => empty) },
    refresh: async () => {
      setSt(s => ({ ...s, loading: true }))
      try { sessionStorage.removeItem(CK); apply(x => ({ ...x, reservasi: [], soInfo: {} })); await fetchBase(); await ensureSO(active()) }
      catch (e) { fail(e) } finally { setSt(s => ({ ...s, loading: false })) }
    },
    clearError: () => setSt(s => ({ ...s, error: '' })),
  }
  return { data: d, status: st, actions, changes }
}
