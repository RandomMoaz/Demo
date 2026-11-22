import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { answer, starters } from '../lib/rashed'
import { tools, timesFor, qibla, compass8 } from '../lib/rashedTools'
import { rashedText } from '../lib/rashedText'
import { whereFor, savePrayerAlarm, nextRing, prayerName, localeOf } from '../lib/alarms'
import { getLocation, saveLocation } from '../lib/location'
import { fmtTime } from '../lib/prayerTimes'
import { formatDuration } from '../lib/route'
import { RashedAvatar } from '../components/Lottie'

const STORE = 'mc.rashed.v1'
const KEEP = 60          // messages kept between sessions
const THINK = 420        // ms Rashed "looks" before answering

const uid = () => Math.random().toString(36).slice(2, 9)
const hasArabic = (s) => /[؀-ۿ]/.test(s || '')
const clock = (ts) => {
  const d = new Date(ts)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
// stored by kind, not text, so it follows a language change
const greet = () => ({ id: uid(), who: 'bot', kind: 'greet', ts: Date.now() })
const SCREEN = { map: 'map', scanner: 'scanner', mushaf: 'mushaf', alarms: 'alarm' }

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || 'null')
    return Array.isArray(v) && v.length ? v : null
  } catch { return null }
}
function persist(msgs) {
  try { localStorage.setItem(STORE, JSON.stringify(msgs.slice(-KEEP))) } catch { /* private mode */ }
}

/* ---------- cards: what the app knows, shown inside an answer ---------- */

function TimesCard({ where, focus, R, lang, locale }) {
  const { list, next } = timesFor(where)
  const name = (p) => (p.key === 'sunrise' ? R.sunrise : prayerName(p.key, lang))
  return (
    <div className="rs-card">
      <div className="lab">{R.timesH}</div>
      <ul className="rs-times">
        {list.map((p) => (
          <li key={p.key} className={`${p.key === (focus || next.key) ? 'on' : ''}${p.info ? ' info' : ''}`}>
            <span>{name(p)}</span><b className="num">{fmtTime(p.date, lang)}</b>
          </li>
        ))}
      </ul>
      <p className="rs-note">{R.next(prayerName(next.key, lang), fmtTime(next.date, lang), formatDuration(next.ms / 1000, locale))}</p>
    </div>
  )
}

function QiblaCard({ where, R, locale }) {
  const { bearing, km } = qibla(where)
  const n = (v) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v)
  return (
    <div className="rs-card rs-qibla">
      <svg viewBox="0 0 100 100" width="84" height="84" aria-hidden="true">
        <circle cx="50" cy="50" r="44" className="ring" />
        <text x="50" y="16" textAnchor="middle" className="n">N</text>
        <g transform={`rotate(${bearing} 50 50)`}>
          <path d="M50 14 L58 50 L50 44 L42 50 Z" className="arrow" />
          <rect x="45" y="8" width="10" height="9" rx="1.5" className="kaaba" />
        </g>
        <circle cx="50" cy="50" r="4" className="hub" />
      </svg>
      <div>
        <div className="lab">{R.qiblaH}</div>
        <b className="num">{R.qibla(n(bearing), R.dirs[compass8(bearing)], n(km))}</b>
        <p className="rs-note">{R.qiblaHint}</p>
      </div>
    </div>
  )
}

