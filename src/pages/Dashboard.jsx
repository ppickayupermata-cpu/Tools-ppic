import { useMemo } from 'react'
import { balanceOf, fmt } from '../lib/calc.js'

function Bars({ items }) {
  const max = Math.max(1, ...items.map(x => x[1]))
  return items.length ? items.map(([k, v]) => <div key={k} className="bar"><span className="mono">{k}</span><div className="track"><i style={{ width: (v / max * 100) + '%' }} /></div><span className="mono">{fmt(v)}</span></div>)
    : <p className="muted small">Belum ada data.</p>
}

function CatDetail({ data, go }) {
  const { materials, reservasi, columns, soInfo, stats } = data
  const s = useMemo(() => {
    const all = materials.map(m => ({ m, ...balanceOf(m, columns, reservasi) }))
    const neg = all.filter(r => r.balance < 0).sort((a, b) => a.balance - b.balance)
    const pas = all.filter(r => r.balance === 0).length, ok = all.filter(r => r.balance > 0).length
    const perSO = columns.filter(c => c.so).map(c => {
      const rs = reservasi.filter(r => r.so === c.so)
      return { ...c, n: rs.length, total: rs.reduce((t, r) => t + r.qty, 0), state: soInfo[c.so]?.state }
    })
    const perBuyer = {}; perSO.forEach(c => { const b = c.buyer || '(tanpa buyer)'; perBuyer[b] = (perBuyer[b] || 0) + c.total })
    return { all, neg, pas, ok, perSO, perBuyer: Object.entries(perBuyer).sort((a, b) => b[1] - a[1]),
      zero: all.filter(r => !Number(r.m.stok)).length, top: all.filter(r => r.used > 0).sort((a, b) => b.used - a.used).slice(0, 10) }
  }, [materials, columns, reservasi, soInfo])
  if (!materials.length) return <div className="card empty"><p>Belum ada data CAT.</p><button className="btn" onClick={() => go('upload', 'CAT')}>Upload Data</button></div>
  const tot = Math.max(1, s.all.length)
  return (<>
    <div className="kpis">
      {[['Material', s.all.length], ['Aman', s.ok], ['Pas', s.pas], ['Kurang', s.neg.length, 'bad'], ['Stok SAP kosong', s.zero], ['SO aktif', s.perSO.length], ['SO di database', stats?.soCount ?? 0], ['Baris RESERVASI', stats?.rowCount ?? 0]]
        .map(([l, v, c]) => <div key={l} className="card kpi"><div className="eyebrow">{l}</div><div className={'big ' + (c || '')}>{fmt(v)}</div></div>)}
    </div>
    <div className="card"><div className="eyebrow">Kondisi stok (sisa = Stok SAP − kebutuhan SO)</div>
      <div className="stack"><i className="g" style={{ width: s.ok / tot * 100 + '%' }} /><i className="n" style={{ width: s.pas / tot * 100 + '%' }} /><i className="r" style={{ width: s.neg.length / tot * 100 + '%' }} /></div>
      <div className="legend mono small"><span className="pos">● Aman {fmt(s.ok)}</span><span className="zero">● Pas {fmt(s.pas)}</span><span className="neg">● Kurang {fmt(s.neg.length)}</span></div></div>
    <div className="grid2">
      <div className="card"><div className="eyebrow">Material kekurangan (sisa minus)</div>
        {s.neg.slice(0, 10).map(r => <div key={r.m.kode} className="li"><span><b className="mono">{r.m.kode}</b><br /><span className="muted small">{r.m.desk}</span></span><span className="neg mono">{fmt(r.balance)} {r.m.uom}</span></div>)}
        {!s.neg.length && <p className="muted small">Tidak ada kekurangan.</p>}
        {s.neg.length > 10 && <button className="link" onClick={() => go('monitoring', 'CAT')}>Lihat semua ({s.neg.length}) di menu Stok →</button>}</div>
      <div className="card"><div className="eyebrow">Kebutuhan terbesar (total semua SO aktif)</div>
        {s.top.map(r => <div key={r.m.kode} className="li"><span><b className="mono">{r.m.kode}</b><br /><span className="muted small">{r.m.desk}</span></span><span className="mono">{fmt(r.used)} {r.m.uom}</span></div>)}
        {!s.top.length && <p className="muted small">Belum ada SO aktif.</p>}</div>
    </div>
    <div className="grid2">
      <div className="card"><div className="eyebrow">Kebutuhan per buyer (total qty RESERVASI)</div><Bars items={s.perBuyer} /></div>
      <div className="card"><div className="eyebrow">SO aktif</div>
        {s.perSO.length ? <div className="tablewrap sm"><table><thead><tr><th>Buyer</th><th>No. SO</th><th>Baris</th><th>Total qty</th></tr></thead>
          <tbody>{s.perSO.map((c, i) => <tr key={i}><td>{c.buyer || '-'}</td><td className="mono">{c.so}</td>
            <td className={'n' + (c.state === 'ok' && !c.n ? ' neg' : '')}>{c.state === 'loading' ? '…' : fmt(c.n)}</td><td className="n">{fmt(c.total)}</td></tr>)}</tbody></table></div>
          : <p className="muted small">Belum ada SO di kolom. Tambahkan lewat menu Stok.</p>}</div>
    </div>
  </>)
}

const Blank = ({ name }) => <section className="catsec"><div className="cathead"><h2>{name}</h2><span className="badge zero">Belum dirilis</span></div><div className="blank" /></section>

export default function Dashboard({ data, go }) {
  return (<>
    <h1>Beranda · Semua Kategori</h1>
    <section className="catsec"><div className="cathead"><h2>CAT</h2><button className="link" onClick={() => go('monitoring', 'CAT')}>Buka Stok CAT →</button></div>
      <CatDetail data={data} go={go} /></section>
    <Blank name="Hardware" />
    <Blank name="Karton" />
  </>)
}
