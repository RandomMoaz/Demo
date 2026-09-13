import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { answer, starters } from '../lib/rashed'
import { RashedAvatar } from '../components/Lottie'

const STORE = 'mc.rashed.v1'
const KEEP = 60          // messages kept between sessions
const THINK = 520        // ms Rashed "looks" before answering

const uid = () => Math.random().toString(36).slice(2, 9)
const hasArabic = (s) => /[؀-ۿ]/.test(s || '')
const clock = (ts) => {
  const d = new Date(ts)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
// stored by kind, not text, so it follows a language change
const greet = () => ({ id: uid(), who: 'bot', kind: 'greet', ts: Date.now() })

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || 'null')
    return Array.isArray(v) && v.length ? v : null
  } catch { return null }
}
function persist(msgs) {
  try { localStorage.setItem(STORE, JSON.stringify(msgs.slice(-KEEP))) } catch { /* private mode */ }
}

export default function Rashed({ initialQuery }) {
  const { t, lang, back } = useApp()
  const [msgs, setMsgs] = useState(() => load() || [greet()])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(null)

  const bodyRef = useRef(null)
  const taRef = useRef(null)
  const timerRef = useRef(null)

  const fresh = msgs.length <= 1   // nothing asked yet in this conversation

  /* keep the latest message in view, including the typing indicator */
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, busy])

  useEffect(() => persist(msgs), [msgs])
  useEffect(() => () => clearTimeout(timerRef.current), [])

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
      setMsgs((m) => [...m, {
        id: uid(), who: 'bot',
        text: a.matched ? a.text : t.unknown,
        steps: a.steps, sources: a.sources, followups: a.followups,
        ts: Date.now(),
      }])
      setBusy(false)
    }, THINK)
  }, [lang, t])

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

  const textOf = (m) => (m.kind === 'greet' ? t.greeting : m.text)

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
          return (
            <div key={m.id} className={`row ${m.who}`}>
              {m.who === 'bot' && <span className="row-av" aria-hidden="true">ر</span>}
              <div className="row-col">
                <div className={`bubble ${m.who}`} dir="auto">
                  <div className={hasArabic(body) ? 'ar' : ''}>{body}</div>

                  {m.steps && (
                    <div className="steps-wrap">
                      <div className="lab">{t.stepsLab}</div>
                      <ol className={`steps ${hasArabic(m.steps[0]) ? 'ar' : ''}`}>
                        {m.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
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
                  {m.who === 'bot' && m.text && (
                    <button className="copy" onClick={() => copy(m)} aria-label={t.copy}>
                      {copied === m.id ? t.copied : t.copy}
                    </button>
                  )}
                </div>

                {/* follow-ups only under the newest answer, so old ones don't pile up */}
                {m.followups && i === msgs.length - 1 && !busy && (
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
