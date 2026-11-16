import { describe, it, expect, vi } from 'vitest'
import {
  parseRoute, fetchRoute, trackRoute, timeLeft, instruction, turnAngle, compass, pickMode, metres,
  formatMetres, formatDuration,
} from '../src/lib/route.js'
import { mapText, MAP_TEXT } from '../src/lib/mapText.js'

// an L-shaped walk near the equator: 1 km east, turn left, 1 km north (0.009° ≈ 1 km)
const A = [0, 0], B = [0.009, 0], C = [0.009, 0.009] // [lng, lat]
const osrm = {
  code: 'Ok',
  routes: [{
    distance: 2000, duration: 1500,
    geometry: { type: 'LineString', coordinates: [A, [0.0045, 0], B, C] },
    legs: [{ steps: [
      { distance: 1000, duration: 750, name: 'Market Street', maneuver: { type: 'depart', bearing_after: 90, location: A } },
      { distance: 1000, duration: 750, name: 'Mosque Road', maneuver: { type: 'turn', modifier: 'left', location: B } },
      { distance: 0, duration: 0, name: 'Mosque Road', maneuver: { type: 'arrive', location: C } },
    ] }],
  }],
}
const en = mapText('en').nav

describe('parseRoute', () => {
  const r = parseRoute(osrm)
  it('gives the line as [lat, lng] with distances along it', () => {
    expect(r.line[0]).toEqual([0, 0]); expect(r.line[3]).toEqual([0.009, 0.009])
    expect(r.cum[r.cum.length - 1]).toBeGreaterThan(1990); expect(r.cum[r.cum.length - 1]).toBeLessThan(2010)
  })
  it('places each manoeuvre along the line', () => {
    expect(r.steps.map((s) => s.type)).toEqual(['depart', 'turn', 'arrive'])
    expect(r.steps[1].at).toBeCloseTo(r.cum[2], 0)
    expect(r.steps[1].loc).toEqual([0, 0.009])
  })
  it('returns null for nothing usable', () => {
    expect(parseRoute(null)).toBeNull()
    expect(parseRoute({ routes: [{ geometry: { coordinates: [[0, 0]] } }] })).toBeNull()
  })
})

describe('fetchRoute', () => {
  const from = { lat: 0, lng: 0 }, to = { lat: 0.009, lng: 0.009 }
  it('asks the router for the chosen way of travel, with the full line and steps', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => osrm }))
    const r = await fetchRoute(from, to, 'drive', { fetchImpl: f })
    expect(r.steps).toHaveLength(3)
    const url = f.mock.calls[0][0]
    expect(url).toContain('/routed-car/route/v1/driving/0.000000,0.000000;0.009000,0.009000')
    expect(url).toContain('steps=true'); expect(url).toContain('geometries=geojson')
  })
  it('tells "no route" apart from a busy or unreachable server', async () => {
    await expect(fetchRoute(from, to, 'walk', { fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ code: 'NoRoute' }) }) })).rejects.toThrow('noRoute')
    await expect(fetchRoute(from, to, 'walk', { fetchImpl: async () => ({ ok: false, status: 503, json: async () => { throw new Error('html') } }) })).rejects.toThrow('busy')
    await expect(fetchRoute(from, to, 'walk', { fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) })).rejects.toThrow('unavailable')
  })
})

