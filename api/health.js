import { users } from './_auth.js'
// Cek cepat: apakah .env terbaca? (tidak membocorkan isi apa pun)
export default function handler(req, res) {
  let userCount = 0, usersError = null
  try { userCount = users().length } catch (e) { usersError = e.message }
  res.json({ ok: true, userCount, usersError, hasDatabaseUrl: !!process.env.DATABASE_URL })
}
