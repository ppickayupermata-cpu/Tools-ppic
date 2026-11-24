import { useEffect, useState } from 'react'
import { login } from '../lib/store.js'

const Eye = ({ off }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? <><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 4.06-5.06M9.9 4.24A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></>
      : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>)

export default function Login({ onLogin }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [show, setShow] = useState(false)
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [health, setHealth] = useState(null)
  useEffect(() => { fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth({ down: true })) }, [])
  const warn = !health ? null
    : health.down ? 'API belum berjalan. Jalankan dengan "npm run dev" (atau "npx vercel dev") dari folder proyek, lalu buka ulang halaman ini.'
    : health.usersError ? 'File .env terbaca server, tetapi APP_USERS bermasalah: ' + health.usersError
    : !health.hasDatabaseUrl ? 'Login siap, tetapi DATABASE_URL belum terbaca dari .env (data tidak akan bisa disimpan).' : null
  const submit = async e => {
    e?.preventDefault(); if (busy) return
    setBusy(true); setErr('')
    try { onLogin(await login(u.trim(), p)) } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <div className="loginwrap"><div className="glow" />
      <form className="card login" onSubmit={submit}>
        <div className="brand"><span className="diamond" />PPIC Tools</div>
        <h1>Masuk</h1><p className="muted">Pantau stok material dan kebutuhan SO.</p>
        <label>Username<input value={u} onChange={e => setU(e.target.value)} autoFocus autoCapitalize="none" autoComplete="username" /></label>
        <label>Password
          <div className="pwwrap">
            <input type={show ? 'text' : 'password'} value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" />
            <button type="button" className="eye" onMouseDown={e => e.preventDefault()} onClick={() => setShow(s => !s)}
              aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'} title={show ? 'Sembunyikan password' : 'Tampilkan password'}><Eye off={show} /></button>
          </div>
        </label>
        {warn && <div className="banner">{warn}</div>}
        {err && <div className="err">{err}</div>}
        <button type="submit" className="btn full" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
      </form>
    </div>
  )
}
