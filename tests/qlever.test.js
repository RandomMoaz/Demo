import { describe, it, expect, vi } from 'vitest'
import { qleverQuery, parseCsv, parseQlever, fetchQlever, warmQlever } from '../src/lib/qlever.js'
import { suggest, parsePhoton, addRecent } from '../src/lib/geocode.js'

const K = 'https://www.openstreetmap.org/wiki/Key:'
const row = (osm, c, k, v) => [`https://www.openstreetmap.org/${osm}`, c, `${K}${k}`, v].map((x) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(',')

describe('QLever query', () => {
  const q = qleverQuery({ lat: 51.5, lng: -0.12 }, 8000.4, 'ar')
  it('searches a circle around the centre with the spatial index', () => {
    expect(q).toContain('"POINT(-0.120000 51.500000)"^^geo:wktLiteral')
    expect(q).toContain('spatialSearch:maxDistance 8000')
    expect(q).toContain('spatialSearch:libspatialjoin')
  })
  it('asks for mosques, prayer rooms and halal places, with only the tags the app uses', () => {
    expect(q).toContain('"muslim"'); expect(q).toContain('"multifaith"'); expect(q).toContain('osmkey:diet:halal ?x')
    expect(q).toContain('osmkey:opening_hours'); expect(q).toContain('osmkey:name:ar')
    expect(q).not.toContain('osmkey:fixme')
  })
})

describe('parseCsv', () => {
  it('handles quotes, commas and line breaks inside fields', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere']])
    expect(parseCsv('')).toEqual([])
  })
})

describe('parseQlever', () => {
  const csv = ['osm,c,k,v',
    row('way/7', 'POINT(-0.065 51.517)', 'amenity', 'place_of_worship'),
    row('way/7', 'POINT(-0.065 51.517)', 'religion', 'muslim'),
    row('way/7', 'POINT(-0.065 51.517)', 'name', 'East London Mosque'),
    row('way/7', 'POINT(-0.065 51.517)', 'opening_hours', 'Mo-Su 04:00-23:00'),
    row('node/8', 'POINT(-0.07 51.52)', 'amenity', 'restaurant'),
    row('node/8', 'POINT(-0.07 51.52)', 'diet:halal', 'only'),
    row('node/8', 'POINT(-0.07 51.52)', 'name', 'Grill, "The Best"'),
    row('node/9', 'POINT(-0.07 51.52)', 'tourism', 'hotel'),
    row('node/9', 'POINT(-0.07 51.52)', 'diet:halal', 'yes'),
  ].join('\n')
  it('groups the tag rows of each place and reads its centre', () => {
    const out = parseQlever(csv, 'en')
    expect(out).toHaveLength(2) // the hotel is not something the map shows
    expect(out[0]).toMatchObject({ id: 'way/7', kind: 'mosque', lat: 51.517, lng: -0.065, name: 'East London Mosque', hours: 'Mo-Su 04:00-23:00' })
    expect(out[1]).toMatchObject({ id: 'node/8', kind: 'food', halal: 'only', name: 'Grill, "The Best"' })
  })
  it('refuses an answer that is not ours', () => expect(parseQlever('{"exception":"x"}')).toBeNull())
})

describe('fetchQlever', () => {
  it('posts the query and reports an overloaded server as busy', async () => {
    const f = vi.fn(async () => ({ ok: true, text: async () => 'osm,c,k,v\n' }))
    expect(await fetchQlever({ center: { lat: 1, lng: 2 }, radiusM: 500, fetchImpl: f })).toEqual([])
    expect(f.mock.calls[0][1].headers.Accept).toBe('text/csv')
    await expect(fetchQlever({ center: { lat: 1, lng: 2 }, radiusM: 500, fetchImpl: async () => ({ ok: false, status: 503 }) })).rejects.toMatchObject({ busy: true })
    await expect(fetchQlever({ center: { lat: 1, lng: 2 }, radiusM: 500, fetchImpl: async () => ({ ok: true, text: async () => '<html>' }) })).rejects.toMatchObject({ busy: true })
  })
})

