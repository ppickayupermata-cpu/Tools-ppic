import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cellOf, fmt, exportXlsx } from '../lib/calc.js'
import { Sk, CardsSkeleton } from '../components/Skeleton.jsx'

const EMPTY = { set: new Set(), sos: [] }
const clean = v => String(v ?? '').replace(/[\s\u00a0]+/g, '')
const isSO = t => /^\d{6,}$/.test(t)

function NumInput({ value, onCommit, text, cls = 'num' }) {
  const [v, setV] = useState(String(value ?? ''))
  useEffect(() => setV(String(value ?? '')), [value])
  const commit = () => { const c = v.trim(); if (c !== String(value ?? '')) onCommit(text ? c : (Number(c.replace(',', '.')) || 0)) }
  return <input className={cls} type="text" inputMode={text ? 'text' : 'decimal'} value={v} onChange={e => setV(e.target.value)}
    onBlur={commit} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
}
function useMobile() {
  const q = '(max-width:900px)'
  const [m, setM] = useState(() => matchMedia(q).matches)
  useEffect(() => { const mq = matchMedia(q), h = () => setM(mq.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h) }, [])
  return m
}
// Input header: commit saat blur / Enter / paste (bukan tiap ketikan)
function HeadInput({ value, onCommit, placeholder, mono }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = x => { const c = mono ? clean(x) : x.trim(); setV(c); if (c !== value) onCommit(c) }
  return <input className={'hin' + (mono ? ' mono' : '')} value={v} placeholder={placeholder}
    onChange={e => setV(e.target.value)} onBlur={e => commit(e.target.value)}
    onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
    onPaste={e => { e.preventDefault(); commit(e.clipboardData.getData('text').split(/[\r\n\t]/)[0]) }} />
}

// Menu filter ala Excel. Dirender lewat portal + posisi fixed: tidak ikut ter-scroll dan tidak terpotong tabel.
function FilterMenu({ pos, values, selected, onApply, onSort, onClose }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(() => new Set(selected ?? values))
  const ref = useRef()
  useEffect(() => {
    const away = e => !ref.current?.contains(e.target) && onClose()
    document.addEventListener('mousedown', away); window.addEventListener('scroll', away, true); window.addEventListener('resize', onClose)
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('scroll', away, true); window.removeEventListener('resize', onClose) }
  }, [])
  const shown = useMemo(() => values.filter(v => v.toLowerCase().includes(q.toLowerCase())).slice(0, 300), [values, q])
  const toggle = v => setSel(s => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n })
  const allShown = shown.every(v => sel.has(v))
  const left = Math.max(8, Math.min(pos.x, window.innerWidth - 256)), top = Math.max(8, Math.min(pos.y + 4, window.innerHeight - 400))
  return createPortal(
    <div className="fmenu" style={{ position: 'fixed', left, top }} ref={ref}>
      <button onClick={() => { onSort('asc'); onClose() }}>Urutkan A → Z / kecil → besar</button>
      <button onClick={() => { onSort('desc'); onClose() }}>Urutkan Z → A / besar → kecil</button>
      <input autoFocus placeholder="Cari…" value={q} onChange={e => setQ(e.target.value)} />
      <label className="chk"><input type="checkbox" checked={allShown} onChange={() => setSel(s => { const n = new Set(s); shown.forEach(v => allShown ? n.delete(v) : n.add(v)); return n })} /> (Pilih semua{q ? ' hasil' : ''})</label>
      <div className="flist">{shown.map(v => <label key={v} className="chk"><input type="checkbox" checked={sel.has(v)} onChange={() => toggle(v)} />{v === '' ? '(kosong)' : v}</label>)}</div>
      <div className="frow">
        <button className="btn" onClick={() => { onApply(sel.size === values.length ? null : sel); onClose() }}>OK</button>
        <button className="btn ghost" onClick={() => { onApply(null); onClose() }}>Hapus filter</button>
      </div>
    </div>, document.body)
}

