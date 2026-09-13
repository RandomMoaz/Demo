import { useApp } from '../context/AppContext'
import { RashedAvatar } from './Lottie'

export function StatusBar() {
  return (
    <div className="statusbar">
      <span>9:41</span>
      <svg width="44" height="11" viewBox="0 0 46 11" fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="1" y="7" width="2" height="3" fill="currentColor" />
        <rect x="5" y="5" width="2" height="5" fill="currentColor" />
        <rect x="9" y="3" width="2" height="7" fill="currentColor" />
        <rect x="13" y="1" width="2" height="9" fill="currentColor" opacity=".35" />
        <path d="M22 8a6 6 0 0 1 8 0" />
        <path d="M20 5.6a9 9 0 0 1 12 0" />
        <circle cx="26" cy="9.6" r="1" fill="currentColor" stroke="none" />
        <rect x="35" y="2" width="9" height="7" rx="1.6" />
        <rect x="36.2" y="3.2" width="5.5" height="4.6" rx=".8" fill="currentColor" stroke="none" />
        <path d="M45 4.5v2" />
      </svg>
    </div>
  )
}

export function TabBar() {
  const { go, screen, t } = useApp()
  const item = (key, target, icon) => (
    <button className={screen === target ? 'on' : ''} onClick={() => go(target)}>
      {icon}
      <span>{t.nav[key]}</span>
    </button>
  )
  const I = {
    home: <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>,
    learn: <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6c-2-1.6-5-2-8-2v14c3 0 6 .4 8 2 2-1.6 5-2 8-2V4c-3 0-6 .4-8 2z" /><path d="M12 6v14" /></svg>,
    map: <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.4-7-11a7 7 0 0 1 14 0c0 5.6-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>,
    more: <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></svg>,
  }
  return (
    <nav className="tabbar">
      {item('home', 'home', I.home)}
      {item('learn', 'journey', I.learn)}
      <button onClick={() => go('rashed')} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
        <span className="fab"><RashedAvatar /></span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)' }}>{t.nav.rashed}</span>
      </button>
      {item('map', 'map', I.map)}
      {item('more', 'more', I.more)}
    </nav>
  )
}
