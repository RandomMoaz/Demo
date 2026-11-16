import { placeFromTags, FOOD_TYPES, HALAL_LEVELS } from './placeTags.js'
import { fetchQlever } from './qlever.js'

export { placeName } from './placeTags.js'

export const KINDS = ['mosque', 'food', 'shop']

// public Overpass servers, asked in this order after QLever (see fetchPlaces)
export const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

export const MIN_SEARCH_ZOOM = 10
export const MAX_HALF_SPAN_KM = 6 // the searched box is at most 12 x 12 km around the map centre
export const MIN_HALF_SPAN_KM = 2.5 // …and at least 5 x 5 km, even when zoomed in on one street
export const MAX_PLACES = 300

const FOOD = `^(${FOOD_TYPES.join('|')})$`
const HALAL = `^(${HALAL_LEVELS.join('|')})$`

export function overpassQuery({ s, w, n, e }) {
  const box = [s, w, n, e].map((v) => Number(v).toFixed(5)).join(',')
  return `[out:json][timeout:25][bbox:${box}];` +
    `nwr["diet:halal"~"${HALAL}"]->.h;` + // the rare tag first, then sort it into food and shops
    '(' +
    'nwr["amenity"="place_of_worship"]["religion"~"^(muslim|multifaith)$"];' +
    `nwr.h["amenity"~"${FOOD}"];` +
    'nwr.h["shop"];' +
    ');' +
    `out center tags qt ${MAX_PLACES * 2};` // qt: skip sorting, faster; the nearest are picked afterwards
}

const R = 6371 // earth radius, km
const rad = (d) => (d * Math.PI) / 180

/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function searchBox(bounds, center, maxHalfKm = MAX_HALF_SPAN_KM, minHalfKm = MIN_HALF_SPAN_KM) {
  const kmLat = 111.32, kmLng = 111.32 * Math.max(0.05, Math.cos(rad(center.lat)))
  const span = (lo, hi, c, per) => {
    const max = maxHalfKm / per, min = minHalfKm / per
    return [Math.min(c - min, Math.max(lo, c - max)), Math.max(c + min, Math.min(hi, c + max))]
  }
  const [s, n] = span(bounds.s, bounds.n, center.lat, kmLat)
  const [w, e] = span(bounds.w, bounds.e, center.lng, kmLng)
  return { s: Math.max(s, -90), n: Math.min(n, 90), w: Math.max(w, -180), e: Math.min(e, 180) }
}

export const boxWasClamped = (bounds, box) =>
  box.s > bounds.s + 1e-9 || box.n < bounds.n - 1e-9 || box.w > bounds.w + 1e-9 || box.e < bounds.e - 1e-9

export function parsePlaces(json, lang = 'en') {
  const out = []
  const seen = new Set()
  for (const el of (json && json.elements) || []) {
    const id = `${el.type}/${el.id}`
    if (seen.has(id)) continue
    const p = placeFromTags(id, el.lat ?? el.center?.lat, el.lon ?? el.center?.lon, el.tags || {}, lang)
    if (!p) continue
    seen.add(id)
    out.push(p)
  }
  return out
}

/** Places of the chosen kind, nearest first, each with its distance from `from`. */
export function arrange(places, { filter = 'all', from } = {}) {
  const list = filter === 'all' ? places : places.filter((p) => p.kind === filter)
  if (!from) return list.slice()
  return list
    .map((p) => ({ ...p, km: distanceKm(from, p) }))
    .sort((a, b) => a.km - b.km)
}

export function countKinds(places) {
  const c = { all: places.length, mosque: 0, food: 0, shop: 0 }
  for (const p of places) c[p.kind]++
  return c
}

const boxCentre = (b) => ({ lat: (b.s + b.n) / 2, lng: (b.w + b.e) / 2 })

const inBox = (b, p) => p.lat >= b.s && p.lat <= b.n && p.lng >= b.w && p.lng <= b.e

