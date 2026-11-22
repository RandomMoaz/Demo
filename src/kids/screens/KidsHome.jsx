import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { savedLocation } from '../../lib/location'
import { prayerTimes, nextPrayer } from '../../lib/prayerTimes'
import { prayerName } from '../../lib/alarms'
import { useKids } from '../store'
import { kidsText } from '../text'
import { Noor, StarPill, KTabBar, SpeakBtn } from '../ui'

const TILES = [
  { key: 'prayer', to: 'kids-prayer', tint: 'mint', ic: '🧎' },
  { key: 'letters', to: 'kids-letters', tint: 'sky', ic: 'أب' },
  { key: 'quiz', to: 'kids-quiz', tint: 'peach', ic: '❓' },
  { key: 'wudu', to: 'kids-wudu', tint: 'sky', ic: '💧' },
  { key: 'names', to: 'kids-names', tint: 'butter', ic: '⭐' },
  { key: 'surahs', to: 'kids-surahs', tint: 'lilac', ic: '📖' },
]

/** Noor's one tip: the next prayer if a grown-up's location is already on this device, otherwise a daily tip. */
function useTip(k, lang, loc) {
  return useMemo(() => {
    const where = loc || savedLocation()
    if (where) {
      const now = new Date()
      const next = nextPrayer(prayerTimes(where.lat, where.lng, now), now)
      const mins = Math.round(next.ms / 60000)
      if (mins <= 180) {
        const when = mins < 60 ? k.inMin(mins) : k.inHour(Math.round(mins / 60))
        return { text: k.noorPrayer(prayerName(next.key, lang), when), to: 'kids-prayer' }
      }
    }
    return { text: k.tips[new Date().getDate() % k.tips.length], to: 'kids-stars' }
  }, [k, lang, loc])
}

export default function KidsHome() {
  const { lang, go, loc } = useApp()
  const { profile } = useKids()
  const k = kidsText(lang)
  const tip = useTip(k, lang, loc)
  return (
    <>
      <div className="k-scroll">
        <header className="k-home-top">
          <div>
            <h1 className="k-hello">{k.hi(profile.name)}</h1>
            <div className="k-salam" lang="ar">السلام عليكم</div>
          </div>
          <StarPill />
        </header>

        <button type="button" className="k-noor-card" onClick={() => go(tip.to)}>
          <Noor size={profile.band === 'young' ? 52 : 70} wave />
          <span>{tip.text}</span>
        </button>
        <div className="k-noor-say"><SpeakBtn text={tip.text} /></div>

        <h2 className="k-h2">{k.adventures}</h2>
        <div className="k-tiles">
          {TILES.map((tl) => {
            const [name, sub] = k.tiles[tl.key]
            return (
              <button key={tl.key} type="button" className={`k-tile t-${tl.tint}`} onClick={() => go(tl.to)}>
                <span className={`k-tile-ic${tl.key === 'letters' ? ' ar' : ''}`} aria-hidden="true">{tl.ic}</span>
                <b>{name}</b>
                <small>{sub}</small>
              </button>
            )
          })}
        </div>
      </div>
      <KTabBar />
    </>
  )
}
