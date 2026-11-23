import { useEffect, useState } from 'react'
import { api } from '../lib/store.js'
import { fmt } from '../lib/calc.js'
import { Sk } from './Skeleton.jsx'

// Tabel RESERVASI lengkap, dibaca langsung dari database per halaman (100 baris) + pencarian
const SIZE = 100
export default function ReservasiViewer({ onClose }) {
  const [q, setQ] = useState(''), [page, setPage] = useState(0)
  const [res, setRes] = useState({ rows: [], total: 0 }), [loading, setLoading] = useState(true), [err, setErr] = useState('')
  useEffect(() => {
    setLoading(true); setErr('')
    const id = setTimeout(() => api(`/api/data?res=1&q=${encodeURIComponent(q.trim())}&page=${page}&size=${SIZE}`)
      .then(setRes).catch(e => setErr(e.message)).finally(() => setLoading(false)), q ? 300 : 0)
    return () => clearTimeout(id)
  }, [q, page])
  const pages = Math.max(1, Math.ceil(res.total / SIZE))
  return (
    <div className="rsv">
      <div className="row"><h2 style={{ margin: 0 }}>Tabel RESERVASI</h2><div className="grow" /><button className="btn ghost" onClick={onClose}>Tutup ✕</button></div>
      <div className="row">
        <input className="search" placeholder="Cari No. SO / kode / deskripsi" value={q} onChange={e => { setQ(e.target.value); setPage(0) }} autoFocus />
        <span className="mono small muted">{loading ? 'memuat…' : `${fmt(res.total)} baris`}</span>
        <div className="grow" />
        <button className="btn ghost sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Sebelumnya</button>
        <span className="mono small">{page + 1} / {pages}</span>
        <button className="btn ghost sm" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Berikutnya ›</button>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="tablewrap" style={{ flex: 1, maxHeight: 'none' }}>
        <table><thead><tr><th>SO NUMBER</th><th>KODE MATERIAL</th><th>Sales Order</th><th>QTY</th><th>UoM</th></tr></thead>
          <tbody>
            {res.rows.map((r, i) => <tr key={i}><td className="mono">{r.so}</td><td className="mono">{r.kode}</td><td>{r.desk}</td><td className="n">{fmt(r.qty)}</td><td>{r.uom}</td></tr>)}
            {loading && !res.rows.length && Array.from({ length: 12 }).map((_, i) => <tr key={'s' + i}>{[110, 130, 220, 60, 40].map((w, j) => <td key={j}><Sk w={w} h={12} /></td>)}</tr>)}
            {!res.rows.length && !loading && <tr><td colSpan="5" className="muted center">Tidak ada data.</td></tr>}
          </tbody></table>
      </div>
    </div>)
}
