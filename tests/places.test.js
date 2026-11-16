import { describe, it, expect, vi } from 'vitest'
import {
  overpassQuery, parsePlaces, distanceKm, searchBox, boxWasClamped, arrange, countKinds,
  formatDistance, walkMinutes, directionsUrl, osmUrl, safeUrl, fetchPlaces, placeName,
  nearestFirst, coveredBox, safeEmail, MAX_PLACES,
} from '../src/lib/places.js'

const MAKKAH = { lat: 21.4225, lng: 39.8262 }
const MADINAH = { lat: 24.4672, lng: 39.6111 }

const sample = {
  elements: [
    { type: 'node', id: 1, lat: 21.423, lon: 39.826, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'المسجد الحرام', 'name:en': 'Masjid al-Haram' } },
    { type: 'way', id: 2, center: { lat: 21.43, lon: 39.83 }, tags: { amenity: 'restaurant', 'diet:halal': 'only', name: 'Al Baik', cuisine: 'chicken;fast_food', 'addr:street': 'Ibrahim Al Khalil', 'addr:housenumber': '12', 'addr:city': 'Makkah', opening_hours: 'Mo-Su 10:00-02:00', website: 'albaik.com' } },
    { type: 'node', id: 3, lat: 21.5, lon: 39.9, tags: { amenity: 'cafe', 'diet:halal': 'limited' } },
    { type: 'relation', id: 4, tags: { amenity: 'place_of_worship', religion: 'muslim' } }, // no coordinates
    { type: 'node', id: 1, lat: 21.423, lon: 39.826, tags: { amenity: 'place_of_worship', religion: 'muslim' } }, // duplicate
  ],
}

