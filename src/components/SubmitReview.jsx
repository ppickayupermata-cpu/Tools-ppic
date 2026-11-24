import { useState } from 'react'
import { fmt } from '../lib/calc.js'

// Alur Simpan: Tinjau → Simpan ke database → (cek bentrok di server) → Selesai.
// Tombol Simpan selalu bisa diklik (kecuali saat sedang menyimpan) dan berada di footer yang selalu terlihat.
export default function SubmitReview({ changes, actions, onClose }) {
  const [phase, setPhase] = useState('review'), [info, setInfo] = useState(null)
  const { stok, plan, colsChanged, colsFrom, colsTo, errors, warnings, count } = changes
  const busy = phase === 'saving'
  const run = async force => {
    if (busy) return
    setPhase('saving'); const r = await actions.submit(force); setInfo(r)
    setPhase(r.ok ? 'done' : r.conflicts ? 'conflict' : 'error')
  }
  const po = p => [p.po1, p.po2, p.po3].map(x => x || '–').join(' / ')
  const colList = cs => cs.length ? cs.map((c, i) => <span key={i} className="tag">{c.buyer || '-'} · {c.so || '(kosong)'}</span>) : <span className="muted small">(tidak ada)</span>

  let body, foot
  if (phase === 'done') {
    body = <><h2 className="ok">✓ Tersimpan ke database</h2><p className="muted">{info.n} perubahan berhasil disimpan.</p></>
    foot = <button className="btn" onClick={onClose}>Selesai</button>
  } else if (phase === 'conflict') {
    body = <><h2 className="warn">Data sudah berubah di database</h2>
      <p className="muted small">Seseorang mengubah data yang sama sejak kamu memuatnya. Belum ada yang tersimpan.</p>
      <ul className="chlist">{info.conflicts.map((c, i) => <li key={i} className="warn">{c}</li>)}</ul></>
    foot = <><button className="btn" onClick={() => { onClose(); actions.refresh() }}>Muat ulang data (draf dibuang)</button>
      <button className="btn ghost" onClick={() => run(true)}>Timpa dengan perubahan saya</button>
      <button className="btn ghost" onClick={() => setPhase('review')}>Kembali</button></>
  } else if (phase === 'error') {
    body = <><h2 className="warn">Gagal menyimpan</h2><p className="err">{info.error}</p><p className="muted small">Draf kamu masih aman di layar.</p></>
    foot = <><button className="btn" onClick={() => run(false)}>Coba lagi</button><button className="btn ghost" onClick={() => setPhase('review')}>Kembali</button></>
  } else {
    body = <>
      <h2>Tinjau perubahan</h2>
      <p className="muted small">Periksa dulu. Belum ada yang tersimpan sampai kamu menekan <b>Simpan ke database</b>.</p>
      {errors.map((t, i) => <div key={i} className="err">✕ {t}</div>)}
      {warnings.map((t, i) => <div key={i} className="warnline">! {t}</div>)}
      {count === 0 && <p className="muted">Tidak ada perubahan.</p>}
      {stok.length > 0 && <><div className="eyebrow">Stok SAP ({stok.length})</div>
        <div className="tablewrap sm"><table><tbody>{stok.map(x => <tr key={x.kode}><td className="mono">{x.kode}</td><td>{x.desk}</td>
          <td className="n">{fmt(x.old)} → <b className="pos">{fmt(x.stok)}</b></td><td><button className="btn ghost sm" onClick={() => actions.revertStok(x.kode)}>Batalkan</button></td></tr>)}</tbody></table></div></>}
      {plan.length > 0 && <><div className="eyebrow">Rencana PO ({plan.length})</div>
        <div className="tablewrap sm"><table><tbody>{plan.map(x => <tr key={x.kode}><td className="mono">{x.kode}</td>
          <td className="n">{po(x.old)} → <b className="pos">{po(x)}</b></td><td><button className="btn ghost sm" onClick={() => actions.revertPlan(x.kode)}>Batalkan</button></td></tr>)}</tbody></table></div></>}
      {colsChanged && <><div className="eyebrow">Kolom SO / buyer</div>
        <div className="colcmp"><div><div className="muted small">Sebelum</div>{colList(colsFrom)}</div><div><div className="muted small">Sesudah</div>{colList(colsTo)}</div></div>
        <button className="btn ghost sm" onClick={actions.revertColumns}>Batalkan perubahan kolom</button></>}</>
    foot = count === 0 ? <button className="btn" onClick={onClose}>Tutup</button>
      : <><button className="btn" disabled={busy} onClick={() => run(false)}>{busy ? 'Menyimpan…' : `Simpan ke database (${count})`}</button>
        <button className="btn ghost" disabled={busy} onClick={onClose}>Kembali</button></>
  }
  if (busy) foot = <><button className="btn" disabled>Menyimpan…</button><span className="muted small">Mohon tunggu, jangan tutup halaman.</span></>

  return <div className="overlay mid" onClick={() => !busy && onClose()}>
    <div className="sheet wide" onClick={e => e.stopPropagation()}>
      <div className="sbody">{busy && phase === 'saving' && !body ? null : body}</div>
      <div className="sfoot">{foot}</div>
    </div></div>
}
