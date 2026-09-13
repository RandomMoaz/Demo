import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { AYAT, FEATURES, PERSONAS } from '../lib/data'
import { prayerTimes, nextPrayer, fmtTime, fmtRemaining, hijriDate } from '../lib/prayerTimes'
import { TabBar } from '../components/Chrome'
import { Anim } from '../components/Lottie'

function useNextPrayer(loc, lang) {
  // real prayer times from the user's coordinates (falls back to Makkah if unknown)
  const coords = loc || { lat: 21.3891, lng: 39.8579 }
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const times = useMemo(() => prayerTimes(coords.lat, coords.lng, now), [coords.lat, coords.lng, now.getDate()])
  const next = nextPrayer(times, now)
  const list = times.filter((t) => !t.info)
  const idx = list.findIndex((p) => p.key === next.key)
  const prev = idx > 0 ? list[idx - 1] : list[list.length - 1]
  // progress between the previous prayer and the next
  let pct = 6
  if (prev?.date && next?.date) {
    const span = next.date - (prev.date > next.date ? prev.date - 864e5 : prev.date)
    const done = now - (prev.date > next.date ? prev.date - 864e5 : prev.date)
    pct = 6 + Math.min(1, Math.max(0, done / span)) * 90
  }
  return { times, list, next, pct, remaining: fmtRemaining(next.ms), now }
}

export default function Home() {
  const { t, lang, persona, name, go, theme, setTheme, loc } = useApp()
  const { list, next, pct, remaining } = useNextPrayer(loc, lang)
  const [ayah, setAyah] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setAyah((i) => (i + 1) % AYAT.length), 6000)
    return () => clearInterval(id)
  }, [])

  const p = PERSONAS[persona]
  const tile = (key) => {
    const f = FEATURES[key]; const [nm, desc] = t.tiles[key]
    const cls = 'tile' + (f.span ? ' span2' : '') + (f.lead ? ' lead' : '')
    return (
      <button key={key} className={cls} onClick={() => f.screen && go(f.screen)}>
        <span className="ic" style={{ fontSize: 18 }}>{f.ic}</span>
        <span className="ar-tag">{f.ar}</span>
        <span className="name">{nm}</span>
        <span className="desc">{desc}</span>
      </button>
    )
  }

  return (
    <>
      <div className="scroll" dir={t.dir}>
        <div className="h-top">
          <div>
            <div className="greet">{name ? t.greetHi(name) : 'السلام عليكم'}</div>
            <div className="sub">{t.greetSub[persona]}</div>
          </div>
          <div className="rashed-av" style={{ width: 56, height: 56 }}><Anim name="salam" /></div>
          <button className="icon-btn" aria-label="theme" onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}>
            {theme === 'night'
              ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
              : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5" /></svg>}
          </button>
        </div>

        {/* prayer countdown card */}
        <div className="arc-card">
          <div className="pc-top">
            <div className="pc-mosque"><Anim name="mosque" style={{ width: 78 }} /></div>
            <div style={{ flex: 1 }}>
              <div className="pc-name ar">{next.ar} <em className="latin">{fmtTime(next.date, lang)}</em></div>
              <div className="pc-count latin">{remaining} <b>{t.remain}</b></div>
              <div className="pc-date ar">{hijriDate()}</div>
            </div>
          </div>
          <div className="pc-bar"><div style={{ width: pct + '%' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            {list.map((p2) => (
              <div key={p2.key} style={{ flex: 1, textAlign: 'center' }}>
                <div className="ar" style={{ fontSize: 12.5, color: p2.key === next.key ? 'var(--coral)' : 'var(--muted)', fontWeight: p2.key === next.key ? 700 : 400 }}>{p2.ar}</div>
                <div className="latin" style={{ fontSize: 10.5, color: p2.key === next.key ? 'var(--coral)' : 'var(--muted)', marginTop: 2 }}>{fmtTime(p2.date, lang)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ayah card */}
        <div className="ayah-card">
          <div className="ayah-head"><span style={{ color: 'var(--gold)' }}>۞</span><span className="lab">{t.ayahLab}</span></div>
          <div className="ayah-verse ar">{AYAT[ayah].v}</div>
          <div className="ayah-mean">{t.dir === 'rtl' ? AYAT[ayah].ar : AYAT[ayah].en}</div>
          <div className="ayah-dots">{AYAT.map((_, i) => <i key={i} className={i === ayah ? 'on' : ''} />)}</div>
        </div>

        <div className="sec">
          <div className="sec-h"><span className="eyebrow">{t.labPractice}</span><span className="ar-lab">تدريب</span></div>
          <div className="tiles">{p.practice.map(tile)}</div>
        </div>
        <div className="sec" style={{ paddingBottom: 22 }}>
          <div className="sec-h"><span className="eyebrow">{t.labDaily}</span><span className="ar-lab">يومي</span></div>
          <div className="tiles">{p.daily.map(tile)}</div>
        </div>
      </div>
      <TabBar />
    </>
  )
}