describe('warmQlever', () => {
  it('sends one tiny query of the same shape, and not again for ten minutes', async () => {
    const f = vi.fn(async () => ({ ok: true, text: async () => 'osm,c,k,v\n' }))
    expect(warmQlever({ fetchImpl: f, now: 1e12 })).toBe(true)
    expect(warmQlever({ fetchImpl: f, now: 1e12 + 60000 })).toBe(false)
    expect(warmQlever({ fetchImpl: f, now: 1e12 + 11 * 60000 })).toBe(true)
    expect(f).toHaveBeenCalledTimes(2)
    const body = decodeURIComponent(f.mock.calls[0][1].body)
    expect(body).toContain('spatialSearch:maxDistance 1 ')
    expect(body).toContain(qleverQuery({ lat: 9, lng: 9 }, 5000).split('spatialSearch:payload')[1].split('BIND(geof')[0])
  })
})

describe('suggestions while typing', () => {
  const photon = { features: [
    { geometry: { coordinates: [-1.89, 52.48] }, properties: { name: 'Birmingham', type: 'city', country: 'United Kingdom', state: 'England', extent: [-2.03, 52.6, -1.72, 52.38], osm_type: 'R', osm_id: 162378 } },
    { geometry: { coordinates: [-86.8, 33.5] }, properties: { name: 'Birmingham', type: 'city', state: 'Alabama', country: 'United States', osm_type: 'R', osm_id: 1 } },
    { geometry: { coordinates: [-1.89, 52.48] }, properties: { name: 'Birmingham', type: 'city', country: 'United Kingdom', state: 'England', osm_type: 'N', osm_id: 2 } }, // same place again
    { geometry: { coordinates: [-0.07, 51.52] }, properties: { street: 'Whitechapel Road', housenumber: '82', city: 'London', type: 'house', osm_type: 'N', osm_id: 3 } },
    { geometry: { coordinates: [10, 51] }, properties: { name: 'Germany', type: 'country', osm_type: 'R', osm_id: 51477 } },
  ] }
  it('reads Photon results like Nominatim ones', () => {
    const out = parsePhoton(photon)
    expect(out).toHaveLength(4)
    expect(out[0]).toMatchObject({ id: 'relation/162378', label: 'Birmingham', sub: 'England, United Kingdom', city: true, bounds: { s: 52.38, n: 52.6, w: -2.03, e: -1.72 } })
    expect(out[2]).toMatchObject({ label: 'Whitechapel Road 82', sub: 'London' })
    expect(out[3].city).toBe(false)
  })
  it('waits for three letters, uses a supported language, and asks once per text', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => photon }))
    expect(await suggest('bi', { fetchImpl: f })).toEqual([])
    await suggest('Birmingh', { lang: 'ar', near: { lat: 51.5, lng: -0.1 }, fetchImpl: f })
    await suggest('birmingh', { lang: 'ar', fetchImpl: f })
    expect(f).toHaveBeenCalledTimes(1)
    const url = new URL(f.mock.calls[0][0])
    expect(url.searchParams.get('lang')).toBeNull()
    expect(url.searchParams.get('lat')).toBe('51.500')
    await suggest('Birmingh', { lang: 'de', fetchImpl: f })
    expect(new URL(f.mock.calls[1][0]).searchParams.get('lang')).toBe('de')
  })
  it('keeps the newest recent searches, once each', () => {
    let list = []
    for (const id of ['a', 'b', 'a', 'c', 'd', 'e', 'f']) list = addRecent(list, { id, label: id, lat: 1, lng: 2 })
    expect(list.map((r) => r.id)).toEqual(['f', 'e', 'd', 'c', 'a'])
    expect(addRecent(list, { id: 'x', label: '', lat: 1, lng: 2 })).toBe(list)
  })
})