describe('trackRoute', () => {
  const r = parseRoute(osrm)
  it('follows the user along the line and names the next turn', () => {
    const p = trackRoute(r, { lat: 0.0001, lng: 0.003 }) // 1/3 of the way east, ~11 m to the side
    expect(p.off).toBeGreaterThan(8); expect(p.off).toBeLessThan(14)
    expect(p.step).toBe(1)
    expect(p.toStep).toBeGreaterThan(640); expect(p.toStep).toBeLessThan(690)
    expect(p.left).toBeGreaterThan(1640)
  })
  it('after the turn, the next step is arriving', () => {
    const p = trackRoute(r, { lat: 0.005, lng: 0.009 })
    expect(p.step).toBe(2)
    expect(p.left).toBeGreaterThan(420); expect(p.left).toBeLessThan(470)
  })
  it('notices when the user has left the route', () => {
    expect(trackRoute(r, { lat: 0.004, lng: 0.003 }).off).toBeGreaterThan(400)
  })
  it('does not jump back to an earlier stretch that passes close by', () => {
    // a route out and back along the same street
    const back = parseRoute({ routes: [{ distance: 2000, duration: 1500, geometry: { coordinates: [[0, 0], [0.009, 0], [0.0001, 0.00005]] }, legs: [{ steps: [
      { distance: 1000, maneuver: { type: 'depart', location: [0, 0] } },
      { distance: 1000, maneuver: { type: 'turn', modifier: 'uturn', location: [0.009, 0] } },
      { distance: 0, maneuver: { type: 'arrive', location: [0.0001, 0.00005] } },
    ] }] }] })
    const outward = trackRoute(back, { lat: 0, lng: 0.006 }, 0)
    const homeward = trackRoute(back, { lat: 0, lng: 0.006 }, 1300)
    expect(outward.at).toBeLessThan(1000)
    expect(homeward.at).toBeGreaterThan(1000)
  })
  it('time left is in proportion to the distance left', () => expect(timeLeft(r, r.distance / 2)).toBeCloseTo(750, 0))
})

describe('instructions', () => {
  const step = (type, modifier = '', extra = {}) => ({ type, modifier, name: '', ...extra })
  it('reads like a navigation app', () => {
    expect(instruction(step('depart', '', { bearing: 90, name: 'Market Street' }), en)).toBe('Head east on Market Street')
    expect(instruction(step('turn', 'left', { name: 'Mosque Road' }), en)).toBe('Turn left onto Mosque Road')
    expect(instruction(step('turn', 'slight right'), en)).toBe('Turn slightly right')
    expect(instruction(step('fork', 'slight left'), en)).toBe('Keep left')
    expect(instruction(step('new name', 'straight', { name: 'High St' }), en)).toBe('Continue straight on High St')
    expect(instruction(step('roundabout', 'right', { exit: 2 }), en)).toBe('At the roundabout, take exit 2')
    expect(instruction(step('continue', 'uturn'), en)).toBe('Make a U-turn')
    expect(instruction(step('arrive'), en)).toBe('You have arrived')
  })
  it('has every sentence in every language', () => {
    for (const [lang, t] of Object.entries(MAP_TEXT)) {
      for (const s of [step('depart', '', { bearing: 200 }), step('turn', 'sharp left', { name: 'X' }), step('fork', 'slight right'), step('rotary', '', { exit: 1 }), step('arrive'), step('continue', 'uturn'), step('turn', 'straight')]) {
        const text = instruction(s, t.nav)
        expect(typeof text, `${lang} ${s.type}`).toBe('string')
        expect(text.length, `${lang} ${s.type}`).toBeGreaterThan(1)
        expect(text, `${lang} ${s.type}`).not.toMatch(/undefined|null/)
      }
    }
  })
  it('points the arrow the way of the turn', () => {
    expect(turnAngle(step('turn', 'left'))).toBe(-90)
    expect(turnAngle(step('turn', 'slight right'))).toBe(45)
    expect(turnAngle(step('arrive'))).toBeNull()
    expect(compass(359)).toBe('N'); expect(compass(130)).toBe('SE')
  })
})

describe('small helpers', () => {
  it('walks short trips and drives long ones', () => {
    expect(pickMode({ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 })).toBe('walk')
    expect(pickMode({ lat: 0, lng: 0 }, { lat: 0.05, lng: 0 })).toBe('drive')
    expect(metres({ lat: 0, lng: 0 }, { lat: 0.009, lng: 0 })).toBeCloseTo(1000, -1)
  })
  it('formats distances and durations', () => {
    expect(formatMetres(43)).toBe('45 m'); expect(formatMetres(347)).toBe('350 m'); expect(formatMetres(1260)).toBe('1.3 km')
    expect(formatDuration(20)).toBe('1 min'); expect(formatDuration(725)).toBe('12 min')
    expect(formatDuration(3900)).toMatch(/^1 hr 5 min$/)
    expect(formatDuration(725, 'ar-EG')).not.toMatch(/min/)
  })
})
