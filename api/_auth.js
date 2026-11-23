import crypto from 'node:crypto'
const secret = () => process.env.SESSION_SECRET || 'ppic-tools-secret-ganti-ini'
// User dibaca dari env APP_USERS berupa JSON array, contoh:
// APP_USERS='[{"u":"admin","p":"rahasia1","role":"Admin"},{"u":"ppic","p":"rahasia2","role":"PPIC"}]'
export function users() {
  let a
  try { a = JSON.parse(process.env.APP_USERS || '') } catch { a = null }
  if (!Array.isArray(a) || !a.length) throw new Error('APP_USERS belum diisi atau bukan JSON array yang valid')
  return a
}
const same = (x, y) => { const a = Buffer.from(String(x)), b = Buffer.from(String(y)); return a.length === b.length && crypto.timingSafeEqual(a, b) }
export const checkUser = (u, p) => users().find(x => same(x.u, String(u || '').trim()) && same(x.p, p || '')) || null
const mac = b => crypto.createHmac('sha256', secret()).update(b).digest('base64url')
export function sign(payload) {
  const b = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 12 * 3600e3 })).toString('base64url')
  return b + '.' + mac(b)
}
export function verify(req) {
  const [b, h] = (req.headers.authorization || '').replace('Bearer ', '').split('.')
  if (!b || !h || h.length !== mac(b).length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(mac(b)))) return null
  try { const p = JSON.parse(Buffer.from(b, 'base64url')); return p.exp > Date.now() ? p : null } catch { return null }
}