function IngredientsCard({ card, R, lang }) {
  return (
    <div className="rs-card">
      <div className="lab">{R.ingrH}</div>
      <ul className="rs-ingr">
        {card.found.map((f) => (
          <li key={f.id} className={`s-${f.s}`}>
            <b>{f.n[lang] || f.n.en}</b> <em>{R.status[f.s] || f.s}</em>
            <span>{f.w[lang] || f.w.en}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Rashed({ initialQuery }) {
  const { t, lang, back, go, loc, setLoc } = useApp()
  const R = rashedText(lang)
  const locale = localeOf(lang)
  const [msgs, setMsgs] = useState(() => load() || [greet()])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(null)
  const [speaking, setSpeaking] = useState(null)

  const bodyRef = useRef(null)
  const taRef = useRef(null)
  const timerRef = useRef(null)
  const where = whereFor(loc)

  const fresh = msgs.length <= 1   // nothing asked yet in this conversation

  /* keep the latest message in view, including the typing indicator */
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, busy])

  useEffect(() => persist(msgs), [msgs])
  useEffect(() => () => { clearTimeout(timerRef.current); try { window.speechSynthesis?.cancel() } catch { /* ignore */ } }, [])

  /* the textarea grows with the question, up to a few lines */
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`
  }, [input])

  const ask = useCallback((q) => {
    const text = String(q || '').trim()
    if (!text) return
    setMsgs((m) => [...m, { id: uid(), who: 'me', text, ts: Date.now() }])
    setBusy(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const a = answer(text, lang)
      const tl = tools(text, { where, topic: a.id })
      setMsgs((m) => [...m, {
        id: uid(), who: 'bot', q: text, topic: a.id, small: a.small || null,
        text: a.matched ? a.text : null,
        steps: a.steps, sources: a.sources, followups: a.followups, also: a.also, suggest: a.suggest, english: a.english,
        cards: tl.cards, actions: tl.actions,
        ts: Date.now(),
      }])
      setBusy(false)
    }, THINK)
  }, [lang, where])

  // a question handed over from another screen (the halal scanner, a tile)
  useEffect(() => { if (initialQuery) ask(initialQuery) /* eslint-disable-next-line */ }, [])

  function send() {
    if (busy || !input.trim()) return
    ask(input)
    setInput('')
    taRef.current?.focus()
  }

  function newChat() {
    clearTimeout(timerRef.current)
    setBusy(false)
    setMsgs([greet()])
    setInput('')
    try { localStorage.removeItem(STORE) } catch { /* ignore */ }
    taRef.current?.focus()
  }

  const say = (text, actions) => setMsgs((m) => [...m, { id: uid(), who: 'bot', text, actions, ts: Date.now() }])

  /** A button under an answer: open a screen, share the location, or switch on a prayer alarm. */
  function act(a, m) {
    if (typeof a === 'object' && a.alarm) {
      const saved = savePrayerAlarm(a.alarm, a.alarm === 'fajr' ? { task: 'math', level: 'medium' } : {})
      const when = nextRing(saved, loc)
      say(R.alarmOn(prayerName(a.alarm, lang), when ? fmtTime(when, lang) : '—'), ['alarms'])
      return
    }
    if (a === 'locate') {
      getLocation().then((l) => {
        setLoc(l); saveLocation(l)
        // answer the same question again, now with the location
        setMsgs((ms) => ms.map((x) => (x.id === m.id ? { ...x, ...tools(x.q, { where: l, topic: x.topic }) } : x)))
      }, () => say(R.locFail))
      return
    }
    if (SCREEN[a]) go(SCREEN[a])
  }

  async function copy(m) {
    const parts = [textOf(m)]
    if (m.steps) parts.push(m.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'))
    if (m.sources) parts.push(m.sources.map((s) => `${s.n} — ${s.url}`).join('\n'))
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'))
      setCopied(m.id)
      setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 1600)
    } catch { /* clipboard blocked */ }
  }

  /** Read an answer aloud with the device's own voice (nothing leaves the phone). */
  function read(m) {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    if (!synth) return
    synth.cancel()
    if (speaking === m.id) { setSpeaking(null); return }
    const body = [textOf(m), ...(m.steps || [])].join('. ')
    const u = new SpeechSynthesisUtterance(body)
    u.lang = hasArabic(body) ? 'ar-SA' : locale
    u.onend = u.onerror = () => setSpeaking((s) => (s === m.id ? null : s))
    setSpeaking(m.id)
    synth.speak(u)
  }

  const textOf = (m) => (m.kind === 'greet' ? t.greeting : m.small ? R.small[m.small] : m.text ?? t.unknown)
  const actLabel = (a) => (typeof a === 'object' ? R.act.alarm(prayerName(a.alarm, lang)) : R.act[a])
  const canRead = typeof window !== 'undefined' && !!window.speechSynthesis

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="chat-top">
        <div className="av"><RashedAvatar /></div>
        <div className="chat-id">
          <div className="c1">راشد · Rashed</div>
          <div className="c2">{t.chatRole}</div>
        </div>
        <button className="chat-act" onClick={newChat} title={t.newChat} aria-label={t.newChat} disabled={fresh && !busy}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button className="chat-act" onClick={back} title={t.aClose} aria-label={t.aClose}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="chat-body" ref={bodyRef} role="log" aria-live="polite" aria-label={t.aChat}>
        {msgs.map((m, i) => {
          const body = textOf(m)
          const newest = i === msgs.length - 1 && !busy
          return (
            <div key={m.id} className={`row ${m.who}`}>
              {m.who === 'bot' && <span className="row-av" aria-hidden="true">ر</span>}
              <div className="row-col">
                <div className={`bubble ${m.who}`} dir="auto">
                  <div className={hasArabic(body) ? 'ar' : ''}>{body}</div>
                  {m.english && R.english && <div className="rs-en">{R.english}</div>}

                  {m.cards?.map((c, k) => (
                    c.type === 'times' && where ? <TimesCard key={k} where={where} focus={c.focus} R={R} lang={lang} locale={locale} />
                      : c.type === 'qibla' && where ? <QiblaCard key={k} where={where} R={R} locale={locale} />
                        : c.type === 'ingredients' ? <IngredientsCard key={k} card={c} R={R} lang={lang} />
                          : c.type === 'needLoc' ? <div key={k} className="rs-card rs-need">{R.needLoc[c.for]}</div> : null
                  ))}

                  {m.steps && (
                    <div className="steps-wrap">
                      <div className="lab">{t.stepsLab}</div>
                      <ol className={`steps ${hasArabic(m.steps[0]) ? 'ar' : ''}`}>
                        {m.steps.map((s, k) => <li key={k}>{s}</li>)}
                      </ol>
                    </div>
                  )}

                  {m.actions?.length > 0 && (
                    <div className="rs-acts">
                      {m.actions.map((a) => (
                        <button key={typeof a === 'object' ? `alarm-${a.alarm}` : a} type="button" className={`rs-act${a === 'locate' || typeof a === 'object' ? ' main' : ''}`} onClick={() => act(a, m)}>
                          {actLabel(a)}
                        </button>
                      ))}
                    </div>
                  )}

                  {m.sources && (
                    <>
                      <div className="lab" style={{ marginTop: 12 }}>{t.srcLab}</div>
                      {m.sources.map((s) => (
                        <a key={s.d} className="src" href={s.url} target="_blank" rel="noopener noreferrer">
                          <span className="si" aria-hidden="true">{s.d[0].toUpperCase()}</span>
                          <span className="st"><span className="sn ar">{s.n}</span><span className="sd">{s.d}</span></span>
                          <span className="sgo" aria-hidden="true">↗</span>
                        </a>
                      ))}
                      <div className="fine">{t.fine}</div>
                    </>
                  )}
                </div>

                <div className="meta">
                  <span className="num">{clock(m.ts)}</span>
                  {m.who === 'bot' && canRead && (
                    <button className="copy" onClick={() => read(m)} aria-pressed={speaking === m.id}>{speaking === m.id ? R.stop : R.read}</button>
                  )}
                  {m.who === 'bot' && m.text && (
                    <button className="copy" onClick={() => copy(m)} aria-label={t.copy}>
                      {copied === m.id ? t.copied : t.copy}
                    </button>
                  )}
                </div>

                {/* suggestions only under the newest answer, so old ones don't pile up */}
                {newest && m.suggest?.length > 0 && (
                  <>
                    <div className="lab rel">{R.maybe}</div>
                    <div className="chips inline">{m.suggest.map((q) => <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>)}</div>
                  </>
                )}
                {newest && m.also?.length > 0 && (
                  <>
                    <div className="lab rel">{R.also}</div>
                    <div className="chips inline">{m.also.map((q) => <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>)}</div>
                  </>
                )}
                {newest && m.followups?.length > 0 && (
                  <>
                    <div className="lab rel">{t.relLab}</div>
                    <div className="chips inline">
                      {m.followups.map((q) => (
                        <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {busy && (
          <div className="row bot">
            <span className="row-av" aria-hidden="true">ر</span>
            <div className="bubble bot typing">
              <span className="dot" /><span className="dot" /><span className="dot" />
              <span className="sr">{t.typing}</span>
            </div>
          </div>
        )}
      </div>

      {fresh && !busy && (
        <div className="chips">
          {starters(lang).map((q) => (
            <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>
          ))}
        </div>
      )}

      <div className="composer">
        <textarea
          ref={taRef} rows={1} value={input} placeholder={t.ph} dir="auto" aria-label={t.ph}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() }
          }}
        />
        <button onClick={send} disabled={busy || !input.trim()} aria-label={t.aSend}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
      </div>
    </div>
  )
}
