import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { EVENTS, upcoming, hijriLabel } from '../lib/events'
import { pick } from '../lib/data'
import { notifyStatus, askNotifyPermission, notifyEvent } from '../lib/notify'

const REMIND_KEY = 'mc_ev_remind_v1'
const ACK_KEY = 'mc_ev_ack_v1'
const LOCALE = { en: 'en-GB', ar: 'ar', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', ja: 'ja-JP' }

/* opted-in reminders; yearly occasions default on, weekly/monthly off */
const defaults = () => new Set(EVENTS.filter((e) => e.kind === 'hijri').map((e) => e.id))
function readRemind() {
  try {
    const raw = localStorage.getItem(REMIND_KEY)
    if (raw == null) return defaults()
    return new Set(JSON.parse(raw))
  } catch { return defaults() }
}
const writeRemind = (s) => { try { localStorage.setItem(REMIND_KEY, JSON.stringify([...s])) } catch { /* private mode */ } }

/* ---- which reminders have already been answered today ---- */
const readAck = () => { try { return JSON.parse(localStorage.getItem(ACK_KEY) || '{}') } catch { return {} } }
const writeAck = (o) => { try { localStorage.setItem(ACK_KEY, JSON.stringify(o)) } catch { /* private mode */ } }
const stamp = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

const fmtDate = (d, lang) =>
  d.toLocaleDateString(LOCALE[lang] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

const Back = ({ onClick }) => (
  <button className="back-ic" onClick={onClick} aria-label="back">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
)

const Bell = ({ on }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

/* the reminder sheet — dismissed only by affirming it. Mounted globally by App. */
export function EventReminder() {
  const { t, lang } = useApp()
  const [due, setDue] = useState(null)

  useEffect(() => {
    const remind = readRemind()
    const ack = readAck()
    const now = stamp()
    const hit = upcoming().find((u) => u.days === 0 && remind.has(u.ev.id) && ack[u.ev.id] !== now)
    if (!hit) return
    setDue(hit)
    // also raise a system notification, if the user allowed them
    notifyEvent(pick(hit.ev.name, lang), pick(hit.ev.thawab, lang), 'event-' + hit.ev.id)
  }, [lang])

  useEffect(() => {
    if (!due) return
    const onKey = (e) => { if (e.key === 'Escape') accept() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [due])

  function accept() {
    if (!due) return
    const ack = readAck()
    ack[due.ev.id] = stamp()
    writeAck(ack)
    setDue(null)
  }

  if (!due) return null
  const ev = due.ev
  const todo = pick(ev.todo, lang) || []

  return (
    <div className="ev-backdrop" role="dialog" aria-modal="true" aria-label={pick(ev.name, lang)}>
      <div className={`ev-dlg ${ev.tone}`} dir={t.dir}>
        <div className="ev-dlg-ic" aria-hidden="true">{ev.ic}</div>
        <div className="ev-eyebrow">{t.evReminder} · {t.evToday}</div>
        <h2 className="ev-dlg-name">{pick(ev.name, lang)}</h2>
        <p className="ev-dlg-what">{pick(ev.what, lang)}</p>

        <div className="ev-thawab">
          <div className="ev-thawab-lab">{t.evThawab}</div>
          <p>{pick(ev.thawab, lang)}</p>
        </div>

        {todo.length > 0 && (
          <ul className="ev-todo">
            {todo.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        )}

        <button className="btn block ev-accept" onClick={accept} autoFocus>
          {t.evInshallah}
        </button>
      </div>
    </div>
  )
}

/* the reminders screen */
export default function Events() {
  const { t, lang, back } = useApp()
  const [remind, setRemind] = useState(readRemind)
  const [openId, setOpenId] = useState(null)
  const [perm, setPerm] = useState(() => notifyStatus())

  const list = useMemo(() => upcoming(), [])
  const yearly = list.filter((u) => u.ev.kind === 'hijri')
  const repeating = list.filter((u) => u.ev.kind !== 'hijri')
  const hero = yearly[0]
  const rest = yearly.slice(1)

  useEffect(() => { writeRemind(remind) }, [remind])

  const toggle = (id) => setRemind((s) => {
    const next = new Set(s)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // days <= 0 means it starts today, or is a multi-day event already running
  const when = (days) => (days <= 0 ? t.evToday : days === 1 ? t.evTomorrow : t.evIn(days))

  async function enableNotifications() {
    const res = await askNotifyPermission()
    setPerm(res)
  }

  const Card = ({ u }) => {
    const { ev, start, end, days } = u
    const open = openId === ev.id
    const on = remind.has(ev.id)
    const todo = pick(ev.todo, lang) || []
    return (
      <div className={`ev-card ${ev.tone} ${open ? 'open' : ''}`}>
        <button className="ev-head" onClick={() => setOpenId(open ? null : ev.id)} aria-expanded={open}>
          <span className="ev-ic" aria-hidden="true">{ev.ic}</span>
          <span className="ev-headtext">
            <span className="ev-name">{pick(ev.name, lang)}</span>
            <span className="ev-date">
              {fmtDate(start, lang)}
              {end > start && ` — ${fmtDate(end, lang)}`}
            </span>
          </span>
          <span className={`ev-badge ${days <= 0 ? 'now' : ''}`}>{when(days)}</span>
        </button>

        {open && (
          <div className="ev-body">
            <p className="ev-what">{pick(ev.what, lang)}</p>
            <div className="ev-hijri num">{hijriLabel(start, lang)}</div>

            <div className="ev-thawab">
              <div className="ev-thawab-lab">{t.evThawab}</div>
              <p>{pick(ev.thawab, lang)}</p>
            </div>

            {todo.length > 0 && (
              <>
                <div className="ev-todo-lab">{t.evTodo}</div>
                <ul className="ev-todo">{todo.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </>
            )}

            <button className={`ev-toggle ${on ? 'on' : ''}`} onClick={() => toggle(ev.id)} aria-pressed={on}>
              <Bell on={on} />
              {on ? t.evRemindOff : t.evRemindOn}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.evH1}</div><div className="h2">{t.evH2}</div></div>
        <span className="ar-tag">عرفة</span>
      </div>

      <div className="feat-body">
        {/* the next occasion, in full */}
        {hero && (
          <div className={`ev-hero ${hero.ev.tone}`}>
            <div className="ev-hero-top">
              <span className="ev-hero-ic" aria-hidden="true">{hero.ev.ic}</span>
              <span className={`ev-badge ${hero.days <= 0 ? 'now' : ''}`}>{when(hero.days)}</span>
            </div>
            <div className="ev-eyebrow">{t.evUpcoming}</div>
            <h2 className="ev-hero-name">{pick(hero.ev.name, lang)}</h2>
            <div className="ev-hero-date">
              {fmtDate(hero.start, lang)}
              {hero.end > hero.start && ` — ${fmtDate(hero.end, lang)}`}
            </div>
            <div className="ev-hijri num">{hijriLabel(hero.start, lang)}</div>
            <p className="ev-what">{pick(hero.ev.what, lang)}</p>
            <div className="ev-thawab">
              <div className="ev-thawab-lab">{t.evThawab}</div>
              <p>{pick(hero.ev.thawab, lang)}</p>
            </div>
            <button className={`ev-toggle ${remind.has(hero.ev.id) ? 'on' : ''}`}
              onClick={() => toggle(hero.ev.id)} aria-pressed={remind.has(hero.ev.id)}>
              <Bell on={remind.has(hero.ev.id)} />
              {remind.has(hero.ev.id) ? t.evRemindOff : t.evRemindOn}
            </button>
          </div>
        )}

        {/* notifications */}
        {perm !== 'granted' && perm !== 'unsupported' && (
          <div className="ev-notify">
            <p>{t.evNotifyLead}</p>
            {perm === 'denied'
              ? <div className="ev-blocked">{t.evNotifyBlocked}</div>
              : <button className="btn block" onClick={enableNotifications}>{t.evNotifyAsk}</button>}
          </div>
        )}
        {perm === 'granted' && (
          <div className="ev-notify on"><Bell on /> {t.evNotifyOn}</div>
        )}

        {rest.length > 0 && (
          <>
            <div className="ev-sec">{t.evUpcoming}</div>
            {rest.map((u) => <Card key={u.ev.id} u={u} />)}
          </>
        )}

        {repeating.length > 0 && (
          <>
            <div className="ev-sec">{t.labDaily}</div>
            {repeating.map((u) => <Card key={u.ev.id} u={u} />)}
          </>
        )}

        <p className="fine">{t.evNote}</p>
      </div>
    </div>
  )
}
