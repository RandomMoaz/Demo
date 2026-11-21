import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import data from '../content/names.json'
import { useKids, update } from '../store'
import { collectName } from '../progress'
import { kidsText } from '../text'
import { say } from '../lib'
import { KTop, Star, celebrate } from '../ui'

const NAMES = data.names

export default function KidsNames() {
  const { lang } = useApp()
  const { progress } = useKids()
  const k = kidsText(lang), t = k.names
  const got = new Set(progress.namesCollected)
  const [i, setI] = useState(() => Math.max(0, NAMES.findIndex((n) => !got.has(n.id))))
  const n = NAMES[i]
  const have = got.has(n.id)

  return (
    <div className="k-screen">
      <KTop title={t.title} right={<span className="k-count num">{got.size} / {NAMES.length}</span>} />
      <div className="k-scroll pad">
        <div className="k-pbar" aria-hidden="true"><i style={{ width: `${(got.size / NAMES.length) * 100}%` }} /></div>

        <div className="k-name-card">
          <div className="k-name-nav">
            <button type="button" className="k-round" aria-label={k.prev} disabled={i === 0} onClick={() => setI(i - 1)}>‹</button>
            <span className="num">{n.id}</span>
            <button type="button" className="k-round" aria-label={k.next} disabled={i === NAMES.length - 1} onClick={() => setI(i + 1)}>›</button>
          </div>
          <div className="k-name-ar" lang="ar">{n.ar}</div>
          <div className="k-name-tr">{n.tr}</div>
          <div className="k-name-mean">{lang === 'ar' ? n.mean : n.en}</div>
          <div className="k-name-acts">
            <button type="button" className="k-btn ghost small" onClick={() => say(n.ar, 'ar')}>🔊 {k.listen}</button>
            <button type="button" className={`k-btn gold small${have ? ' got' : ''}`} disabled={have}
              onClick={() => { celebrate(update(collectName, n.id)); if (i < NAMES.length - 1) setTimeout(() => setI((x) => x + 1), 900) }}>
              <Star size={16} /> {have ? t.collected : t.collect}
            </button>
          </div>
        </div>

        <h2 className="k-h2">{t.collection}</h2>
        <div className="k-collection">
          {NAMES.map((x, j) => (
            <button key={x.id} type="button" lang="ar" className={`${got.has(x.id) ? 'got' : ''}${j === i ? ' on' : ''}`} onClick={() => setI(j)}
              aria-label={got.has(x.id) ? x.tr : `${x.id}`}>
              {got.has(x.id) ? x.ar : '?'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
