import * as XLSX from 'xlsx'

// Balance = STOK SAP - SUM(qty semua SO aktif)  (sama dengan =C4-SUM(E4:AZ4) di Excel)
const cache = new WeakMap()
function index(reservasi) {
  let m = cache.get(reservasi)
  if (!m) {
    m = new Map()
    for (const r of reservasi) {
      const k = String(r.so).trim() + '|' + r.kode, c = m.get(k)
      c ? (c.qty += r.qty) : m.set(k, { qty: r.qty, uom: r.uom || '' })
    }
    cache.set(reservasi, m)
  }
  return m
}
const NONE = { qty: 0, uom: '' }
// Ambil QTY + UoM dari RESERVASI berdasarkan No. SO + KODE MATERIAL
export function cellOf(reservasi, so, kode) {
  const s = String(so ?? '').trim()
  return s ? index(reservasi).get(s + '|' + kode) || NONE : NONE
}
export const qtyOf = (reservasi, so, kode) => cellOf(reservasi, so, kode).qty
export function balanceOf(m, columns, reservasi) {
  const used = columns.reduce((s, c) => s + qtyOf(reservasi, c.so, m.kode), 0)
  return { used, balance: (Number(m.stok) || 0) - used }
}
export const fmt = n => (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('id-ID')

const norm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
export function parseReservasiRows(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
  let start = 1, ix = { so: 0, kode: 1, desk: 2, qty: 3, uom: 4 }
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const h = rows[i].map(norm)
    if (h.includes('sonumber') && h.includes('kodematerial')) {
      const g = (n, d) => h.indexOf(n) >= 0 ? h.indexOf(n) : d
      ix = { so: h.indexOf('sonumber'), kode: h.indexOf('kodematerial'), desk: g('salesorder', 2), qty: g('qty', 3), uom: g('uom', 4) }
      start = i + 1; break
    }
  }
  const num = x => typeof x === 'number' ? x : Number(String(x).replace(',', '.')) || 0
  return rows.slice(start).map(r => ({
    so: String(r[ix.so] ?? '').replace(/\s+/g, ''), kode: String(r[ix.kode] ?? '').trim(),
    desk: String(r[ix.desk] ?? ''), qty: num(r[ix.qty]), uom: String(r[ix.uom] ?? '').trim(),
  })).filter(r => r.so && r.kode)
}
export async function parseReservasiFile(file) {
  const wb = XLSX.read(await file.arrayBuffer())
  return parseReservasiRows(wb.Sheets['RESERVASI'] || wb.Sheets[wb.SheetNames[0]])
}
// Parse workbook lengkap: RESERVASI, STOK SAP, dan header RESUME CAT (buyer baris 1, SO baris 2, kolom E..AZ)
export async function parseWorkbook(file) {
  const wb = XLSX.read(await file.arrayBuffer())
  const out = {}
  if (wb.Sheets['RESERVASI']) out.reservasi = parseReservasiRows(wb.Sheets['RESERVASI'])
  const sap = wb.Sheets['STOK SAP']
  if (sap) {
    out.stok = XLSX.utils.sheet_to_json(sap, { header: 1, raw: true }).slice(1)
      .filter(r => r[0]).map(r => ({ kode: String(r[0]).trim(), desk: r[1] || '', uom: r[2] || '', stok: Number(r[3]) || 0 }))
  }
  const rc = wb.Sheets['RESUME CAT']
  if (rc) {
    const rows = XLSX.utils.sheet_to_json(rc, { header: 1, raw: true })
    const cols = []
    for (let i = 4; i <= 51; i++) if (rows[1] && rows[1][i]) cols.push({ buyer: String(rows[0]?.[i] || ''), so: String(rows[1][i]).replace(/\s+/g, '') })
    out.columns = cols
  }
  return out
}
export function exportXlsx(materials, columns, reservasi, plan) {
  const head1 = ['KODE MATERIAL', 'DESKRIPSI', 'STOK SAP', 'UoM', ...columns.map(c => c.buyer), 'BALANCE', 'RENCANA', 'RENCANA', 'RENCANA']
  const head2 = ['', '', '', '', ...columns.map(c => c.so), 'STOK', 'PO', 'PO 2', 'PO3']
  const rows = materials.map(m => {
    const p = plan[m.kode] || {}
    return [m.kode, m.desk, m.stok, m.uom, ...columns.map(c => qtyOf(reservasi, c.so, m.kode)), balanceOf(m, columns, reservasi).balance, p.po1 || '', p.po2 || '', p.po3 || '']
  })
  const ws = XLSX.utils.aoa_to_sheet([head1, head2, ...rows])
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'RESUME CAT')
  XLSX.writeFile(wb, 'RESUME_CAT_export.xlsx')
}
