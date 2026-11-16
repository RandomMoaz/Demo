import { describe, it, expect, vi } from 'vitest'
import { addressQuery, parseGeocode, geocode } from '../src/lib/geocode.js'
import { MAP_TEXT, ocrLangFor } from '../src/lib/mapText.js'

describe('addressQuery (text read from a photo)', () => {
  it('keeps the address lines of a business card and drops contact lines', () => {
    const raw = 'AL NOOR MOSQUE\n12 Rue de la Paix\n75002 Paris\nTel: +33 1 23 45 67 89\nwww.alnoor.fr'
    expect(addressQuery(raw)).toBe('12 Rue de la Paix, 75002 Paris')
  })
  it('uses the first lines when there is no number', () => {
    expect(addressQuery('Shinjuku Station\nEast Exit')).toBe('Shinjuku Station, East Exit')
  })
  it('drops OCR noise', () => {
    expect(addressQuery('|||| ~~~ ==\n.,;:\nOxford Street 200\n#*#*')).toBe('Oxford Street 200')
  })
  it('reads Arabic and Japanese lines', () => {
    expect(addressQuery('شارع الملك فهد 25\nالرياض')).toBe('شارع الملك فهد 25')
    expect(addressQuery('東京都新宿区西新宿2丁目8-1')).toBe('東京都新宿区西新宿2丁目8-1')
  })
  it('keeps the query short', () => {
    const long = Array.from({ length: 10 }, (_, i) => `${i + 1} Very Long Street Name Avenue`).join('\n')
    expect(addressQuery(long).length).toBeLessThanOrEqual(120)
  })
  it('returns empty for nothing readable', () => {
    expect(addressQuery('')).toBe('')
    expect(addressQuery('12 34\n--\n%%')).toBe('')
  })
})

describe('geocode', () => {
  const rows = [
    { osm_type: 'relation', osm_id: 1, name: 'Tripoli', display_name: 'Tripoli, Tripoli District, Libya', lat: '32.89', lon: '13.19', boundingbox: ['32.7', '33.0', '13.0', '13.4'] },
    { osm_type: 'node', osm_id: 2, display_name: 'Tripoli, North Governorate, Lebanon', lat: '34.43', lon: '35.84' },
    { osm_type: 'node', osm_id: 3, display_name: 'broken', lat: 'x', lon: '1' },
  ]
  it('parses places with bounds and a short subtitle', () => {
    const out = parseGeocode(rows)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ id: 'relation/1', label: 'Tripoli', sub: 'Tripoli District, Libya', lat: 32.89, lng: 13.19, bounds: { s: 32.7, n: 33, w: 13, e: 13.4 } })
    expect(out[1]).toMatchObject({ label: 'Tripoli', sub: 'North Governorate, Lebanon', bounds: null })
  })
  it('tells a city (open close up) from a country (show whole)', () => {
    const [city, country] = parseGeocode([
      { osm_type: 'relation', osm_id: 5, name: 'Paris', display_name: 'Paris, France', lat: '48.85', lon: '2.35', place_rank: 16 },
      { osm_type: 'relation', osm_id: 6, name: 'Japan', display_name: 'Japan', lat: '36', lon: '138', place_rank: 4 },
    ])
    expect(city.city).toBe(true)
    expect(country.city).toBe(false)
    // Greater London is ranked like a region but is a city
    expect(parseGeocode([{ osm_id: 7, display_name: 'Greater London', lat: '51.5', lon: '-0.1', place_rank: 10, addresstype: 'city' }])[0].city).toBe(true)
    expect(parseGeocode([{ osm_id: 8, display_name: 'Bavaria', lat: '48.9', lon: '11.4', place_rank: 8, addresstype: 'state' }])[0].city).toBe(false)
  })
  it('asks Nominatim in the user language, biased to the visible map', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => rows }))
    await geocode('Tripoli', { lang: 'ar', near: { s: 30, n: 35, w: 10, e: 40 }, fetchImpl: f })
    const url = new URL(f.mock.calls[0][0])
    expect(url.hostname).toBe('nominatim.openstreetmap.org')
    expect(url.searchParams.get('q')).toBe('Tripoli')
    expect(url.searchParams.get('accept-language')).toBe('ar')
    expect(url.searchParams.get('viewbox')).toBe('10.0000,35.0000,40.0000,30.0000')
  })
  it('does not call the server for an empty query', async () => {
    const f = vi.fn()
    expect(await geocode('  ', { fetchImpl: f })).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })
  it('reports a busy server', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 429 }))
    await expect(geocode('x', { fetchImpl: f })).rejects.toThrow('busy')
  })
})

describe('map words', () => {
  const shape = (o) => Object.keys(o).sort().map((k) => (o[k] && typeof o[k] === 'object' ? `${k}{${shape(o[k])}}` : k)).join(',')
  it.each(Object.keys(MAP_TEXT))('%s has every key English has', (lang) => {
    expect(shape(MAP_TEXT[lang])).toBe(shape(MAP_TEXT.en))
  })
  it('matches the app languages', () => expect(Object.keys(MAP_TEXT).sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'ja']))
  it('picks a sensible OCR language', () => {
    expect(ocrLangFor('ar')).toBe('eng+ara')
    expect(ocrLangFor('ja')).toBe('eng+jpn')
    expect(ocrLangFor('fr')).toBe('eng')
    for (const l of Object.keys(MAP_TEXT)) expect(Object.keys(MAP_TEXT[l].langs)).toContain(ocrLangFor(l))
  })
})
