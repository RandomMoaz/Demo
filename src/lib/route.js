export const MODES = ['walk', 'drive', 'bike']
export const ROUTERS = {
  walk: 'https://routing.openstreetmap.de/routed-foot',
  drive: 'https://routing.openstreetmap.de/routed-car',
  bike: 'https://routing.openstreetmap.de/routed-bike',
}

const R = 6371000 // earth radius, m
const rad = (d) => (d * Math.PI) / 180

/** Metres between two { lat, lng }. */
export function metres(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Walking for anything under ~2 km in a straight line, otherwise driving. */
export const pickMode = (from, to) => (metres(from, to) <= 2000 ? 'walk' : 'drive')

export function parseRoute(json) {
  const r = json?.routes?.[0]
  const coords = r?.geometry?.coordinates
  if (!r || !Array.isArray(coords) || coords.length < 2) return null
  const line = coords.map(([lng, lat]) => [lat, lng])
  const cum = [0]
  for (let i = 1; i < line.length; i++) {
    cum.push(cum[i - 1] + metres({ lat: line[i - 1][0], lng: line[i - 1][1] }, { lat: line[i][0], lng: line[i][1] }))
  }
  const raw = (r.legs || []).flatMap((l) => l.steps || [])
  const total = raw.reduce((a, s) => a + (s.distance || 0), 0)
  const scale = total > 0 ? cum[cum.length - 1] / total : 1 // OSRM's step lengths, fitted to the drawn line
  let at = 0
  const steps = raw.map((s) => {
    const m = s.maneuver || {}
    const step = {
      type: m.type || 'turn', modifier: m.modifier || '', exit: m.exit || 0,
      bearing: Number.isFinite(m.bearing_after) ? m.bearing_after : null,
      name: s.name || s.ref || '',
      distance: s.distance || 0, duration: s.duration || 0,
      loc: Array.isArray(m.location) ? [m.location[1], m.location[0]] : null,
      at, // metres along the line where this manoeuvre happens
    }
    at += (s.distance || 0) * scale
    return step
  })
  return { distance: r.distance, duration: r.duration, line, cum, steps }
}

const failure = (code) => Object.assign(new Error(code), { code })

export async function fetchRoute(from, to, mode = 'walk', { signal, fetchImpl = fetch } = {}) {
  const pts = [from, to].map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  const url = `${ROUTERS[mode] || ROUTERS.walk}/route/v1/driving/${pts}?overview=full&geometries=geojson&steps=true`
  const res = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } })
  let json = null
  try { json = await res.json() } catch { /* not JSON */ }
  if (json && /^No(Route|Segment)$/.test(json.code)) throw failure('noRoute')
  if (!res.ok) throw failure(res.status === 429 || res.status >= 500 ? 'busy' : 'unavailable')
  const route = parseRoute(json)
  if (!route) throw failure('noRoute')
  return route
}

export function trackRoute(route, pos, prevAt = 0) {
  const { line, cum, steps } = route
  const kx = Math.cos(rad(pos.lat)) * 111320, ky = 110540 // metres per degree here
  let best = null, ahead = null
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][1] - pos.lng) * kx, ay = (line[i][0] - pos.lat) * ky
    const bx = (line[i + 1][1] - pos.lng) * kx, by = (line[i + 1][0] - pos.lat) * ky
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
    const off = Math.hypot(ax + t * dx, ay + t * dy)
    const at = cum[i] + t * (cum[i + 1] - cum[i])
    const c = { off, at }
    if (!best || off < best.off) best = c
    if (at >= prevAt - 30 && (!ahead || off < ahead.off)) ahead = c
  }
  // the forward match wins unless it is clearly worse than going back
  const here = ahead && ahead.off <= best.off + 25 ? ahead : best
  const total = cum[cum.length - 1]
  const nextIdx = steps.findIndex((s) => s.at > here.at + 3)
  const idx = nextIdx < 0 ? steps.length - 1 : nextIdx
  return {
    at: here.at, off: here.off,
    left: Math.max(0, total - here.at), // metres still to go
    step: idx, toStep: Math.max(0, steps[idx].at - here.at),
  }
}

/** Seconds of the route still to go, in proportion to the distance left. */
export const timeLeft = (route, left) => (route.distance > 0 ? (route.duration * left) / route.distance : 0)

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
export const compass = (bearing) => COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]

export function turnAngle(step) {
  if (step.type === 'arrive' || step.type === 'depart' || /roundabout|rotary/.test(step.type)) return null
  return ({ uturn: 180, 'sharp right': 135, right: 90, 'slight right': 45, straight: 0, 'slight left': -45, left: -90, 'sharp left': -135 })[step.modifier] ?? 0
}

/** The sentence for a step, in the user's language (`nav` is mapText(lang).nav). */
export function instruction(step, nav) {
  const name = step.name
  if (step.type === 'arrive') return nav.ins.arrive
  if (step.type === 'depart') return nav.ins.depart(step.bearing == null ? '' : nav.dirs[compass(step.bearing)], name)
  if (/roundabout|rotary/.test(step.type) && step.exit) return nav.ins.roundabout(step.exit, name)
  if (step.modifier === 'uturn') return nav.ins.uturn
  const side = /left/.test(step.modifier) ? 'left' : /right/.test(step.modifier) ? 'right' : null
  if (!side || step.modifier === 'straight') return nav.ins.straight(name)
  if (step.type === 'fork' || ((step.type === 'merge' || /ramp/.test(step.type)) && /slight/.test(step.modifier))) return nav.ins.keep(nav.side[side], name)
  return nav.ins.turn(nav.mod[step.modifier] || nav.mod[side], name)
}

/** "350 m", "1.2 km" for the turn banner and step list. */
export function formatMetres(m, locale = 'en') {
  const f = (v, unit, digits) => new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: digits }).format(v)
  if (m < 1000) return f(m < 100 ? Math.max(5, Math.round(m / 5) * 5) : Math.round(m / 10) * 10, 'meter', 0)
  return f(m / 1000, 'kilometer', m < 10000 ? 1 : 0)
}

/** "12 min", "1 hr 5 min", "١٢ د" — never "0 min". */
export function formatDuration(sec, locale = 'en') {
  const total = Math.max(1, Math.round(sec / 60))
  const f = (v, unit) => new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' }).format(v)
  const h = Math.floor(total / 60), m = total % 60
  return h ? (m ? `${f(h, 'hour')} ${f(m, 'minute')}` : f(h, 'hour')) : f(m, 'minute')
}
