import { describe, it, expect, beforeEach } from 'vitest'
import {
  shiftHM, alarmTime, nextRing, afterPrayer, volumeAt, todaysTimes, savePrayerAlarm, addAlarm, updateAlarm, removeAlarm,
  restoreAlarm, checkAlarms, snooze, stopRinging, alarmState, cancelSnooze, hm,
} from '../src/lib/alarms.js'

const LONDON = { lat: 51.5074, lng: -0.1278 }
const at = (date, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0) }
const DAY = new Date(2026, 10, 22) // a Sunday

beforeEach(() => {
  for (const a of alarmState().alarms) removeAlarm(a.id)
  cancelSnooze()
  if (alarmState().ringing) stopRinging()
})

describe('times', () => {
  it('moves a time by minutes, round midnight too', () => {
    expect(shiftHM('05:10', -15)).toBe('04:55')
    expect(shiftHM('00:05', -10)).toBe('23:55')
    expect(shiftHM('23:55', 10)).toBe('00:05')
    expect(shiftHM('12:00')).toBe('12:00')
  })
  it('rings a prayer alarm at the adhan moved by its offset', () => {
    const times = todaysTimes(LONDON, DAY)
    expect(alarmTime({ prayer: 'fajr', offset: -15 }, times)).toBe(shiftHM(times.fajr, -15))
    expect(alarmTime({ prayer: 'fajr' }, times)).toBe(times.fajr) // old alarms without an offset
    expect(alarmTime({ prayer: null, time: '07:30' }, times)).toBe('07:30')
  })
  it('finds the next ring: later today, tomorrow, or the next chosen day', () => {
    const custom = { prayer: null, time: '07:30', repeat: 'daily', days: [], on: true }
    expect(nextRing(custom, LONDON, at(DAY, '06:00'))).toEqual(at(DAY, '07:30'))
    const tomorrow = new Date(2026, 10, 23)
    expect(nextRing(custom, LONDON, at(DAY, '08:00'))).toEqual(at(tomorrow, '07:30'))
    const wednesdays = { ...custom, repeat: 'days', days: [3] }
    expect(nextRing(wednesdays, LONDON, at(DAY, '06:00'))).toEqual(at(new Date(2026, 10, 25), '07:30'))
    expect(nextRing({ ...custom, on: false }, LONDON, at(DAY, '06:00'))).toBeNull()
  })
  it('knows what ends each prayer time', () => {
    expect(afterPrayer('fajr', LONDON, DAY).key).toBe('sunrise')
    expect(afterPrayer('asr', LONDON, DAY).key).toBe('maghrib')
    expect(afterPrayer('isha', LONDON, DAY)).toBeNull()
  })
  it('starts the sound soft and grows louder over half a minute', () => {
    expect(volumeAt(0)).toBeCloseTo(0.04)
    expect(volumeAt(15000)).toBeGreaterThan(volumeAt(0))
    expect(volumeAt(30000)).toBeCloseTo(0.3)
    expect(volumeAt(120000)).toBeCloseTo(0.3)
  })
})

describe('alarms', () => {
  it('keeps one alarm per prayer, however often it is switched on', () => {
    savePrayerAlarm('fajr', { task: 'math' })
    savePrayerAlarm('fajr', { offset: -10 })
    const fajr = alarmState().alarms.filter((a) => a.prayer === 'fajr')
    expect(fajr).toHaveLength(1)
    expect(fajr[0]).toMatchObject({ task: 'math', offset: -10, on: true, repeat: 'daily' })
  })
  it('does not ring an alarm that is switched off', () => {
    const times = todaysTimes(LONDON, DAY)
    const a = savePrayerAlarm('dhuhr', {})
    updateAlarm(a.id, { on: false })
    expect(checkAlarms(at(DAY, times.dhuhr), LONDON)).toBeNull()
    updateAlarm(a.id, { on: true })
    expect(checkAlarms(at(DAY, times.dhuhr), LONDON)?.prayer).toBe('dhuhr')
  })
  it('rings at the offset time, not the adhan', () => {
    const times = todaysTimes(LONDON, DAY)
    savePrayerAlarm('fajr', { offset: -15 })
    expect(checkAlarms(at(DAY, times.fajr), LONDON)).toBeNull()
    expect(checkAlarms(at(DAY, shiftHM(times.fajr, -15)), LONDON)?.prayer).toBe('fajr')
  })
  it('puts a deleted alarm back with Undo', () => {
    const a = addAlarm({ prayer: null, time: '07:30', repeat: 'daily', days: [], task: null, level: 'easy' })
    const gone = removeAlarm(a.id)
    expect(alarmState().alarms).toHaveLength(0)
    restoreAlarm(gone)
    restoreAlarm(gone) // twice does nothing more
    expect(alarmState().alarms).toHaveLength(1)
  })
  it('snoozes for five minutes, then rings again', () => {
    addAlarm({ prayer: null, time: '07:30', repeat: 'daily', days: [], task: null, level: 'easy' })
    const t0 = at(DAY, '07:30')
    checkAlarms(t0, LONDON)
    expect(alarmState().ringing).toBeTruthy()
    const until = snooze(5, t0)
    expect(hm(until)).toBe('07:35')
    expect(alarmState().ringing).toBeNull()
    expect(checkAlarms(at(DAY, '07:33'), LONDON)).toBeNull()
    expect(checkAlarms(at(DAY, '07:35'), LONDON)?.time).toBe('07:30')
    expect(alarmState().ringing).toBeTruthy()
  })
})
