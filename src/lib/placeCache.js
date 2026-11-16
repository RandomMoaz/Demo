import { placeFromTags } from './placeTags.js'

const rad = (d) => (d * Math.PI) / 180

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

export function parseFastMosques(rows) {
  const out = []
  const seen = new Set()
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r?.extratags?.religion !== 'muslim' || r.category !== 'amenity' || r.type !== 'place_of_worship') continue
    const id = `${r.osm_type}/${r.osm_id}`
    if (seen.has(id)) continue
    const p = placeFromTags(id, parseFloat(r.lat), parseFloat(r.lon), { ...r.extratags, amenity: 'place_of_worship', name: r.name || '' })
    if (!p) continue
    seen.add(id)
    out.push(p)
  }
  return out
}

export async function fetchMosquesFast(box, { lang = 'en', signal, fetchImpl = fetch } = {}) {
  const p = new URLSearchParams({
    q: 'mosque', format: 'jsonv2', limit: '50', bounded: '1', extratags: '1', 'accept-language': lang,
    viewbox: [box.w, box.n, box.e, box.s].map((v) => v.toFixed(5)).join(','),
  })
  const res = await fetchImpl(`${NOMINATIM}?${p}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('unavailable')
  return parseFastMosques(await res.json())
}

export function viewBounds(center, zoom, size) {
  const kmPerPx = (156543.03392 * Math.cos(rad(center.lat))) / 2 ** zoom / 1000
  const halfH = (size.y * kmPerPx) / 2, halfW = (size.x * kmPerPx) / 2
  const dLat = halfH / 111.32, dLng = halfW / (111.32 * Math.max(0.05, Math.cos(rad(center.lat))))
  return { s: center.lat - dLat, n: center.lat + dLat, w: center.lng - dLng, e: center.lng + dLng }
}

const KEY = 'mc_places_v2'
export const FRESH_MS = 6 * 60 * 60 * 1000
export const KEEP_MS = 14 * 24 * 60 * 60 * 1000 // older than this is forgotten
const MAX_ENTRIES = 8

export const boxHas = (b, p) => p.lat >= b.s && p.lat <= b.n && p.lng >= b.w && p.lng <= b.e
export const boxCovers = (outer, inner) => inner.s >= outer.s && inner.n <= outer.n && inner.w >= outer.w && inner.e <= outer.e
const centre = (b) => ({ lat: (b.s + b.n) / 2, lng: (b.w + b.e) / 2 })

export function pickCached(entries, box, lang, now = Date.now()) {
  const c = centre(box)
  const hit = (entries || [])
    .filter((e) => e && e.lang === lang && now - e.at < KEEP_MS && boxHas(e.box, c))
    .sort((a, b) => b.at - a.at)[0]
  if (!hit) return null
  return { places: hit.places, fresh: boxCovers(hit.box, box) && now - hit.at < FRESH_MS }
}

export function addCached(entries, entry) {
  const rest = (entries || []).filter((e) => e && !(e.lang === entry.lang && boxCovers(entry.box, e.box)))
  return [entry, ...rest].slice(0, MAX_ENTRIES)
}

export function loadCache() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : [] } catch { return [] }
}

export function saveCache(entries) {
  try { localStorage.setItem(KEY, JSON.stringify(entries)) } catch {
    // storage full or blocked: keep only the newest entry, or give up quietly
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 1))) } catch { /* ignore */ }
  }
}
