import { useApp } from '../../context/AppContext'
import { useKids, update } from '../store'
import { QUESTS, QUEST_STARS, SELF_REPORT, STICKERS, completeQuest, weekStars } from '../progress'
import { kidsText } from '../text'
import { KTabBar, Star, celebrate } from '../ui'

export default function KidsStars() {
  const { lang } = useApp()
  const { profile, progress } = useKids()
  const k = kidsText(lang), t = k.starsScreen
  const quests = QUESTS[profile.band] || QUESTS.explorer
  const done = progress.quests.done || {}
  const have = new Set(progress.stickers)

  return (
    <>
      <div className="k-scroll pad">
        <h1 className="k-title solo">{t.title}</h1>
        <div className="k-trophy">
          <span className="k-trophy-ic" aria-hidden="true">🏆</span>
          <div>
            <b className="num">{weekStars(progress)}</b>
            <span>{t.week} · {t.streak(progress.streak)}</span>
          </div>
        </div>

        <h2 className="k-h2">{t.stickers}</h2>
        <div className="k-stickers">
          {STICKERS.map((s) => (
            <div key={s.id} className={`k-sticker${have.has(s.id) ? ' got' : ''}`} title={t.stickerNames[s.id]}>
              <span aria-hidden="true" lang={s.id === 'letters' ? 'ar' : undefined}>{have.has(s.id) ? s.pic : '🔒'}</span>
              <small>{t.stickerNames[s.id]}</small>
            </div>
          ))}
        </div>

        <h2 className="k-h2">{t.today}</h2>
        <ul className="k-quests">
          {quests.map((q) => {
            const self = SELF_REPORT.includes(q)
            return (
              <li key={q}>
                <button type="button" className={`k-quest${done[q] ? ' done' : ''}`} disabled={!!done[q] || !self}
                  aria-pressed={!!done[q]} onClick={() => celebrate(update(completeQuest, q))}>
                  <span className="k-check" aria-hidden="true">{done[q] ? '✓' : ''}</span>
                  <span className="k-quest-t">{t.quests[q]}{self && !done[q] && <small>{t.tick}</small>}</span>
                  <span className="k-quest-s num">+{QUEST_STARS[q]} <Star size={14} /></span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <KTabBar />
    </>
  )
}