describe('overpassQuery', () => {
  const q = overpassQuery({ s: 51.5, w: -0.13, n: 51.52, e: -0.1 })
  it('searches the given box', () => expect(q).toContain('[bbox:51.50000,-0.13000,51.52000,-0.10000]'))
  it('asks for mosques, prayer rooms, and halal places to eat or shop', () => {
    expect(q).toContain('["amenity"="place_of_worship"]["religion"~"^(muslim|multifaith)$"]')
    expect(q).toMatch(/\["diet:halal"~"\^\(yes\|only\|limited\)\$"\]->\.h/)
    expect(q).toMatch(/nwr\.h\["amenity"~"\^\(restaurant\|fast_food\|cafe/)
    expect(q).toContain('nwr.h["shop"]')
  })
  it('returns centres for ways and caps the result size', () => expect(q).toMatch(/out center tags qt \d+;$/))
})

describe('parsePlaces', () => {
  const places = parsePlaces(sample, 'en')
  it('keeps only placeable, unique elements', () => expect(places.map((p) => p.id)).toEqual(['node/1', 'way/2', 'node/3']))
  it('uses the way centre', () => expect(places[1]).toMatchObject({ lat: 21.43, lng: 39.83 }))
  it('sorts kinds and halal level', () => {
    expect(places[0]).toMatchObject({ kind: 'mosque', halal: null })
    expect(places[1]).toMatchObject({ kind: 'food', halal: 'only', type: 'restaurant' })
    expect(places[2]).toMatchObject({ kind: 'food', halal: 'limited', type: 'cafe', name: '' })
  })
  it('names places in the user language when the map has it', () => {
    expect(places[0].name).toBe('Masjid al-Haram')
    expect(parsePlaces(sample, 'ar')[0].name).toBe('المسجد الحرام')
    expect(placeName({ name: 'Moschee', 'name:de': 'Moschee DE' }, 'de')).toBe('Moschee DE')
  })
  it('builds address, cuisine and hours', () => {
    expect(places[1].address).toBe('12 Ibrahim Al Khalil, Makkah')
    expect(places[1].cuisine).toEqual(['chicken', 'fast food'])
    expect(places[1].hours).toBe('Mo-Su 10:00-02:00')
  })
  it('survives empty or broken input', () => {
    expect(parsePlaces(null)).toEqual([])
    expect(parsePlaces({})).toEqual([])
    expect(parsePlaces({ elements: [{ type: 'node', id: 9, lat: 'x', lon: 1 }] })).toEqual([])
  })
})

describe('distance and box', () => {
  it('Makkah to Madinah is about 340 km', () => {
    const d = distanceKm(MAKKAH, MADINAH)
    expect(d).toBeGreaterThan(330); expect(d).toBeLessThan(350)
  })
  it('is zero for the same point', () => expect(distanceKm(MAKKAH, MAKKAH)).toBe(0))

  it('keeps a mid-size view as it is', () => {
    const b = { s: 21.37, n: 21.47, w: 39.77, e: 39.88 } // about 11 x 11 km
    const box = searchBox(b, MAKKAH)
    expect(box).toEqual(b)
    expect(boxWasClamped(b, box)).toBe(false)
  })
  it('grows a street-level view to about 5 km so the nearest places are found', () => {
    const b = { s: 21.42, n: 21.425, w: 39.824, e: 39.829 } // about 0.5 km
    const box = searchBox(b, MAKKAH)
    expect(distanceKm({ lat: box.s, lng: MAKKAH.lng }, { lat: box.n, lng: MAKKAH.lng })).toBeCloseTo(5, 0)
    expect(distanceKm({ lat: MAKKAH.lat, lng: box.w }, { lat: MAKKAH.lat, lng: box.e })).toBeCloseTo(5, 0)
    expect(boxWasClamped(b, box)).toBe(false) // it searched more than the screen, not less
  })
  it('cuts a city-wide view down to about 12 km around the centre', () => {
    const b = { s: 21, n: 22, w: 39, e: 40.5 }
    const box = searchBox(b, MAKKAH)
    expect(boxWasClamped(b, box)).toBe(true)
    expect(distanceKm({ lat: box.s, lng: MAKKAH.lng }, { lat: box.n, lng: MAKKAH.lng })).toBeCloseTo(12, 0)
    expect(distanceKm({ lat: MAKKAH.lat, lng: box.w }, { lat: MAKKAH.lat, lng: box.e })).toBeCloseTo(12, 0)
  })
  it('stays sane near the poles and the date line', () => {
    const box = searchBox({ s: 70, n: 80, w: 170, e: 190 }, { lat: 78, lng: 179.9 })
    expect(box.e).toBeLessThanOrEqual(180)
    expect(box.n).toBeLessThanOrEqual(90)
  })
})

describe('arrange and count', () => {
  const places = parsePlaces(sample, 'en')
  it('puts the nearest first and adds the distance', () => {
    const list = arrange(places, { from: { lat: 21.5, lng: 39.9 } })
    expect(list[0].id).toBe('node/3')
    expect(list[0].km).toBe(0)
    expect(list.every((p, i) => i === 0 || p.km >= list[i - 1].km)).toBe(true)
  })
  it('filters by kind', () => {
    expect(arrange(places, { filter: 'mosque' }).map((p) => p.id)).toEqual(['node/1'])
    expect(arrange(places, { filter: 'food' })).toHaveLength(2)
  })
  it('does not change the input', () => {
    const before = places.map((p) => p.id)
    arrange(places, { from: MADINAH })
    expect(places.map((p) => p.id)).toEqual(before)
  })
  it('counts each kind', () => expect(countKinds(places)).toEqual({ all: 3, mosque: 1, food: 2, shop: 0 }))
})

describe('more about each place', () => {
  const el = (id, tags, lat = 21.42, lon = 39.82) => ({ type: 'node', id, lat, lon, tags })
  const [shop, room, mosque, food] = parsePlaces({ elements: [
    el(10, { shop: 'butcher', 'diet:halal': 'only', name: 'Al Noor Butchers', 'addr:postcode': 'E1 6AA', 'addr:city': 'London' }),
    el(11, { amenity: 'place_of_worship', religion: 'multifaith', name: 'Prayer Room' }),
    el(12, { amenity: 'place_of_worship', religion: 'muslim', denomination: 'Sunni', name: 'Fatih Camii', 'name:en': 'Fatih Mosque' }),
    el(13, { amenity: 'fast_food', 'diet:halal': 'yes', takeaway: 'yes', delivery: 'yes', wheelchair: 'limited', internet_access: 'wlan', 'diet:vegetarian': 'yes', 'contact:email': 'hi@grill.example' }),
    el(14, { amenity: 'place_of_worship', religion: 'christian' }),
    el(15, { tourism: 'hotel', 'diet:halal': 'yes' }),
    el(16, { shop: 'supermarket', 'diet:halal': 'no' }),
  ] }, 'en')
  it('adds halal shops and multi-faith prayer rooms, and leaves out the rest', () => {
    expect(shop).toMatchObject({ kind: 'shop', type: 'butcher', halal: 'only', address: 'E1 6AA London' })
    expect(room).toMatchObject({ kind: 'mosque', type: 'multifaith' })
    expect([shop, room, mosque, food].every(Boolean)).toBe(true)
    expect(parsePlaces({ elements: [el(14, { amenity: 'place_of_worship', religion: 'christian' })] })).toEqual([])
  })
  it('keeps the denomination and the name as written locally', () => {
    expect(mosque).toMatchObject({ denom: 'sunni', name: 'Fatih Mosque', local: 'Fatih Camii' })
    expect(shop.local).toBe('')
  })
  it('lists the useful facts', () => {
    expect(food.features).toEqual(['wheelchairLimited', 'takeaway', 'delivery', 'veg', 'wifi'])
    expect(food.email).toBe('hi@grill.example')
  })
  it('only makes mailto links from real addresses', () => {
    expect(safeEmail('a@b.org; c@d.org')).toBe('a@b.org')
    expect(safeEmail('javascript:x')).toBe('')
  })
})

describe('keeping the nearest', () => {
  const box = { s: 0, n: 1, w: 0, e: 1 }
  const at = (lat, lng) => ({ id: `${lat},${lng}`, lat, lng })
  it('puts the places nearest the centre first and stops at the limit', () => {
    const out = nearestFirst([at(0.9, 0.9), at(0.5, 0.5), at(0.6, 0.5)], box, 2)
    expect(out.map((p) => p.id)).toEqual(['0.5,0.5', '0.6,0.5'])
  })
  it('a full list only vouches for the area up to its farthest place', () => {
    expect(coveredBox(box, [at(0.5, 0.5)])).toBe(box)
    const full = Array.from({ length: MAX_PLACES }, () => at(0.6, 0.5))
    const c = coveredBox(box, full)
    expect(c.n - c.s).toBeLessThan(0.2)
    expect(c.n - c.s).toBeGreaterThan(0.1)
  })
})

describe('formatting and links', () => {
  it('formats distance', () => {
    expect(formatDistance(0.004)).toBe('10 m')
    expect(formatDistance(0.347)).toBe('350 m')
    expect(formatDistance(1.234)).toBe('1.2 km')
    expect(formatDistance(14.4)).toBe('14 km')
    expect(formatDistance(1.5, 'de-DE')).toBe('1,5 km')
    // Arabic gets its own unit, so the digits and the unit never end up in the wrong order
    expect(formatDistance(1.5, 'ar-EG')).toMatch(/كم/)
    expect(formatDistance(0.16, 'ar-EG')).not.toMatch(/m/)
    expect(formatDistance(NaN)).toBe('')
  })
  it('walk time never says zero', () => {
    expect(walkMinutes(0)).toBe(1)
    expect(walkMinutes(1.2)).toBe(15)
  })
  it('builds directions and OSM links', () => {
    expect(directionsUrl({ lat: 21.4225, lng: 39.8262 })).toBe('https://www.google.com/maps/dir/?api=1&destination=21.422500,39.826200')
    expect(osmUrl({ id: 'way/2' })).toBe('https://www.openstreetmap.org/way/2')
  })
  it('only lets http(s) websites through', () => {
    expect(safeUrl('albaik.com')).toBe('https://albaik.com')
    expect(safeUrl('https://x.org/menu')).toBe('https://x.org/menu')
    expect(safeUrl('javascript:alert(1)')).toBe('')
    expect(safeUrl('not a site')).toBe('')
    expect(safeUrl('')).toBe('')
  })
})

describe('fetchPlaces', () => {
  const K = 'https://www.openstreetmap.org/wiki/Key:'
  const CSV = ['osm,c,k,v',
    `https://www.openstreetmap.org/node/1,POINT(39.826 21.423),${K}amenity,place_of_worship`,
    `https://www.openstreetmap.org/node/1,POINT(39.826 21.423),${K}religion,muslim`].join('\n')
  it('asks QLever first, and Overpass only when it does not answer', async () => {
    const f = vi.fn(async (url) => (url.includes('qlever')
      ? { ok: true, status: 200, text: async () => CSV }
      : { ok: false, status: 429 }))
    const out = await fetchPlaces({ s: 21.4, w: 39.8, n: 21.44, e: 39.85 }, { fetchImpl: f })
    expect(out).toMatchObject([{ id: 'node/1', kind: 'mosque' }])
    expect(f).toHaveBeenCalledTimes(1)
    const f2 = vi.fn(async (url) => (url.includes('qlever') ? { ok: false, status: 503 } : { ok: true, status: 200, json: async () => sample }))
    expect(await fetchPlaces({ s: 21.4, w: 39.8, n: 21.44, e: 39.85 }, { fetchImpl: f2 })).toHaveLength(3)
    expect(f2.mock.calls[1][0]).toContain('overpass')
  })

  const box = { s: 21.4, w: 39.8, n: 21.44, e: 39.85 }
  const ok = (json) => ({ ok: true, status: 200, json: async () => json })

  it('posts the query form-encoded and parses the reply', async () => {
    const f = vi.fn(async () => ok(sample))
    const out = await fetchPlaces(box, { fetchImpl: f, servers: ['https://a'] })
    expect(out).toHaveLength(3)
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://a')
    expect(init.method).toBe('POST')
    expect(decodeURIComponent(init.body)).toContain('[bbox:21.40000,39.80000,21.44000,39.85000]')
  })
  it('moves to the next server when one is busy or down', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(ok(sample))
    const out = await fetchPlaces(box, { fetchImpl: f, servers: ['https://a', 'https://b', 'https://c'] })
    expect(out).toHaveLength(3)
    expect(f).toHaveBeenCalledTimes(3)
  })
  it('reports busy when every server is busy', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 429 }))
    await expect(fetchPlaces(box, { fetchImpl: f, servers: ['https://a', 'https://b'] })).rejects.toThrow('busy')
  })
  it('reports unavailable when the network is down everywhere', async () => {
    const f = vi.fn(async () => { throw new TypeError('network') })
    await expect(fetchPlaces(box, { fetchImpl: f, servers: ['https://a', 'https://b'] })).rejects.toThrow('unavailable')
  })
  it('treats an Overpass runtime error as busy and asks the next server', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok({ elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 26 seconds.' }))
      .mockResolvedValueOnce(ok(sample))
    expect(await fetchPlaces(box, { fetchImpl: f, servers: ['https://a', 'https://b'] })).toHaveLength(3)
  })

  // a fetch that only settles when its signal aborts, like a hung server
  const hang = (_url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' }))))

  it('asks the next server too when the first is slow, and cancels the loser', async () => {
    vi.useFakeTimers()
    try {
      const signals = []
      const f = vi.fn((url, init) => { signals.push(init.signal); return url === 'https://slow' ? hang(url, init) : Promise.resolve(ok(sample)) })
      const p = fetchPlaces(box, { fetchImpl: f, servers: ['https://slow', 'https://fast'], hedgeMs: 1000 })
      expect(f).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1000)
      expect(await p).toHaveLength(3)
      expect(f).toHaveBeenCalledTimes(2)
      expect(signals[0].aborted).toBe(true)
    } finally { vi.useRealTimers() }
  })
  it('gives up on a hung server and reports busy', async () => {
    vi.useFakeTimers()
    try {
      const p = fetchPlaces(box, { fetchImpl: vi.fn(hang), servers: ['https://a'], perServerMs: 5000 })
      const check = expect(p).rejects.toThrow('busy')
      await vi.advanceTimersByTimeAsync(5000)
      await check
    } finally { vi.useRealTimers() }
  })
  it('stops every request when the caller cancels', async () => {
    const ctrl = new AbortController()
    const signals = []
    const f = vi.fn((url, init) => { signals.push(init.signal); return hang(url, init) })
    const p = fetchPlaces(box, { fetchImpl: f, servers: ['https://a', 'https://b'], signal: ctrl.signal })
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    expect(f).toHaveBeenCalledTimes(1)
    expect(signals[0].aborted).toBe(true)
  })
})
