import { useMemo, useState } from 'react'
import { parseWorkbook, parseReservasiFile, fmt } from '../lib/calc.js'

// Alur aman: pilih file → periksa ringkasan & peringatan → klik "Submit ke database". Tidak ada yang tersimpan sebelum Submit.
export default function Upload({ data, actions, go, changes }) {
  const [stage, setStage] = useState(null), [mode, setMode] = useState('merge'), [busy, setBusy] = useState(false)
  const [prog, setProg] = useState(''), [result, setResult] = useState(null)
  const kodes = useMemo(() => new Set(data.materials.map(m => m.kode)), [data.materials])

  const pick = kind => async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return
    setResult(null); setStage(null); setBusy(true)
    try {
      if (kind === 'res') {
        const rows = await parseReservasiFile(f)
        if (!rows.length) throw new Error('Tidak ada baris data. Pastikan ada kolom SO NUMBER dan KODE MATERIAL.')
        const keys = new Set(); let dup = 0, zero = 0; const unk = new Set()
        rows.forEach(r => { const k = r.so + '|' + r.kode; keys.has(k) ? dup++ : keys.add(k); if (!r.qty) zero++; if (kodes.size && !kodes.has(r.kode)) unk.add(r.kode) })
        setStage({ kind: 'res', name: f.name, rows, soN: new Set(rows.map(r => r.so)).size, dup, zero, unk: unk.size })
      } else {
        const r = await parseWorkbook(f)
        if (!r.reservasi && !r.stok) throw new Error('Sheet RESERVASI atau STOK SAP tidak ditemukan di file ini')
        setStage({ kind: 'all', name: f.name, r })
      }
    } catch (err) { setResult({ ok: false, text: err.message }) }
    setBusy(false)
  }
  const progress = (a, b) => setProg(`Mengirim RESERVASI ${fmt(a)} / ${fmt(b)} baris…`)
  const submit = async () => {
    if (stage.kind === 'all' && changes.count) return setResult({ ok: false, text: 'Ada perubahan stok/PO yang belum disubmit. Submit atau batalkan dulu lewat bar di bagian bawah.' })
    if (stage.kind === 'res' && mode === 'replace' && !confirm(`Semua RESERVASI lama akan DIHAPUS dan diganti ${fmt(stage.rows.length)} baris baru. Lanjutkan?`)) return
    if (stage.kind === 'all' && data.materials.length && !confirm('Daftar material/stok dan seluruh RESERVASI yang ada akan DIGANTI. Lanjutkan?')) return
    setBusy(true); setResult(null)
    try {
      if (stage.kind === 'res') { await actions.uploadReservasi(stage.rows, mode, progress); setResult({ ok: true, text: `Berhasil disimpan: ${fmt(stage.rows.length)} baris dari ${fmt(stage.soN)} SO.` }) }
      else { await actions.uploadAll(stage.r, progress); setResult({ ok: true, text: `Berhasil disimpan: ${stage.r.stok?.length ?? 0} material, ${stage.r.reservasi?.length ?? 0} baris RESERVASI.` }) }
      setStage(null)
    } catch (e) { setResult({ ok: false, text: 'Gagal menyimpan: ' + e.message }) }
    setBusy(false); setProg('')
  }
  const resetAll = async () => {
    if (prompt('Ini menghapus SEMUA data di database. Ketik HAPUS untuk melanjutkan:') !== 'HAPUS') return
    try { await actions.reset() } catch {}
  }
  const refresh = () => (!changes.count || confirm('Perubahan yang belum disubmit akan hilang. Lanjutkan?')) && actions.refresh()

  return (<>
    <h1>Upload Data</h1>
    <p className="muted small">Pilih file, periksa ringkasannya, lalu tekan <b>Submit ke database</b>. Sebelum Submit, tidak ada data yang diubah.</p>
    <div className="card">
      <h2>1. Upload RESERVASI</h2>
      <p className="muted">Kolom: <b>SO NUMBER, KODE MATERIAL, Sales Order, QTY, UoM</b>. Setelah tersimpan, tempel No. SO di kolom SO pada menu Stok untuk mengisi QTY dan UoM otomatis.</p>
      <div className="chips">
        <button className={'pill' + (mode === 'merge' ? ' on' : '')} onClick={() => setMode('merge')}>Tambah / perbarui per SO</button>
        <button className={'pill' + (mode === 'replace' ? ' on' : '')} onClick={() => setMode('replace')}>Ganti semua</button>
      </div>
      <p className="muted small">{mode === 'merge' ? 'SO yang ada di file diperbarui; SO lain yang sudah tersimpan tidak disentuh.' : 'Seluruh RESERVASI lama dihapus lalu diganti isi file.'}</p>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={pick('res')} disabled={busy} />
    </div>
    <div className="card">
      <h2>2. Upload Data All</h2>
      <p className="muted">File Excel lengkap (sheet <b>STOK SAP</b>, <b>RESERVASI</b>, header <b>RESUME CAT</b>). Mengganti daftar material, stok, dan seluruh RESERVASI.</p>
      <input type="file" accept=".xlsx,.xls" onChange={pick('all')} disabled={busy} />
    </div>

    {stage && <div className="card review">
      <div className="eyebrow">Periksa sebelum submit · {stage.name}</div>
      {stage.kind === 'res' ? <ul className="chlist">
        <li><b>{fmt(stage.rows.length)}</b> baris dari <b>{fmt(stage.soN)}</b> SO akan {mode === 'merge' ? 'ditambahkan / memperbarui SO yang sama' : 'menggantikan seluruh RESERVASI'}</li>
        {stage.unk > 0 && <li className="warn">{fmt(stage.unk)} kode material tidak ada di daftar stok (tidak akan tampil di Monitoring)</li>}
        {stage.dup > 0 && <li className="warn">{fmt(stage.dup)} baris duplikat (SO + KODE sama); QTY-nya akan dijumlahkan</li>}
        {stage.zero > 0 && <li className="warn">{fmt(stage.zero)} baris QTY-nya 0 atau kosong</li>}
        {!stage.unk && !stage.dup && !stage.zero && <li className="ok">Tidak ada masalah ditemukan</li>}
      </ul> : <ul className="chlist">
        <li>Material (STOK SAP): <b>{fmt(stage.r.stok?.length ?? 0)}</b>{!stage.r.stok && <span className="warn"> — sheet tidak ada, daftar material tidak diubah</span>}</li>
        <li>RESERVASI: <b>{fmt(stage.r.reservasi?.length ?? 0)}</b> baris{!stage.r.reservasi && <span className="warn"> — sheet tidak ada, RESERVASI lama dipertahankan</span>}</li>
        <li>Kolom SO dari RESUME CAT: <b>{stage.r.columns?.length ?? 0}</b>{data.columns.length > 0 && ' (diabaikan, kolom yang sudah ada dipertahankan)'}</li>
      </ul>}
      <div className="row"><button className="btn" onClick={submit} disabled={busy}>{busy ? 'Menyimpan…' : 'Submit ke database'}</button>
        <button className="btn ghost" onClick={() => setStage(null)} disabled={busy}>Batal</button></div>
    </div>}
    {busy && <div className="card muted">{prog || 'Memproses…'}</div>}
    {result && <div className={'card ' + (result.ok ? 'ok' : 'err')}>{result.text}</div>}

    <div className="card"><div className="eyebrow">Data tersimpan di database</div>
      <div className="mono">Material {fmt(data.materials.length)} · RESERVASI {fmt(data.stats.rowCount)} baris / {fmt(data.stats.soCount)} SO · Kolom SO aktif {data.columns.length}</div>
      <p className="muted small">Data RESERVASI diambil dari database hanya untuk SO yang dipakai, lalu disimpan sementara di perangkat ini. Kalau data diubah dari perangkat lain, tekan “Muat ulang”.</p>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => go('monitoring')}>Buka Stok</button>
        <button className="btn ghost" onClick={refresh}>Muat ulang dari database</button>
        <button className="btn ghost" onClick={resetAll}>Hapus semua data</button>
      </div>
    </div>
  </>)
}
