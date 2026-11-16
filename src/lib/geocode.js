const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

const SETTLEMENT = new Set(['city', 'town', 'village', 'hamlet', 'municipality', 'borough', 'city_district', 'suburb', 'quarter', 'neighbourhood'])

/** Nominatim JSON -> { id, label, sub, lat, lng, bounds, city } */
export function parseGeocode(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon)
    const [s, n, w, e] = (r.boundingbox || []).map(parseFloat)
    const parts = String(r.display_name || '').split(',').map((x) => x.trim()).filter(Boolean)
    return {
      id: `${r.osm_type || 'x'}/${r.osm_id || r.place_id}`,
      label: r.name || parts[0] || '',
      sub: parts.slice(1).slice(-3).join(', '),
      lat, lng,
      bounds: [s, n, w, e].every(Number.isFinite) ? { s, n, w, e } : null,
      city: SETTLEMENT.has(r.addresstype) || Number(r.place_rank) >= 13,
    }
  }).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
}

const memo = new Map()
const remember = (key, rows) => { memo.set(key, rows); if (memo.size > 60) memo.delete(memo.keys().next().value); return rows }
export const clearGeocodeMemo = () => memo.clear()

export async function geocode(q, { lang = 'en', near, signal, fetchImpl = fetch } = {}) {
  const query = String(q || '').trim()
  if (!query) return []
  const key = `n|${lang}|${query.toLowerCase()}`
  if (memo.has(key)) return memo.get(key)
  const p = new URLSearchParams({ q: query, format: 'jsonv2', limit: '6', 'accept-language': lang })
  if (near) p.set('viewbox', [near.w, near.n, near.e, near.s].map((v) => v.toFixed(4)).join(','))
  const res = await fetchImpl(`${NOMINATIM}?${p}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(res.status === 429 ? 'busy' : 'unavailable')
  return remember(key, parseGeocode(await res.json()))
}

const PHOTON = 'https://photon.komoot.io/api/'
const PHOTON_LANGS = ['en', 'de', 'fr'] // the others get names as written locally
const BIG = new Set(['country', 'state', 'county'])

export function parsePhoton(json) {
  const seen = new Set()
  const out = []
  for (const f of json?.features || []) {
    const pr = f?.properties || {}
    const [lng, lat] = f?.geometry?.coordinates || []
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const street = [pr.street, pr.housenumber].filter(Boolean).join(' ')
    const label = pr.name || street
    if (!label) continue
    const sub = [pr.name && street, pr.district, pr.city, pr.state, pr.country]
      .filter((x, i, a) => x && x !== label && a.indexOf(x) === i).slice(-3).join(', ')
    const key = `${label}|${sub}`
    if (seen.has(key)) continue
    seen.add(key)
    const [w, n, e, s] = Array.isArray(pr.extent) ? pr.extent : []
    out.push({
      id: `${{ N: 'node', W: 'way', R: 'relation' }[pr.osm_type] || 'x'}/${pr.osm_id}`,
      label, sub, lat, lng,
      bounds: [s, n, w, e].every(Number.isFinite) ? { s, n, w, e } : null,
      city: !BIG.has(pr.type),
    })
  }
  return out
}

export async function suggest(q, { lang = 'en', near, signal, fetchImpl = fetch } = {}) {
  const query = String(q || '').trim()
  if (query.length < 3) return []
  const key = `p|${lang}|${query.toLowerCase()}`
  if (memo.has(key)) return memo.get(key)
  const p = new URLSearchParams({ q: query, limit: '6' })
  if (PHOTON_LANGS.includes(lang)) p.set('lang', lang)
  if (near) { p.set('lat', near.lat.toFixed(3)); p.set('lon', near.lng.toFixed(3)) }
  const res = await fetchImpl(`${PHOTON}?${p}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(res.status === 429 ? 'busy' : 'unavailable')
  return remember(key, parsePhoton(await res.json()).slice(0, 5))
}

const RECENT = 'mc_recent_places_v1'
const MAX_RECENT = 5

/** Put `r` first in the list, without duplicates, keeping the newest few. */
export function addRecent(list, r) {
  if (!r || !Number.isFinite(r.lat) || !Number.isFinite(r.lng) || !r.label) return list || []
  const { id, label, sub, lat, lng, bounds, city } = r
  return [{ id, label, sub, lat, lng, bounds, city }, ...(list || []).filter((x) => x.id !== id || x.label !== label)].slice(0, MAX_RECENT)
}
export function loadRecent() {
  try { const v = JSON.parse(localStorage.getItem(RECENT)); return Array.isArray(v) ? v.filter((r) => r && Number.isFinite(r.lat)) : [] } catch { return [] }
}
export function saveRecent(list) {
  try { localStorage.setItem(RECENT, JSON.stringify(list)) } catch { /* storage blocked: no recent list */ }
}

// lines that are on almost every sign or card but never help find a place
const NOISE = /^(tel|phone|fax|mob|mobile|e-?mail|www\.|http|open|hours|ساعات|هاتف|電話|営業)/i
const letters = (s) => (s.match(/\p{L}/gu) || []).length

export function addressQuery(raw, max = 120) {
  const lines = String(raw || '')
    .split(/\n+/)
    .map((l) => l.replace(/[|_~=*#<>{}[\]\\]+/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter((l) => letters(l) >= 3 && letters(l) / l.replace(/\s/g, '').length >= 0.5 && !NOISE.test(l))
  if (!lines.length) return ''
  const addr = lines.filter((l) => /\d/.test(l))
  const picked = addr.length ? addr : lines.slice(0, 2)
  let q = ''
  for (const l of picked) {
    const next = q ? `${q}, ${l}` : l
    if (next.length > max) break
    q = next
  }
  return q || picked[0].slice(0, max).trim()
}
