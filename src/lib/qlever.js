import { placeFromTags, WANTED_TAGS, HALAL_LEVELS } from './placeTags.js'

export const QLEVER = 'https://qlever.dev/api/osm-planet'

const OSM = 'https://www.openstreetmap.org/'
const KEY = `${OSM}wiki/Key:`

export function qleverQuery(center, radiusM, lang = 'en') {
  const keys = [...new Set([...WANTED_TAGS, `name:${lang}`])].map((k) => `osmkey:${k}`).join(' ')
  const lit = (vals) => vals.map((v) => `?x = "${v}"`).join(' || ')
  return `PREFIX osmkey: <${KEY}>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
PREFIX spatialSearch: <https://qlever.cs.uni-freiburg.de/spatialSearch/>
SELECT ?osm ?c ?k ?v WHERE {
  BIND("POINT(${center.lng.toFixed(6)} ${center.lat.toFixed(6)})"^^geo:wktLiteral AS ?center)
  SERVICE spatialSearch: {
    _:config spatialSearch:algorithm spatialSearch:libspatialjoin ; spatialSearch:joinType spatialSearch:within-dist ;
      spatialSearch:left ?center ; spatialSearch:right ?geom ; spatialSearch:maxDistance ${Math.round(radiusM)} ;
      spatialSearch:payload ?osm, ?geom .
    {
      { ?osm osmkey:amenity "place_of_worship" ; osmkey:religion ?x . FILTER(${lit(['muslim', 'multifaith'])}) }
      UNION
      { ?osm osmkey:diet:halal ?x . FILTER(${lit(HALAL_LEVELS)}) }
      ?osm geo:hasGeometry/geo:asWKT ?geom .
    }
  }
  BIND(geof:centroid(?geom) AS ?c)
  ?osm ?k ?v .
  VALUES ?k { ${keys} }
}`
}

export function parseCsv(text) {
  const rows = []
  let row = [], field = '', i = 0, quoted = false
  const s = String(text || '')
  while (i < s.length) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i += 2; continue }
      if (ch === '"') { quoted = false; i++; continue }
      field += ch; i++; continue
    }
    if (ch === '"') { quoted = true; i++ }
    else if (ch === ',') { row.push(field); field = ''; i++ }
    else if (ch === '\n' || ch === '\r') {
      row.push(field); rows.push(row); row = []; field = ''
      i += ch === '\r' && s[i + 1] === '\n' ? 2 : 1
    } else { field += ch; i++ }
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const POINT = /^POINT\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/

/** QLever CSV (osm, centroid, key, value per row) -> places, one per OSM object. */
export function parseQlever(csv, lang = 'en') {
  const rows = parseCsv(csv)
  if (!rows.length || rows[0].join(',') !== 'osm,c,k,v') return null // not our answer (an error page…)
  const byId = new Map()
  for (let r = 1; r < rows.length; r++) {
    const [osm, c, k, v] = rows[r]
    if (!osm?.startsWith(OSM) || !k?.startsWith(KEY)) continue
    let e = byId.get(osm)
    if (!e) {
      const m = POINT.exec(c || '')
      if (!m) continue
      e = { lat: parseFloat(m[2]), lng: parseFloat(m[1]), tags: {} }
      byId.set(osm, e)
    }
    e.tags[k.slice(KEY.length)] = v
  }
  const out = []
  for (const [osm, e] of byId) {
    const p = placeFromTags(osm.slice(OSM.length), e.lat, e.lng, e.tags, lang)
    if (p) out.push(p)
  }
  return out
}

const failure = (busy) => Object.assign(new Error(busy ? 'busy' : 'unavailable'), { busy })

const WARM_EVERY_MS = 10 * 60 * 1000
let warmedAt = -Infinity
export function warmQlever({ lang = 'en', fetchImpl = fetch, now = Date.now() } = {}) {
  if (now - warmedAt < WARM_EVERY_MS) return false
  warmedAt = now
  fetchQlever({ center: { lat: 0, lng: 0 }, radiusM: 1, lang, fetchImpl }).catch(() => { warmedAt = -Infinity })
  return true
}

export async function fetchQlever({ center, radiusM, lang = 'en', signal, fetchImpl = fetch, url = QLEVER }) {
  const res = await fetchImpl(url, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/csv' },
    body: 'query=' + encodeURIComponent(qleverQuery(center, radiusM, lang)),
  })
  if (!res.ok) throw failure(res.status === 429 || res.status >= 500)
  const places = parseQlever(await res.text(), lang)
  if (!places) throw failure(true)
  return places
}