/** At most `limit` places, the nearest to the box centre first. */
export function nearestFirst(places, box, limit = MAX_PLACES) {
  const c = boxCentre(box)
  return places
    .map((p) => ({ p, d: distanceKm(c, p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.p)
}

export function coveredBox(box, places, limit = MAX_PLACES) {
  if (places.length < limit) return box
  const c = boxCentre(box)
  const r = Math.max(...places.map((p) => distanceKm(c, p))) / Math.SQRT2
  const dLat = r / 111.32, dLng = r / (111.32 * Math.max(0.05, Math.cos(rad(c.lat))))
  return { s: Math.max(box.s, c.lat - dLat), n: Math.min(box.n, c.lat + dLat), w: Math.max(box.w, c.lng - dLng), e: Math.min(box.e, c.lng + dLng) }
}

export function formatDistance(km, locale = 'en') {
  if (!Number.isFinite(km)) return ''
  const unit = (u, v, digits) => new Intl.NumberFormat(locale, { style: 'unit', unit: u, unitDisplay: 'short', maximumFractionDigits: digits }).format(v)
  if (km < 1) return unit('meter', Math.max(10, Math.round((km * 1000) / 10) * 10), 0)
  return unit('kilometer', km, km < 10 ? 1 : 0)
}

/** Walking minutes at an easy 4.8 km/h, rounded so it never claims "0 min". */
export const walkMinutes = (km) => Math.max(1, Math.round((km / 4.8) * 60))

/** A link that opens turn-by-turn directions in the phone's maps app (or the web). */
export function directionsUrl(p) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`
}

export function osmUrl(p) {
  const [type, id] = p.id.split('/')
  return `https://www.openstreetmap.org/${type}/${id}`
}

export function safeUrl(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const u = /^https?:\/\//i.test(s) ? s : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s) ? `https://${s}` : ''
  try { return u && ['http:', 'https:'].includes(new URL(u).protocol) ? u : '' } catch { return '' }
}

/** A plain e-mail address for a mailto: link, or ''. */
export const safeEmail = (raw) => {
  const e = String(raw || '').split(';')[0].trim()
  return /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(e) ? e : ''
}

const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' })
const failure = (busy) => Object.assign(new Error(busy ? 'busy' : 'unavailable'), { busy })

export const overpassSource = (url, box, { lang, fetchImpl }) => async (signal) => {
  const body = 'data=' + encodeURIComponent(overpassQuery(box))
  const res = await fetchImpl(url, { method: 'POST', body, signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
  if (!res.ok) throw failure(res.status === 429 || res.status >= 500)
  const json = await res.json()
  // Overpass reports its own timeouts and memory limits as a 200 with a remark
  if (json?.remark && /runtime error|timed out|out of memory/i.test(json.remark)) throw failure(true)
  return parsePlaces(json, lang)
}

export const qleverSource = (box, { lang, fetchImpl }) => (signal) => {
  const center = boxCentre(box)
  const radiusM = distanceKm(center, { lat: box.n, lng: box.e }) * 1000
  return fetchQlever({ center, radiusM, lang, signal, fetchImpl }).then((found) => found.filter((p) => inBox(box, p)))
}

export function fetchPlaces(box, {
  lang = 'en', signal, fetchImpl = fetch, servers, sources, hedgeMs = 2500, perServerMs = 25000,
} = {}) {
  const opts = { lang, fetchImpl }
  const list = sources || [
    ...(servers ? [] : [qleverSource(box, opts)]),
    ...(servers || OVERPASS).map((url) => overpassSource(url, box, opts)),
  ]
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return }
    const live = new Set()
    let next = 0, done = false, busy = false, hedge = null

    const finish = (ok, value) => {
      if (done) return
      done = true
      clearTimeout(hedge)
      for (const c of live) c.abort()
      signal?.removeEventListener('abort', onAbort)
      ok ? resolve(value) : reject(value)
    }
    const onAbort = () => finish(false, abortError())
    signal?.addEventListener('abort', onAbort, { once: true })

    const launch = () => {
      clearTimeout(hedge)
      if (done || next >= list.length) return
      const run = list[next++]
      const ctrl = new AbortController()
      let timedOut = false
      const limit = setTimeout(() => { timedOut = true; ctrl.abort() }, perServerMs)
      live.add(ctrl)
      hedge = setTimeout(launch, hedgeMs) // slow? ask the next one too

      let req
      try { req = Promise.resolve(run(ctrl.signal)) } catch (e) { req = Promise.reject(e) }
      req
        .then((found) => finish(true, nearestFirst(found, box)))
        .catch((e) => { if (timedOut || e?.busy) busy = true })
        .finally(() => {
          clearTimeout(limit)
          live.delete(ctrl)
          if (done) return
          if (next < list.length) launch()
          else if (!live.size) finish(false, new Error(busy ? 'busy' : 'unavailable'))
        })
    }
    launch()
  })
}
