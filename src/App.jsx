import { useEffect, useState } from 'react'
import { useData, getSession, logout } from './lib/store.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Monitoring from './pages/Monitoring.jsx'
import Upload from './pages/Upload.jsx'
import ReservasiViewer from './components/ReservasiViewer.jsx'
import SubmitReview from './components/SubmitReview.jsx'
import PageSkeleton from './components/Skeleton.jsx'

const NAV = [['dashboard', 'Beranda', '⌂'], ['monitoring', 'Stok', '☰'], ['upload', 'Upload', '⇪']]
const CATS = ['CAT', 'Hardware', 'Karton']

export default function App() {
  const [user, setUser] = useState(getSession())
  if (!user) return <Login onLogin={setUser} />
  return <Shell user={user} onLogout={() => { logout(); setUser(null) }} />
}

function Shell({ user, onLogout }) {
  const { data, status, actions, changes } = useData(onLogout)
  const [page, setPage] = useState('dashboard'), [cat, setCat] = useState('CAT')
  const [showRes, setShowRes] = useState(false), [review, setReview] = useState(false)
  const P = { dashboard: Dashboard, monitoring: Monitoring, upload: Upload }[page]
  const go = (p, c) => { if (c) setCat(c); setPage(p) }
  const showCat = page !== 'dashboard'
  useEffect(() => {
    if (!changes.count) return
    const h = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h)
  }, [changes.count])
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="diamond" />PPIC Tools</div>
        <div className="eyebrow">Menu</div>
        {NAV.map(([k, l]) => <button key={k} className={'nav' + (page === k ? ' on' : '')} onClick={() => setPage(k)}>{l}</button>)}
        {showCat && <><div className="eyebrow">Kategori</div>
          <div className="cats">{CATS.map(c => <button key={c} className={'pill' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}</div></>}
        <div className="grow" />
        <div className="mono small muted">{status.saving > 0 ? 'Menyimpan…' : changes.count ? 'Ada perubahan belum disubmit' : 'Tersimpan di database'}</div>
        <div className="mono small">{user.u} · {user.role}</div>
        <button className="btn ghost" onClick={onLogout}>Keluar</button>
      </aside>
      <div className="topbar">
        <div className="brand" style={{ margin: 0 }}><span className="diamond" />PPIC</div>
        {showCat && <select value={cat} onChange={e => setCat(e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select>}
        <div className="grow" />
        <button className="btn ghost sm" onClick={() => setShowRes(true)}>▤ RESERVASI</button>
        <button className="btn ghost sm" onClick={onLogout}>Keluar</button>
      </div>
      <main className="main">
        <div className="pagebar"><button className="btn ghost sm" onClick={() => setShowRes(true)}>▤ Tabel RESERVASI</button></div>
        {status.error && <div className="banner">{status.error}<button className="x2" onClick={actions.clearError}>×</button></div>}
        {status.loading ? <PageSkeleton page={page} />
          : page !== 'dashboard' && cat !== 'CAT' ? <div className="card blankcat"><div className="cathead"><h2>{cat}</h2><span className="badge zero">Belum dirilis</span></div><div className="blank" /></div>
          : <P data={data} actions={actions} go={go} changes={changes} />}
      </main>
      {changes.count > 0 && <button className="subpill" onClick={() => setReview(true)}>
        <span className="dotc">{changes.count}</span> perubahan · Tinjau &amp; Submit</button>}
      {review && <SubmitReview changes={changes} actions={actions} onClose={() => setReview(false)} />}
      <nav className="bottomnav">{NAV.map(([k, l, i]) => <button key={k} className={page === k ? 'on' : ''} onClick={() => setPage(k)}><span>{i}</span>{l}</button>)}</nav>
      {showRes && <ReservasiViewer onClose={() => setShowRes(false)} />}
    </div>
  )
}