function SoStatus({ info }) {
  if (!info || info.state === 'loading') return <Sk w={60} h={10} />
  if (info.state === 'error') return <div className="warn small">gagal memuat</div>
  return info.n ? <div className="ok small">✓ {info.n} baris</div> : <div className="warn small">SO tak ada</div>
}
function SOSheet({ columns, reservasi, materials, soInfo, setCol, addCol, delCol, onClose }) {
  const kodes = useMemo(() => new Set(materials.map(m => m.kode)), [materials])
  const match = useMemo(() => { const m = {}; reservasi.forEach(r => { if (kodes.has(r.kode)) m[r.so] = (m[r.so] || 0) + 1 }); return m }, [reservasi, kodes])
  return <div className="overlay" onClick={onClose}><div className="sheet" onClick={e => e.stopPropagation()}>
    <h2>Kolom SO</h2>
    <p className="muted small">Isi nama buyer, lalu tempel (paste) nomor SO. QTY dan UoM tiap material terisi otomatis dari RESERVASI (dicocokkan lewat KODE MATERIAL). Perubahan baru tersimpan setelah Submit.</p>
    {columns.map((c, i) => { const info = soInfo[c.so], miss = info?.state === 'ok' ? info.n - (match[c.so] || 0) : 0
      return <div key={i} className="soitem">
        <div className="row" style={{ margin: 0 }}>
          <HeadInput value={c.buyer} placeholder="Buyer (mis. ETD)" onCommit={v => setCol(i, 'buyer', v)} />
          <HeadInput mono value={c.so} placeholder="Tempel No. SO" onCommit={v => setCol(i, 'so', v)} />
          <button className="btn ghost sm" onClick={() => delCol(i)}>Hapus</button></div>
        {c.so && <SoStatus info={info} />}
        {miss > 0 && <div className="warn small">{miss} kode material di SO ini tidak ada di daftar stok</div>}
      </div> })}
    <div className="row" style={{ marginTop: 16 }}><button className="btn" onClick={addCol}>+ Tambah SO</button><button className="btn ghost" onClick={onClose}>Selesai</button></div>
  </div></div>
}
function MatCard({ r, columns, plan, actions, open, toggle }) {
  const { m, qs, us, bal, used } = r, st = bal < 0 ? 'neg' : bal === 0 ? 'zero' : 'pos'
  return <div className="mcard">
    <div className="mtop"><span className="mono">{m.kode}</span><span className={'badge ' + st}>{bal < 0 ? 'KURANG' : bal === 0 ? 'PAS' : 'AMAN'}</span></div>
    <div className="mdesc">{m.desk}</div>
    <div className="mstats">
      <div><div className="eyebrow">Stok SAP</div><NumInput value={m.stok} onCommit={v => actions.setStok(m.kode, v)} /></div>
      <div><div className="eyebrow">Kebutuhan SO</div><div className="big2">{fmt(used)}</div></div>
      <div><div className="eyebrow">Sisa stok</div><div className={'big2 ' + st}>{fmt(bal)}</div></div>
    </div>
    <button className="link" onClick={toggle}>{open ? 'Tutup rincian ▲' : 'Lihat rincian per SO ▼'}</button>
    {open && <div className="detail">
      {qs.some(Boolean) ? columns.map((c, i) => qs[i] ? <div key={i} className="li"><span>{c.buyer || '-'} · <span className="mono">{c.so}</span></span><b className="mono">{fmt(qs[i])} {us[i] || m.uom}</b></div> : null) : <div className="muted small">Belum ada SO yang memakai material ini.</div>}
      <div className="eyebrow">Rencana PO</div>
      <div className="row" style={{ margin: 0 }}>{['po1', 'po2', 'po3'].map(k => <NumInput key={k} text cls="num wide" value={plan[m.kode]?.[k] ?? ''} onCommit={v => actions.setPlan(m.kode, k, v)} />)}</div>
    </div>}
  </div>
}

