import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { createPrayerCameraController } from '../../lib/prayerCamera'
import { useKids, update } from '../store'
import { finishPrayerGame } from '../progress'
import { kidsText } from '../text'
import { say, hush } from '../lib'
import { KTop, Noor, SpeakBtn, celebrate } from '../ui'

const STEPS = ['stand', 'bow', 'sujud', 'sit']

// side-view stick figures: head circle + body lines, facing right
const POSES = {
  stand: { head: [50, 18], lines: [[50, 26, 50, 62], [50, 62, 44, 92], [50, 62, 56, 92], [50, 36, 58, 42], [58, 42, 50, 46]] },
  bow: { head: [80, 36], lines: [[72, 38, 40, 40], [40, 40, 40, 92], [40, 40, 46, 92], [62, 39, 60, 64], [52, 39, 50, 64]] },
  sujud: { head: [84, 84], lines: [[76, 80, 44, 62], [44, 62, 30, 90], [30, 90, 18, 92], [66, 76, 78, 92], [58, 72, 70, 92]] },
  sit: { head: [56, 30], lines: [[56, 38, 52, 70], [52, 70, 76, 74], [52, 70, 30, 90], [30, 90, 70, 90], [54, 48, 70, 70]] },
}

function Figure({ pose, glow }) {
  const p = POSES[pose]
  return (
    <svg className={`k-figure${glow ? ' glow' : ''}`} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6" y="92" width="88" height="5" rx="2.5" fill="#E07A5F" opacity=".9" />
      {p.lines.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />)}
      {p.lines.map((l, i) => <circle key={`j${i}`} cx={l[2]} cy={l[3]} r="2.6" className="joint" />)}
      <circle cx={p.head[0]} cy={p.head[1]} r="7" className="head" />
    </svg>
  )
}

export default function KidsPrayer() {
  const { lang } = useApp()
  const { profile } = useKids()
  const k = kidsText(lang), t = k.prayer
  const [step, setStep] = useState(0) // 0–3, 4 = finished
  const [hold, setHold] = useState(0) // seconds left while holding a pose
  const [said, setSaid] = useState(null) // Noor's line: how to do the move, or praise for the last one
  const [cam, setCam] = useState('idle')
  const video = useRef(null)
  const ctrl = useRef(null)
  const holdFor = profile.band === 'little' ? 2 : 3

  useEffect(() => {
    const c = createPrayerCameraController(video.current, { onState: setCam })
    ctrl.current = c
    return () => { c.dispose(); hush() }
  }, [])

  const current = STEPS[step]
  const line = said ?? (current ? t.how[current] : t.allDone)

  // the youngest hear each move read out
  useEffect(() => { if (profile.voice && profile.band === 'little' && current) say(t.how[current], lang) }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hold) return
    const id = setTimeout(() => {
      if (hold > 1) { setHold(hold - 1); return }
      setHold(0)
      setSaid(t.praise[current])
      if (step === STEPS.length - 1) { setStep(4); celebrate(update(finishPrayerGame)) }
      else setTimeout(() => { setStep((s) => s + 1); setSaid(null) }, 1400)
    }, 1000)
    return () => clearTimeout(id)
  }, [hold]) // eslint-disable-line react-hooks/exhaustive-deps

  const camOn = cam === 'active'
  return (
    <div className="k-screen">
      <KTop title={t.title} />
      <div className="k-scroll pad">
        <div className="k-cam">
          <video ref={video} playsInline muted autoPlay className={camOn ? 'on' : ''} aria-hidden="true" />
          <span className="k-cam-frame" aria-hidden="true" />
          {camOn && <span className="k-live">● LIVE</span>}
          <div className={`k-cam-figure${camOn ? ' small' : ''}`}><Figure pose={current || 'sit'} glow={hold > 0} /></div>
          {hold > 0 && <span className="k-hold num" aria-live="assertive">{hold}</span>}
        </div>

        <ol className="k-psteps">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
              <span className="k-pdot" aria-hidden="true">{i < step ? '✓' : i === step ? '★' : ''}</span>
              <b>{t.steps[s]}</b>
            </li>
          ))}
        </ol>

        <div className="k-bubble">
          <Noor size={46} />
          <p>{line}</p>
          <SpeakBtn text={line} />
        </div>

        {step < 4 ? (
          <button type="button" className="k-btn" disabled={hold > 0 || !!said} onClick={() => setHold(holdFor)}>{hold > 0 ? t.hold : t.ready}</button>
        ) : (
          <button type="button" className="k-btn" onClick={() => { setStep(0); setSaid(null) }}>{t.again}</button>
        )}
        <button type="button" className="k-btn ghost" onClick={() => (camOn ? ctrl.current?.stop() : ctrl.current?.start())} disabled={cam === 'starting'}>
          {camOn ? t.pause : t.camera}
        </button>
        <p className="k-note">{['denied', 'unavailable', 'insecure', 'error', 'busy'].includes(cam) ? t.noCamera : t.cameraNote}</p>
      </div>
    </div>
  )
}
