import { MODES, instruction, turnAngle, formatMetres, formatDuration, timeLeft } from '../lib/route'
import { directionsUrl } from '../lib/places'

const GOOGLE_MODE = { walk: 'walking', drive: 'driving', bike: 'bicycling' }
export const googleRoute = (p, mode) => `${directionsUrl(p)}&travelmode=${GOOGLE_MODE[mode] || 'walking'}`

const MODE_SVG = {
  walk: <><circle cx="13" cy="4.5" r="2" /><path d="M10 21l2-6 3 3v3M9 11l3-3 3 3 3 1M12 8l-2 7" /></>,
  drive: <><path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v3H3z" /><circle cx="7.5" cy="13" r=".8" /><circle cx="16.5" cy="13" r=".8" /></>,
  bike: <><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l4-7h5l3 7M10 9l2 7h-6M14 6h2" /></>,
}
export const ModeIcon = ({ mode, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MODE_SVG[mode]}</svg>
)

export function TurnIcon({ step, size = 22 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  if (!step) return null
  if (step.type === 'arrive') return <svg {...common}><path d="M6 21V4h11l-2 4 2 4H6" /></svg>
  if (/roundabout|rotary/.test(step.type)) return <svg {...common}><circle cx="12" cy="13" r="4.5" /><path d="M12 8.5V3M9 5.5l3-3 3 3M12 17.5V22" /></svg>
  if (step.modifier === 'uturn') return <svg {...common}><path d="M8 21V10a4 4 0 0 1 8 0v4" /><path d="M13 11l3 3 3-3" /></svg>
  const deg = turnAngle(step) ?? 0
  return <svg {...common} style={{ transform: `rotate(${deg}deg)` }}><path d="M12 21V5M6 11l6-6 6 6" /></svg>
}

/** The big turn instruction at the top of the screen while navigating. */
export function NavBanner({ s, route, track, locale }) {
  const nav = s.nav
  if (track.arrived) {
    return (
      <div className="mp-nav arrived" role="status" aria-live="polite">
        <div className="mp-nav-main"><span className="mp-nav-ic"><TurnIcon step={{ type: 'arrive' }} size={30} /></span><div><b>{nav.arrived}</b><span>{route.place.name || s.unnamed[route.place.kind]}</span></div></div>
      </div>
    )
  }
  const data = route.res[route.mode]?.data
  if (!data || track.rerouting) {
    return <div className="mp-nav" role="status" aria-live="polite"><div className="mp-nav-main"><span className="mp-spin light" aria-hidden="true" /><div><span>{nav.rerouting}</span></div></div></div>
  }
  const p = track.prog
  const idx = p ? p.step : 0
  const step = data.steps[idx]
  const after = data.steps[idx + 1]
  const dist = p ? p.toStep : 0
  return (
    <div className="mp-nav" role="status" aria-live="polite">
      <div className="mp-nav-main">
        <span className="mp-nav-ic"><TurnIcon step={step} size={34} /></span>
        <div>
          {p && <b className="num">{formatMetres(dist, locale)}</b>}
          <span>{instruction(step, nav)}</span>
        </div>
      </div>
      {after && p && dist < 300 && (
        <div className="mp-nav-then">{nav.then} <TurnIcon step={after} size={16} /> <span>{instruction(after, nav)}</span></div>
      )}
    </div>
  )
}

const clock = (locale, d) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d)