function FH({ ctx, k, children, cls = '' }) {
  const { open, setOpen, filters, options, setFilters, setSort } = ctx
  return (
    <th className={cls + (filters[k] ? ' filtered' : '')}>
      <div className="hcell">{children}
        <button className="fbtn" onMouseDown={e => e.stopPropagation()}
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setOpen(open?.k === k ? null : { k, x: r.left, y: r.bottom }) }}>{filters[k] ? '▼•' : '▼'}</button></div>
      {open?.k === k && <FilterMenu pos={open} values={options} selected={filters[k]} onClose={() => setOpen(null)}
        onApply={s => setFilters(f => ({ ...f, [k]: s }))} onSort={dir => setSort({ key: k, dir })} />}
    </th>)
}

export default function Monitoring({ data, actions }) {
  const { materials, reservasi, columns, plan, soInfo, saved } = data
  const mobile = useMobile()
  const [q, setQ] = useState(''), [filters, setFilters] = useState({}), [sort, setSort] = useState(null), [open, setOpen] = useState(null)
  const [status, setStatus] = useState('all'), [sheet, setSheet] = useState(false), [limit, setLimit] = useState(40), [openCard, setOpenCard] = useState(null)
  const [finding, setFinding] = useState(false)
  useEffect(() => setLimit(40), [q, status, filters, sort])

  // Multi search: pisahkan dengan koma, mis. PTCA000000007,PTCA000000008 atau 1010002504,1010002505
  const terms = useMemo(() => [...new Set(q.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))], [q])
  const soTerms = useMemo(() => terms.filter(isSO), [terms])
  const soKey = soTerms.join(',')
  useEffect(() => {
    if (!soTerms.length) { setFinding(false); return }
    setFinding(true)
    const id = setTimeout(() => Promise.all(soTerms.map(t => actions.findSO(t))).finally(() => setFinding(false)), 350)
    return () => clearTimeout(id)
  }, [soKey])
  const soM = useMemo(() => {
    if (!soTerms.length) return EMPTY
    const rs = reservasi.filter(r => soTerms.some(t => r.so.includes(t)))
    return { set: new Set(rs.map(r => r.kode)), sos: [...new Set(rs.map(r => r.so))] }
  }, [soKey, reservasi])

  const base = useMemo(() => materials.map(m => {
    const cells = columns.map(c => cellOf(reservasi, c.so, m.kode)), qs = cells.map(x => x.qty), us = cells.map(x => x.uom)
    const used = qs.reduce((a, b) => a + b, 0), bal = (Number(m.stok) || 0) - used, p = plan[m.kode] || {}
    return { m, qs, us, bal, used, hay: (m.kode + ' ' + m.desk).toLowerCase(),
      vals: { kode: m.kode, desk: m.desk, stok: fmt(m.stok), uom: m.uom, bal: fmt(bal), po1: p.po1 ?? '', po2: p.po2 ?? '', po3: p.po3 ?? '',
        ...Object.fromEntries(qs.map((v, i) => ['so' + i, v ? fmt(v) : ''])) },
      nums: { stok: Number(m.stok) || 0, bal, ...Object.fromEntries(qs.map((v, i) => ['so' + i, v])) } }
  }), [materials, columns, reservasi, plan])

  const options = useMemo(() => open ? [...new Set(base.map(r => r.vals[open.k]))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true })) : [], [open, base])
  const rows = useMemo(() => {
    const fk = Object.entries(filters).filter(([, s]) => s)
    let r = base.filter(x => (status === 'all' || (status === 'neg' ? x.bal < 0 : x.bal >= 0))
      && (!terms.length || soM.set.has(x.m.kode) || terms.some(t => x.hay.includes(t)))
      && fk.every(([k, s]) => s.has(x.vals[k])))
    if (sort) {
      const d = sort.dir === 'asc' ? 1 : -1
      r = [...r].sort((a, b) => sort.key in a.nums ? (a.nums[sort.key] - b.nums[sort.key]) * d : String(a.vals[sort.key]).localeCompare(String(b.vals[sort.key]), 'id', { numeric: true }) * d)
    }
    return r
  }, [base, terms, filters, sort, status, soM])
  const noHit = useMemo(() => finding ? [] : terms.filter(t => !base.some(x => x.hay.includes(t)) && !(isSO(t) && soM.sos.some(s => s.includes(t)))), [terms, base, soM, finding])

  const addCol = () => actions.setColumns([...columns, { buyer: '', so: '' }])
  const setCol = (i, k, v) => actions.setColumns(columns.map((c, j) => j === i ? { ...c, [k]: v } : c))
  const delCol = i => confirm('Hapus kolom ini?') && (setFilters({}), actions.setColumns(columns.filter((_, j) => j !== i)))
  const nf = Object.values(filters).filter(Boolean).length
  const sortVal = sort ? sort.key + sort.dir : 'kodeasc'

  // header tabel: baris ke-2 menempel tepat di bawah baris ke-1 (tinggi diukur), jadi seluruh header + filter tidak ikut ter-scroll
  const h1 = useRef()
  useLayoutEffect(() => {
    const el = h1.current; if (!el) return
    const set = () => el.parentElement.style.setProperty('--h1', el.offsetHeight + 'px')
    set(); const ro = new ResizeObserver(set); ro.observe(el); return () => ro.disconnect()
  }, [mobile, columns.length, materials.length])

  const soHint = finding ? <span className="skwrap"><Sk w={90} h={10} /></span>
    : soM.set.size ? <span className="ok small">✓ SO {soM.sos.slice(0, 3).join(', ')}{soM.sos.length > 3 ? ` +${soM.sos.length - 3}` : ''} · {soM.set.size} material</span> : null
  const noHitEl = noHit.length > 0 && <span className="warn small">tanpa hasil: {noHit.join(', ')}</span>
  const chips = <div className="chips">{[['all', 'Semua'], ['neg', 'Kurang'], ['ok', 'Aman']].map(([k, l]) => <button key={k} className={'pill' + (status === k ? ' on' : '')} onClick={() => setStatus(k)}>{l}</button>)}</div>
  const PH = 'Cari kode / deskripsi / No. SO — pisahkan dengan koma'
  const sheetEl = sheet && <SOSheet columns={columns} reservasi={reservasi} materials={materials} soInfo={soInfo} setCol={setCol} addCol={addCol} delCol={delCol} onClose={() => setSheet(false)} />

  if (mobile) return (<>
    <h1>Stok Material CAT</h1>
    <div className="stickytools">
      <input className="search" placeholder={PH} value={q} onChange={e => setQ(e.target.value)} />
      <div className="row" style={{ margin: '8px 0 0' }}>{chips}
        <select value={sortVal} onChange={e => { const v = e.target.value; setSort(v === 'kodeasc' ? null : { key: v.slice(0, -3), dir: v.slice(-3) }) }}>
          <option value="kodeasc">Kode A-Z</option><option value="balasc">Sisa paling sedikit</option><option value="baldesc">Sisa paling banyak</option></select>
        <button className="btn sm" onClick={() => setSheet(true)}>Kelola SO ({columns.length})</button></div>
    </div>
    <div className="mono small muted" style={{ margin: '8px 0' }}>{rows.length} dari {materials.length} material {soHint} {noHitEl}</div>
    {finding && !rows.length ? <CardsSkeleton n={2} /> : rows.slice(0, limit).map(r => <MatCard key={r.m.kode} r={r} columns={columns} plan={plan} actions={actions} open={openCard === r.m.kode} toggle={() => setOpenCard(openCard === r.m.kode ? null : r.m.kode)} />)}
    {!rows.length && !finding && <div className="card empty">{materials.length ? 'Tidak ada material yang cocok.' : 'Belum ada data. Buka menu Upload.'}</div>}
    {rows.length > limit && <button className="btn full" onClick={() => setLimit(l => l + 40)}>Tampilkan lebih banyak</button>}
    {sheetEl}
  </>)

  const ctx = { open, setOpen, filters, options, setFilters, setSort }

  return (<div className="monwrap">
    <div className="row"><h1 style={{ margin: 0 }}>Monitoring Stok CAT</h1><div className="grow" />
      <button className="btn ghost" onClick={() => exportXlsx(rows.map(r => r.m), columns, reservasi, plan)}>Export XLSX (sesuai filter)</button></div>
    <p className="muted small" style={{ margin: '0 0 8px' }}>Sisa stok = Stok SAP − kebutuhan semua SO. Multi pencarian: pisahkan dengan koma, mis. <span className="mono">PTCA000000007,PTCA000000008</span> atau beberapa No. SO. Klik + untuk menambah kolom SO.</p>
    <div className="row">
      <input className="search wide2" placeholder={PH} value={q} onChange={e => setQ(e.target.value)} />{chips}
      {(nf > 0 || sort) && <button className="btn ghost sm" onClick={() => { setFilters({}); setSort(null) }}>Hapus semua filter ({nf})</button>}
      {soHint}{noHitEl}
      <span className="mono small muted">{rows.length} / {materials.length} material · {columns.length} kolom SO</span>
    </div>
    <div className="tablewrap"><table>
      <thead>
        <tr ref={h1}>
          <FH ctx={ctx} k="kode" cls="stick">KODE MATERIAL</FH><FH ctx={ctx} k="desk" cls="stick2">DESKRIPSI</FH><FH ctx={ctx} k="stok">STOK SAP</FH><FH ctx={ctx} k="uom">UoM</FH>
          {columns.map((c, i) => <FH ctx={ctx} key={i} k={'so' + i} cls="so">
            <HeadInput value={c.buyer} placeholder="Buyer" onCommit={v => setCol(i, 'buyer', v)} />
            <button className="x" title="Hapus kolom" onClick={() => delCol(i)}>×</button></FH>)}
          <th><button className="plus" onClick={addCol} title="Tambah kolom SO kosong">+</button></th>
          <FH ctx={ctx} k="bal">SISA STOK</FH><FH ctx={ctx} k="po1">RENCANA PO</FH><FH ctx={ctx} k="po2">PO 2</FH><FH ctx={ctx} k="po3">PO3</FH>
        </tr>
        <tr className="sub"><th className="stick" /><th className="stick2" /><th /><th />
          {columns.map((c, i) => <th key={i}><HeadInput mono value={c.so} placeholder="paste SO…" onCommit={v => setCol(i, 'so', v)} />
            {c.so && <SoStatus info={soInfo[c.so]} />}</th>)}
          <th /><th>stok − Σ SO</th><th /><th /><th /></tr>
      </thead>
      <tbody>
        {rows.map(({ m, qs, us, bal }) => (
          <tr key={m.kode}>
            <td className="stick mono">{m.kode}</td><td className="stick2">{m.desk}</td>
            <td><NumInput cls={'num' + (saved?.stok?.[m.kode] !== m.stok ? ' dirty' : '')} value={m.stok} onCommit={v => actions.setStok(m.kode, v)} /></td><td>{m.uom}</td>
            {qs.map((v, i) => {
              if (soInfo[columns[i].so]?.state === 'loading') return <td key={i} className="n"><Sk w={50} h={12} /></td>
              const diff = v && us[i] && m.uom && us[i] !== m.uom
              return <td key={i} className={'n' + (v ? ' hit' : '') + (diff ? ' uomdiff' : '')} title={diff ? `UoM RESERVASI (${us[i]}) beda dengan UoM stok (${m.uom})` : undefined}>{v ? <>{fmt(v)} <span className="uom">{us[i]}</span></> : '–'}</td>
            })}
            <td />
            <td className={'n bal ' + (bal < 0 ? 'neg' : bal === 0 ? 'zero' : 'pos')}>{fmt(bal)}</td>
            {['po1', 'po2', 'po3'].map(k => <td key={k}><NumInput text value={plan[m.kode]?.[k] ?? ''} onCommit={v => actions.setPlan(m.kode, k, v)} /></td>)}
          </tr>))}
        {!rows.length && <tr><td colSpan={9 + columns.length} className="muted center">{finding ? 'Mencari SO…' : materials.length ? 'Tidak ada baris yang cocok dengan pencarian / filter.' : 'Belum ada data. Upload file di menu Upload.'}</td></tr>}
      </tbody>
    </table></div>
  </div>)
}
