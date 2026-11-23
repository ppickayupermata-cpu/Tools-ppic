import { useEffect, useState } from 'react'
import { login } from '../lib/store.js'
export default function Login({ onLogin }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [health, setHealth] = useState(null)
  useEffect(() => { fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth({ down: true })) }, [])
  const warn = !health ? null
    : health.down ? 'API belum berjalan. Jalankan dengan "npm run dev" (atau "npx vercel dev") dari folder proyek, lalu buka ulang halaman ini.'
    : health.usersError ? 'File .env terbaca server, tetapi APP_USERS bermasalah: ' + health.usersError
    : !health.hasDatabaseUrl ? 'Login siap, tetapi DATABASE_URL belum terbaca dari .env (data tidak akan bisa disimpan).' : null
  const submit = async () => {
    setBusy(true); setErr('')
    try { onLogin(await login(u.trim(), p)) } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <div className="loginwrap"><div className="glow" />
      <div className="card login">
        <div className="brand"><span className="diamond" />PPIC Tools</div>
        <h1>Masuk</h1><p className="muted">Pantau stok material dan kebutuhan SO.</p>
        <label>Username<input value={u} onChange={e => setU(e.target.value)} autoFocus autoCapitalize="none" /></label>
        <label>Password<input type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} /></label>
        {warn && <div className="banner">{warn}</div>}
        {err && <div className="err">{err}</div>}
        <button className="btn full" onClick={submit} disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
      </div>
    </div>
  )
}
