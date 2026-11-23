import { checkUser, sign } from './_auth.js'
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const { u, p } = req.body || {}
    const x = checkUser(u, p)
    if (!x) return res.status(401).json({ error: 'Username atau password salah' })
    res.json({ token: sign({ u: x.u, role: x.role || 'User' }), user: { u: x.u, role: x.role || 'User' } })
  } catch (e) { res.status(500).json({ error: e.message }) }
}