export function RouteSheet({ s, locale, route, track, onMode, onStart, onEnd, onClose, onMute, onRetry, label }) {
  const nav = s.nav
  const p = route.place
  const cur = route.res[route.mode]
  const data = cur?.data

  if (track) {
    const left = track.prog ? track.prog.left : data?.distance || 0
    const secs = data ? timeLeft(data, left) : 0
    const from = track.prog ? track.prog.step : 0
    return (
      <div className="mp-route live">
        <div className="mp-route-sum">
          <b className="num">{track.arrived ? nav.arrived : formatDuration(secs, locale)}</b>
          {!track.arrived && <span className="num">{formatMetres(left, locale)} · {nav.arriveAt(clock(locale, new Date(Date.now() + secs * 1000)))}</span>}
        </div>
        <div className="mp-acts">
          <button type="button" className="btn mp-end" onClick={onEnd}>{nav.end}</button>
          <button type="button" className="btn ghost" aria-pressed={!track.muted} onClick={onMute}>{track.muted ? nav.unmute : nav.mute}</button>
        </div>
        {data && !track.arrived && <Steps s={s} locale={locale} steps={data.steps.slice(from)} />}
      </div>
    )
  }

  return (
    <div className="mp-route">
      <div className="mp-route-h">
        <button type="button" className="mp-backlist" onClick={onClose}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          {nav.close}
        </button>
      </div>
      <div className="mp-route-to">
        <span className="mp-route-dot" aria-hidden="true" /><span>{nav.from}</span>
        <span className="mp-route-line" aria-hidden="true" />
        <span className={`mp-route-pin k-${p.kind}`} aria-hidden="true" /><b dir="auto">{label(p)}</b>
      </div>

      {route.needLoc ? (
        <div className="mp-route-msg">
          <p>{nav.needLoc}</p>
          <div className="mp-acts">
            <button type="button" className="btn" onClick={onRetry}>{s.useLoc}</button>
            <a className="btn ghost" href={googleRoute(p, route.mode)} target="_blank" rel="noopener noreferrer">{nav.google}</a>
          </div>
        </div>
      ) : (
        <>
          <div className="mp-modes" role="tablist" aria-label={nav.steps}>
            {MODES.map((m) => {
              const r = route.res[m]
              return (
                <button key={m} type="button" role="tab" aria-selected={route.mode === m} className={`mp-mode${route.mode === m ? ' on' : ''}`} onClick={() => onMode(m)}>
                  <ModeIcon mode={m} />
                  <span>{nav.modes[m]}</span>
                  <small className="num">{r?.st === 'ok' ? formatDuration(r.data.duration, locale) : r?.st === 'loading' ? '…' : '—'}</small>
                </button>
              )
            })}
          </div>

          {(!cur || cur.st === 'loading') && <div className="mp-status"><span className="mp-spin" aria-hidden="true" /><span>{nav.loading}</span></div>}
          {cur?.st === 'err' && (
            <div className="mp-route-msg">
              <p>{cur.err === 'noRoute' ? nav.noRoute : nav.err}</p>
              <div className="mp-acts">
                {cur.err !== 'noRoute' && <button type="button" className="btn" onClick={onRetry}>{s.retry}</button>}
                <a className="btn ghost" href={googleRoute(p, route.mode)} target="_blank" rel="noopener noreferrer">{nav.google}</a>
              </div>
            </div>
          )}
          {cur?.st === 'ok' && (
            <>
              <div className="mp-route-sum">
                <b className="num">{formatDuration(data.duration, locale)}</b>
                <span className="num">{formatMetres(data.distance, locale)} · {nav.arriveAt(clock(locale, new Date(Date.now() + data.duration * 1000)))}</span>
              </div>
              <div className="mp-acts">
                <button type="button" className="btn" onClick={onStart}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8z" /></svg>
                  {nav.start}
                </button>
                <a className="btn ghost" href={googleRoute(p, route.mode)} target="_blank" rel="noopener noreferrer">{nav.google}</a>
              </div>
              <Steps s={s} locale={locale} steps={data.steps} />
            </>
          )}
        </>
      )}
    </div>
  )
}

function Steps({ s, locale, steps }) {
  return (
    <>
      <h3 className="mp-steps-h">{s.nav.steps}</h3>
      <ol className="mp-steps">
        {steps.map((st, i) => (
          <li key={`${i}-${st.at}`}>
            <span className="mp-step-ic"><TurnIcon step={st} size={18} /></span>
            <span className="mp-step-t">{instruction(st, s.nav)}</span>
            {st.distance > 0 && <small className="num">{formatMetres(st.distance, locale)}</small>}
          </li>
        ))}
      </ol>
    </>
  )
}
