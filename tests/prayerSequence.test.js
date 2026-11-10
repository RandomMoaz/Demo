import { describe, expect, it } from 'vitest'
import { createPrayerSequenceRecognizer } from '../src/lib/prayerSequence.js'

const confirmed = (pose, overrides = {}) => ({
  confirmedPose: pose,
  candidatePose: pose,
  status: 'candidate',
  trackingStatus: 'tracking',
  ...overrides,
})

describe('Prayer Sequence Recognition', () => {
  it.each([
    ['QIYAM', 'RUKU'],
    ['RUKU', 'ITIDAL'],
    ['ITIDAL', 'SUJUD'],
    ['SUJUD', 'JALSA'],
    ['JALSA', 'SECOND_SUJUD'],
  ])('accepts expected %s → %s transition', (from, to) => {
    const sequence = createPrayerSequenceRecognizer()
    const route = ['QIYAM', 'RUKU', 'ITIDAL', 'SUJUD', 'JALSA', 'SECOND_SUJUD']
    for (const step of route.slice(0, route.indexOf(from) + 1)) sequence.process(confirmed(step))
    const result = sequence.process(confirmed(to))
    expect(result.lastConfirmedPose).toBe(to)
    expect(result.previousConfirmedPose).toBe(from)
    expect(result.transitionValidationResult).toBe('expected-transition')
  })

  it('rejects an unexpected transition without advancing its context', () => {
    const sequence = createPrayerSequenceRecognizer({ transitions: { QIYAM: ['RUKU'], RUKU: ['ITIDAL'] } })
    sequence.process(confirmed('QIYAM'))
    const result = sequence.process(confirmed('SALAM'))
    expect(result).toMatchObject({
      lastConfirmedPose: 'QIYAM', transitionValidationResult: 'unexpected-transition',
      eventType: 'unexpected-transition', expectedNextPoses: ['RUKU'],
    })
    expect(result.rejectionReason).toContain('received SALAM')
  })

  it('identifies a movement skipped in the configured path without advancing', () => {
    const sequence = createPrayerSequenceRecognizer()
    sequence.process(confirmed('QIYAM'))
    const result = sequence.process(confirmed('ITIDAL'))
    expect(result).toMatchObject({
      lastConfirmedPose: 'QIYAM', transitionValidationResult: 'missing-movement', eventType: 'missing-movement',
    })
    expect(result.rejectionReason).toContain('RUKU was not confirmed')
    expect(sequence.process(confirmed('ITIDAL'))).toMatchObject({ eventType: 'repeated-pose', transitionValidationResult: 'repeated-pose' })
  })

  it('ignores repeated confirmed events and does not advance twice', () => {
    const sequence = createPrayerSequenceRecognizer()
    sequence.process(confirmed('QIYAM'))
    const duplicate = sequence.process(confirmed('QIYAM'))
    expect(duplicate).toMatchObject({ lastConfirmedPose: 'QIYAM', eventType: 'repeated-pose' })
    expect(duplicate.completedMovements).toEqual(['QIYAM'])
  })

  it('does not advance from an unconfirmed candidate', () => {
    const sequence = createPrayerSequenceRecognizer()
    const result = sequence.process(confirmed('UNKNOWN', { candidatePose: 'QIYAM', stable: false }))
    expect(result).toMatchObject({ lastConfirmedPose: null, eventType: 'unconfirmed-pose', transitionValidationResult: 'awaiting-confirmation' })
    expect(sequence.process(confirmed('RUKU')).transitionValidationResult).toBe('unexpected-transition')
  })

  it('retains sequence position through tracking loss and marks recovery', () => {
    const sequence = createPrayerSequenceRecognizer()
    sequence.process(confirmed('QIYAM'))
    sequence.process(confirmed('RUKU'))
    const lost = sequence.process({ status: 'tracking-unavailable', trackingStatus: 'tracking-lost', confirmedPose: 'UNKNOWN' })
    expect(lost).toMatchObject({ sequenceState: 'tracking-lost', lastConfirmedPose: 'RUKU', transitionValidationResult: 'tracking-lost' })
    const resumed = sequence.process(confirmed('UNKNOWN', { candidatePose: 'ITIDAL' }))
    expect(resumed).toMatchObject({ lastConfirmedPose: 'RUKU', eventType: 'tracking-recovered', transitionValidationResult: 'awaiting-confirmation' })
    const accepted = sequence.process(confirmed('ITIDAL'))
    expect(accepted).toMatchObject({ previousConfirmedPose: 'RUKU', lastConfirmedPose: 'ITIDAL', eventType: 'expected-transition', transitionValidationResult: 'expected-transition' })
  })

  it('never lets repeated QIYAM accidentally advance, even if configured as a graph edge', () => {
    const sequence = createPrayerSequenceRecognizer({ transitions: { QIYAM: ['QIYAM', 'RUKU'], RUKU: [] } })
    sequence.process(confirmed('QIYAM'))
    const repeated = sequence.process(confirmed('QIYAM'))
    expect(repeated).toMatchObject({ lastConfirmedPose: 'QIYAM', eventType: 'repeated-pose' })
    expect(repeated.completedMovements).toEqual(['QIYAM'])
  })

  it('supports alternate structures including tashahhud and salam', () => {
    const sequence = createPrayerSequenceRecognizer({
      transitions: { QIYAM: ['TASHAHHUD'], TASHAHHUD: ['SALAM'], SALAM: [] },
    })
    sequence.process(confirmed('QIYAM'))
    sequence.process(confirmed('TASHAHHUD'))
    const result = sequence.process(confirmed('SALAM'))
    expect(result).toMatchObject({ previousConfirmedPose: 'TASHAHHUD', lastConfirmedPose: 'SALAM', expectedNextPoses: [] })
  })

  it('allows a completed unit to continue standing or enter tashahhud without choosing prayer length', () => {
    const sequence = createPrayerSequenceRecognizer()
    for (const pose of ['QIYAM', 'RUKU', 'ITIDAL', 'SUJUD', 'JALSA', 'SECOND_SUJUD']) sequence.process(confirmed(pose))
    expect(sequence.getState().expectedNextPoses).toEqual(['QIYAM', 'TASHAHHUD'])
  })

  it('reset clears sequence and previous-pose context', () => {
    const sequence = createPrayerSequenceRecognizer()
    sequence.process(confirmed('QIYAM'))
    sequence.process(confirmed('RUKU'))
    expect(sequence.reset()).toMatchObject({
      sequenceState: 'not-started', previousConfirmedPose: null, lastConfirmedPose: null,
      expectedNextPoses: ['QIYAM'], completedMovements: [], transitionValidationResult: 'not-started',
    })
  })
})
