import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import data from '../content/letters.json'
import { useKids, update } from '../store'
import { traceLetter } from '../progress'
import { kidsText } from '../text'
import { BAND, letterForms, letterTargets, coverage, precision, say } from '../lib'
import { KTop, celebrate } from '../ui'

const LETTERS = data.letters

/** Draw over the faint letter with a finger; done when enough of its shape is covered. */
function TracePad({ letter, band, onDone, k }) {
  const wrap = useRef(null)
  const canvas = useRef(null)
  const st = useRef({ strokes: [], targets: [], drawing: false, done: false, w: 0, h: 0 })
  const [done, setDone] = useState(false)
  const [stray, setStray] = useState(false)
  const conf = BAND[band] || BAND.explorer

  function paint() {
    const c = canvas.current, s = st.current
    if (!c) return
    const g = c.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, s.w, s.h)
    g.font = `${Math.round(s.h * 0.62)}px "Baloo Bhaijaan 2", "Noto Naskh Arabic", serif`
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillStyle = 'rgba(62,141,176,.16)'
    g.fillText(letter.ar, s.w / 2, s.h * 0.5)
    // dotted guide over the letter, and the coral start dot (Arabic is written from the right)
    g.fillStyle = 'rgba(62,141,176,.55)'
    s.targets.forEach((p, i) => { if (i % 3 === 0) { g.beginPath(); g.arc(p.x, p.y, 2, 0, 7); g.fill() } })
    const start = s.targets.reduce((a, p) => (!a || p.x > a.x + 6 || (Math.abs(p.x - a.x) <= 6 && p.y < a.y) ? p : a), null)
    if (start && !s.strokes.length) { g.fillStyle = '#E07A5F'; g.beginPath(); g.arc(start.x, start.y, 9, 0, 7); g.fill() }
    g.strokeStyle = s.done ? '#1F7A6B' : '#3E8DB0'
    g.lineWidth = conf.brush; g.lineCap = 'round'; g.lineJoin = 'round'
    for (const line of s.strokes) {
      g.beginPath()
      line.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)))
      if (line.length === 1) g.lineTo(line[0].x + 0.1, line[0].y)
      g.stroke()
    }
  }

  function reset() {
    const c = canvas.current, el = wrap.current
    if (!c || !el) return
    const w = el.clientWidth, h = el.clientHeight
    const dpr = window.devicePixelRatio || 1
    c.width = w * dpr; c.height = h * dpr; c.style.width = `${w}px`; c.style.height = `${h}px`
    st.current = { strokes: [], targets: letterTargets(letter.ar, w, h, 9), drawing: false, done: false, w, h }
    setDone(false); setStray(false)
    paint()
  }

  useEffect(() => {
    let live = true
    const go = () => { if (live) reset() }
    if (document.fonts?.load) document.fonts.load('80px "Baloo Bhaijaan 2"', letter.ar).then(go, go)
    else go()
    return () => { live = false }
  }, [letter.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e) => { const r = canvas.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const down = (e) => { if (st.current.done) return; e.currentTarget.setPointerCapture?.(e.pointerId); st.current.drawing = true; st.current.strokes.push([at(e)]); paint() }
  const move = (e) => { const s = st.current; if (!s.drawing) return; s.strokes[s.strokes.length - 1].push(at(e)); paint() }
  const up = () => {
    const s = st.current
    if (!s.drawing) return
    s.drawing = false
    const cov = coverage(s.targets, s.strokes, conf.brush * 0.75)
    const on = precision(s.targets, s.strokes, conf.brush * 0.9)
    if (cov >= conf.traceNeed && on >= conf.onLetter) { s.done = true; setDone(true); setStray(false); onDone() }
    else setStray(on < conf.onLetter && cov > 0.3) // drawing all over the pad: a gentle nudge
    paint()
  }

  return (
    <div className={`k-trace${done ? ' done' : ''}`}>
      <div className="k-trace-h">
        <span role="status">{done ? k.letters.traced : stray ? k.letters.stay : k.letters.trace}</span>
        <button type="button" className="k-chip" onClick={reset}>{k.letters.clear}</button>
      </div>
      <div ref={wrap} className="k-trace-pad">
        <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label={k.letters.trace} />
      </div>
    </div>
  )
}

export default function KidsLetters() {
  const { lang } = useApp()
  const { profile, progress } = useKids()
  const k = kidsText(lang)
  const [i, setI] = useState(() => Math.max(0, LETTERS.findIndex((l) => !progress.lettersDone.includes(l.id))))
  const letter = LETTERS[i]
  const forms = letterForms(letter)
  const little = profile.band === 'little'
  const strip = useRef(null)

  useEffect(() => { strip.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }) }, [i])

  return (
    <div className="k-screen">
      <KTop title={k.letters.title} />
      <div className="k-scroll pad">
        <div className="k-letter-card">
          <button type="button" className="k-speak big on-card" aria-label={k.listen} onClick={() => say(letter.name, 'ar')}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
          </button>
          <div className="k-letter" lang="ar">{letter.ar}</div>
          <div className="k-letter-name"><b>{letter.tr}</b> <span lang="ar">{letter.name}</span></div>
          {little && <div className="k-letter-word"><span aria-hidden="true">{letter.pic}</span> <span lang="ar">{letter.word}</span></div>}
        </div>

        <div className="k-forms">
          {['alone', 'start', 'middle', 'end'].map((f) => (
            <div key={f} className="k-form"><span lang="ar">{forms[f]}</span><small>{k.letters.forms[f]}</small></div>
          ))}
        </div>

        <TracePad key={letter.id} letter={letter} band={profile.band} k={k}
          onDone={() => celebrate(update(traceLetter, letter.id))} />

        {/* the alphabet runs right to left: alif first, on the right */}
        <div ref={strip} className="k-strip" dir="rtl">
          {LETTERS.map((l, j) => (
            <button key={l.id} type="button" lang="ar" aria-label={`${l.name} ${l.tr}`} aria-current={j === i ? 'true' : undefined}
              className={`${j === i ? 'on' : ''}${progress.lettersDone.includes(l.id) ? ' done' : ''}`} onClick={() => setI(j)}>
              {l.ar}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
