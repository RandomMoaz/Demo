import { describe, it, expect } from 'vitest'
import { parseHours, openState } from '../src/lib/openingHours.js'

// 2026-11-16 is a Monday
const at = (day, hm) => { const [h, m] = hm.split(':').map(Number); return new Date(2026, 10, 16 + day, h, m, 0) }
const MON = 0, FRI = 4, SAT = 5, SUN = 6
const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

describe('openState', () => {
  it('24/7 is always open', () => expect(openState('24/7', at(MON, '03:00'))).toEqual({ open: true, change: null }))

  it('weekday hours with a closed Sunday', () => {
    const h = 'Mo-Fr 09:00-17:00; Sa 10:00-14:00; Su off'
    const a = openState(h, at(MON, '10:30'))
    expect(a.open).toBe(true); expect(hm(a.change)).toBe('17:00')
    const b = openState(h, at(MON, '18:00'))
    expect(b.open).toBe(false); expect(hm(b.change)).toBe('09:00'); expect(b.change.getDate()).toBe(17)
    const c = openState(h, at(SAT, '15:00')) // Saturday afternoon: next opening is Monday morning
    expect(c.open).toBe(false); expect(c.change.getDay()).toBe(1); expect(hm(c.change)).toBe('09:00')
    expect(openState(h, at(SUN, '12:00')).open).toBe(false)
  })

  it('late-night hours run past midnight', () => {
    const h = 'Mo-Su 10:00-02:00'
    const a = openState(h, at(SAT, '01:30')) // Friday night's opening still going
    expect(a.open).toBe(true); expect(hm(a.change)).toBe('02:00')
    expect(openState(h, at(SAT, '03:00')).open).toBe(false)
  })

  it('split hours, day lists and rules added with a comma', () => {
    const h = 'Mo,We 08:00-12:00,13:00-18:00, Fr 14:00-20:00'
    expect(openState(h, at(MON, '12:30')).open).toBe(false)
    expect(hm(openState(h, at(MON, '12:30')).change)).toBe('13:00')
    expect(openState(h, at(FRI, '15:00')).open).toBe(true)
    expect(openState(h, at(MON + 1, '10:00')).open).toBe(false) // Tuesday not listed
  })

  it('a later rule replaces an earlier one for its days', () => {
    const h = 'Mo-Su 09:00-21:00; Fr 14:00-21:00'
    expect(openState(h, at(FRI, '10:00')).open).toBe(false)
    expect(openState(h, at(FRI - 1, '10:00')).open).toBe(true)
  })

  it('ranges that wrap the week, hours without days, and all-day days', () => {
    expect(openState('Fr-Mo 10:00-16:00', at(SUN, '11:00')).open).toBe(true)
    expect(openState('Fr-Mo 10:00-16:00', at(MON + 2, '11:00')).open).toBe(false)
    expect(openState('10:00-22:00', at(SUN, '21:00')).open).toBe(true)
    expect(openState('Mo-Fr', at(MON, '23:00')).open).toBe(true)
  })

  it('ignores public-holiday rules it cannot check', () => {
    expect(openState('Mo-Sa 09:00-18:00; PH off', at(MON, '10:00')).open).toBe(true)
    expect(openState('Mo-Sa 09:00-18:00; Su,PH off', at(SUN, '10:00')).open).toBe(false)
  })

  it('says nothing rather than guess at rarer formats', () => {
    for (const h of ['Mo-Fr 09:00-17:00; Jan off', 'sunrise-sunset', 'Mo-Fr 18:00+', 'by appointment', 'Fr[1] 10:00-12:00', '"call us"', '', null, 'Mo-Fr 09:00-17:00 Sa 10:00-12:00'])
      expect(openState(h, at(MON, '10:00'))).toBeNull()
  })

  it('a place never open says closed with no next time', () => {
    expect(openState('off', at(MON, '10:00'))).toEqual({ open: false, change: null })
  })

  it('takes a parsed value too', () => {
    const p = parseHours('Mo-Fr 09:00-17:00')
    expect(openState(p, at(MON, '09:00')).open).toBe(true)
  })
})
