import { describe, it, expect, vi } from 'vitest'
import {
  parseFastMosques, fetchMosquesFast, viewBounds, pickCached, addCached, boxCovers, FRESH_MS, KEEP_MS,
} from '../src/lib/placeCache.js'
import { distanceKm } from '../src/lib/places.js'

describe('fast mosques (Nominatim)', () => {
  const rows = [
    { osm_type: 'way', osm_id: 1, category: 'amenity', type: 'place_of_worship', name: 'East London Mosque', lat: '51.517', lon: '-0.065', extratags: { religion: 'muslim' } },
    { osm_type: 'node', osm_id: 2, category: 'amenity', type: 'place_of_worship', name: 'St Mary', lat: '51.5', lon: '-0.1', extratags: { religion: 'christian' } },
    { osm_type: 'node', osm_id: 3, category: 'highway', type: 'bus_stop', name: 'Mosque Stop', lat: '51.5', lon: '-0.1', extratags: {} },
    { osm_type: 'way', osm_id: 1, category: 'amenity', type: 'place_of_worship', name: 'dup', lat: '51.517', lon: '-0.065', extratags: { religion: 'muslim' } },
  ]
  it('keeps only Muslim places of worship, once, with Overpass-style ids', () => {
    const out = parseFastMosques(rows)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'way/1', kind: 'mosque', name: 'East London Mosque', lat: 51.517, lng: -0.065, cuisine: [] })
  })
  it('survives junk', () => expect(parseFastMosques(null)).toEqual([]))
  it('asks only inside the box, in the user language', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => rows }))
    await fetchMosquesFast({ s: 51.45, w: -0.21, n: 51.56, e: -0.04 }, { lang: 'ar', fetchImpl: f })
    const url = new URL(f.mock.calls[0][0])
    expect(url.searchParams.get('bounded')).toBe('1')
    expect(url.searchParams.get('viewbox')).toBe('-0.21000,51.56000,-0.04000,51.45000')
    expect(url.searchParams.get('accept-language')).toBe('ar')
  })
})

describe('viewBounds', () => {
  it('matches what a 412 x 700 phone map shows at zoom 15 in London', () => {
    const c = { lat: 51.5, lng: -0.12 }
    const b = viewBounds(c, 15, { x: 412, y: 700 })
    // ~2.97 m per pixel at this latitude and zoom
    expect(distanceKm({ lat: c.lat, lng: b.w }, { lat: c.lat, lng: b.e })).toBeCloseTo(1.22, 1)
    expect(distanceKm({ lat: b.s, lng: c.lng }, { lat: b.n, lng: c.lng })).toBeCloseTo(2.08, 1)
  })
  it('doubles with every zoom level out', () => {
    const c = { lat: 0, lng: 0 }, size = { x: 400, y: 400 }
    const a = viewBounds(c, 14, size), b = viewBounds(c, 13, size)
    expect((b.e - b.w) / (a.e - a.w)).toBeCloseTo(2, 5)
  })
})

describe('remembered areas', () => {
  const box = { s: 51.48, n: 51.54, w: -0.18, e: -0.06 }
  const inner = { s: 51.5, n: 51.52, w: -0.14, e: -0.1 }
  const now = 1_000_000_000_000
  const entry = (b, at, lang = 'en', places = [{ id: 'node/1' }]) => ({ box: b, at, lang, places })

  it('reuses a recent result that covers the area, without asking again', () => {
    const hit = pickCached([entry(box, now - 1000)], inner, 'en', now)
    expect(hit.places).toEqual([{ id: 'node/1' }])
    expect(hit.fresh).toBe(true)
  })
  it('shows an older or partly covering result but asks again', () => {
    expect(pickCached([entry(box, now - FRESH_MS - 1)], inner, 'en', now).fresh).toBe(false)
    const shifted = { s: 51.5, n: 51.56, w: -0.12, e: -0.02 } // centre (51.53, -0.07) inside, edges outside
    expect(pickCached([entry(box, now)], shifted, 'en', now).fresh).toBe(false)
  })
  it('ignores other languages, far-away areas and very old results', () => {
    expect(pickCached([entry(box, now, 'ar')], inner, 'en', now)).toBeNull()
    expect(pickCached([entry(box, now)], { s: 48.8, n: 48.9, w: 2.3, e: 2.4 }, 'en', now)).toBeNull()
    expect(pickCached([entry(box, now - KEEP_MS - 1)], inner, 'en', now)).toBeNull()
    expect(pickCached(null, inner, 'en', now)).toBeNull()
  })
  it('prefers the newest match', () => {
    const hit = pickCached([entry(box, now - 5000, 'en', ['old']), entry(box, now - 10, 'en', ['new'])], inner, 'en', now)
    expect(hit.places).toEqual(['new'])
  })
  it('drops results a new one fully covers, and keeps the list short', () => {
    expect(addCached([entry(inner, 1)], entry(box, 2))).toHaveLength(1)
    expect(addCached([entry(inner, 1, 'ar')], entry(box, 2))).toHaveLength(2)
    let list = []
    for (let i = 0; i < 20; i++) list = addCached(list, entry({ s: i, n: i + 0.1, w: 0, e: 0.1 }, i))
    expect(list.length).toBeLessThanOrEqual(8)
    expect(list[0].at).toBe(19)
  })
  it('boxCovers', () => {
    expect(boxCovers(box, inner)).toBe(true)
    expect(boxCovers(inner, box)).toBe(false)
  })
})
