import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useKids } from './store'
import { kidsText } from './text'
import { say, hush } from './lib'

/** Noor, the crescent-moon mascot. */
export function Noor({ size = 64, wave = false }) {
  return (
    <svg className={`k-noor${wave ? ' wave' : ''}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <mask id="noor-cut"><rect width="100" height="100" fill="#fff" /><circle cx="66" cy="38" r="33" fill="#000" /></mask>
        <radialGradient id="noor-glow" cx="40%" cy="40%" r="70%"><stop offset="0" stopColor="#F6D77E" /><stop offset="1" stopColor="#E4B94F" /></radialGradient>
      </defs>
      <circle cx="48" cy="52" r="40" fill="url(#noor-glow)" mask="url(#noor-cut)" />
      <path d="M22 54q4-4 8 0M34 60q4-4 8 0" fill="none" stroke="#5B4214" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 68q8 7 16 0" fill="none" stroke="#5B4214" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="64" r="4" fill="#F29C82" opacity=".55" />
      <path d="M80 14l2.6 6 6.4.6-4.9 4.2 1.5 6.3L80 27.8l-5.6 3.3 1.5-6.3L71 20.6l6.4-.6z" fill="#E4B94F" />
    </svg>
  )
}

export const Star = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" fill="#E4B94F" stroke="#A8823C" strokeWidth="1.2" strokeLinejoin="round" /></svg>
)

export function StarPill() {
  const { progress } = useKids()
  return <span className="k-stars-pill num" aria-label={`${progress.stars} stars`}><Star />{progress.stars}</span>
}

export function Back({ onClick, label }) {
  return (
    <button type="button" className="k-back" onClick={onClick} aria-label={label}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
  )
}

/** Title bar: back, title, and the star counter (or anything in `right`). */
export function KTop({ title, right, speak }) {
  const { back, lang } = useApp()
  const k = kidsText(lang)
  return (
    <header className="k-top">
      <Back onClick={() => { hush(); back() }} label={k.back} />
      <h1 className="k-title">{title}</h1>
      {speak && <SpeakBtn text={speak} />}
      <span className="k-top-r">{right ?? <StarPill />}</span>
    </header>
  )
}

/** A speaker button that reads `text` aloud (shown when read-aloud is on in Parents). */
export function SpeakBtn({ text, big = false, label }) {
  const { lang } = useApp()
  const { profile } = useKids()
  if (!profile.voice || typeof window === 'undefined' || !window.speechSynthesis) return null
  return (
    <button type="button" className={`k-speak${big ? ' big' : ''}`} aria-label={label || kidsText(lang).readAloud} onClick={() => say(text, lang)}>
      <svg width={big ? 26 : 20} height={big ? 26 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
    </button>
  )
}

const ICON = {
  home: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  stars: <path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  parents: <><rect x="6" y="10.5" width="12" height="9" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" /></>,
}

export function KTabBar() {
  const { screen, go, lang } = useApp()
  const k = kidsText(lang)
  const item = (key, target) => (
    <button type="button" className={screen === target ? 'on' : ''} aria-current={screen === target ? 'page' : undefined} onClick={() => { hush(); if (screen !== target) go(target) }}>
      <span className="k-tab-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">{ICON[key]}</svg></span>
      <span>{k.tabs[key]}</span>
    </button>
  )
  return <nav className="k-tabbar">{item('home', 'kids')}{item('stars', 'kids-stars')}{item('parents', 'kids-parents')}</nav>
}

/* ---- celebration bubble: "+1 ★" and new stickers ---- */
const listeners = new Set()
export function celebrate(gain) {
  if (gain && (gain.stars > 0 || gain.stickers?.length)) listeners.forEach((f) => f(gain))
}

export function Celebrations() {
  const { lang } = useApp()
  const k = kidsText(lang)
  const [item, setItem] = useState(null)
  useEffect(() => {
    let timer
    const on = (g) => { setItem({ ...g, key: Date.now() }); clearTimeout(timer); timer = setTimeout(() => setItem(null), g.stickers?.length ? 2600 : 1400) }
    listeners.add(on)
    return () => { listeners.delete(on); clearTimeout(timer) }
  }, [])
  if (!item) return null
  return (
    <div key={item.key} className="k-celebrate" role="status" aria-live="polite">
      {item.stars > 0 && <span className="k-plus num">+{item.stars} <Star size={22} /></span>}
      {item.stickers?.length > 0 && <span className="k-new-sticker">{k.newSticker}</span>}
    </div>
  )
}
