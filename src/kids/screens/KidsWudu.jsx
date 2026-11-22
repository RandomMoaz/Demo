import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import data from '../content/wudu.json'
import { useKids, update } from '../store'
import { finishWudu } from '../progress'
import { kidsText } from '../text'
import { BAND, pickLang, say, hush } from '../lib'
import { KTop, Noor, SpeakBtn, celebrate } from '../ui'

const STEPS = data.steps

function Drop({ on, onClick, label }) {
  return (
    <button type="button" className={`k-drop${on ? ' on' : ''}`} onClick={onClick} aria-pressed={on} aria-label={label}>
      {on
        ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        : <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true"><path d="M11 2C8 7 4 11 4 16a7 7 0 0 0 14 0c0-5-4-9-7-14z" fill="#3E8DB0" /></svg>}
    </button>
  )
}

export default function KidsWudu() {
  const { lang } = useApp()
  const { profile } = useKids()
  const k = kidsText(lang), t = k.wudu
  const short = BAND[profile.band]?.short
  const [i, setI] = useState(0)
  const [count, setCount] = useState(0)
  const [done, setDone] = useState(false)
  const step = STEPS[i]
  const need = Math.max(1, step.times)
  const text = pickLang(short ? step.short : step.text, lang)
  const ready = count >= need

  useEffect(() => { if (profile.voice && profile.band === 'little' && !done) say(text, lang) }, [i, done]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => hush, [])

  const go = (d) => { setI(i + d); setCount(0) }
  function next() {
    if (i + 1 < STEPS.length) { go(1); return }
    celebrate(update(finishWudu))
    setDone(true)
  }

  const progress = (
    <span className="k-step-of">{t.step(Math.min(i + 1, STEPS.length), STEPS.length)}</span>
  )

  if (done) {
    return (
      <div className="k-screen">
        <KTop title={t.title} right={<span />} />
        <div className="k-scroll pad k-center">
          <Noor size={110} wave />
          <h2 className="k-result">{t.done}</h2>
          <button type="button" className="k-btn" onClick={() => { setDone(false); setI(0); setCount(0) }}>{t.again}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="k-screen">
      <KTop title={t.title} right={progress} />
      <div className="k-scroll pad">
        <div className="k-segs" aria-hidden="true">{STEPS.map((s, j) => <i key={s.id} className={j <= i ? 'on' : ''} />)}</div>
        <div className="k-wudu-pic" aria-hidden="true">
          <span>{step.pic}</span>
          {step.times > 0 && <span className="k-water">💧</span>}
        </div>
        <div className="k-wudu-title">
          <h2>{pickLang(step.title, lang)}</h2>
          <SpeakBtn text={text} />
        </div>
        {lang !== 'ar' && <div className="k-wudu-ar" lang="ar">{step.title.ar}</div>}
        <p className="k-wudu-text">{text}</p>

        <div className="k-drops">
          {step.times === 0
            ? <button type="button" className={`k-said${ready ? ' on' : ''}`} onClick={() => setCount(1)} aria-pressed={ready}>{ready ? '✓ ' : ''}{t.said}</button>
            : Array.from({ length: need }, (_, j) => <Drop key={j} on={j < count} label={`${j + 1}`} onClick={() => setCount(Math.max(count, j + 1))} />)}
          {step.times > 0 && <small>{step.times === 1 ? t.tapOnce : t.tapDrops}</small>}
        </div>
      </div>
      <div className="k-foot two">
        <button type="button" className="k-btn ghost" onClick={() => go(-1)} disabled={i === 0}>{k.back}</button>
        <button type="button" className="k-btn" onClick={next} disabled={!ready}>{i + 1 < STEPS.length ? t.next : t.finish}</button>
      </div>
    </div>
  )
}
