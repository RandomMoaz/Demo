import { describe, expect, it, vi } from 'vitest'
import { createPoseRecognitionHistory } from '../src/lib/poseRecognitionHistory.js'

const recognized = (pose = 'QIYAM', overrides = {}) => ({
  state: pose, candidate: pose, confidence: 0.85, status: 'candidate', stable: true,
  reasons: ['upright-torso'], ...overrides,
})
const quality = (trackingStatus = 'tracking') => ({
  trackingStatus, landmarkCount: 33, validLandmarkCount: trackingStatus === 'tracking' ? 33 : 0, confidence: 0.91,
})

describe('pose recognition history', () => {
  it('records recognized pose summaries with ISO timestamp, confidence, evidence, and tracking quality', () => {
    const recorder = createPoseRecognitionHistory({ now: () => Date.UTC(2026, 0, 2, 3, 4, 5) })
    const entry = recorder.record(recognized(), quality())
    expect(entry).toMatchObject({
      timestamp: '2026-01-02T03:04:05.000Z', pose: 'QIYAM', confidence: 0.85,
      status: 'candidate', evidence: ['upright-torso'], trackingStatus: 'tracking',
      landmarkCount: 33, validLandmarkCount: 33, trackingConfidence: 0.91,
    })
  })

  it('retains candidate, confirmed state, stability progress, measurements, rejection reason, and timing', () => {
    const recorder = createPoseRecognitionHistory({ now: () => 1000 })
    const entry = recorder.record(recognized('UNKNOWN', {
      candidatePose: 'QIYAM', confirmedPose: 'UNKNOWN', pendingFrames: 2, stableFramesRequired: 3,
      decisionConfidence: 0.88,
      diagnosticReason: 'Candidate QIYAM pending temporal confirmation (2/3 frames)',
      rejectionReasons: ['QIYAM knee average below threshold'], timeSincePreviousMs: 120,
      measurements: {
        torsoInclination: { degrees: 4, confidence: 0.93, available: true },
        leftKnee: { degrees: 164, confidence: 0.9, available: true },
        rightKnee: { degrees: 160, confidence: 0.88, available: true },
      },
      confidenceBreakdown: { overall: 0.92, torsoInclination: 0.93, leftKnee: 0.9, rightKnee: 0.88 },
      criticalLandmarks: [{ index: 25, name: 'leftKnee', reliable: true, confidence: 0.9, reason: null }],
      validLandmarkCount: 32, landmarkCount: 33,
    }), quality())
    expect(entry).toMatchObject({
      candidatePose: 'QIYAM', confirmedPose: 'UNKNOWN', pendingFrames: 2, stableFramesRequired: 3,
      decisionConfidence: 0.88,
      recognitionReason: 'Candidate QIYAM pending temporal confirmation (2/3 frames)',
      rejectionReasons: ['QIYAM knee average below threshold'], timeSincePreviousMs: 120,
      measurements: { torsoInclination: { degrees: 4 }, leftKnee: { degrees: 164 }, rightKnee: { degrees: 160 } },
      confidenceBreakdown: { overall: 0.92 }, criticalLandmarks: [{ name: 'leftKnee' }],
      validLandmarkCount: 32, landmarkCount: 33,
    })
  })

  it('records UNKNOWN and tracking-loss results', () => {
    const recorder = createPoseRecognitionHistory({ now: vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1400) })
    recorder.record(recognized('UNKNOWN', { candidate: 'UNKNOWN', confidence: 0, status: 'tracking-unavailable', stable: false, reasons: ['tracking-no-pose'] }), quality('no-pose'))
    recorder.record(recognized('UNKNOWN', { candidate: 'UNKNOWN', confidence: 0, status: 'tracking-unavailable', stable: false, reasons: ['tracking-lost'] }), quality('tracking-lost'))
    expect(recorder.getEntries()).toHaveLength(2)
    expect(recorder.getEntries().map((entry) => entry.trackingStatus)).toEqual(['tracking-lost', 'no-pose'])
    expect(recorder.getEntries()[0].pose).toBe('UNKNOWN')
  })

  it('keeps no more than 30 entries in newest-first order', () => {
    let now = 0
    const recorder = createPoseRecognitionHistory({ now: () => now++, sampleIntervalMs: 0, changeIntervalMs: 0 })
    for (let index = 0; index < 35; index++) recorder.record(recognized(`POSE_${index}`))
    expect(recorder.getEntries()).toHaveLength(30)
    expect(recorder.getEntries()[0].pose).toBe('POSE_34')
    expect(recorder.getEntries().at(-1).pose).toBe('POSE_5')
  })

  it('clears history and sampling state', () => {
    let now = 1000
    const recorder = createPoseRecognitionHistory({ now: () => now })
    recorder.record(recognized())
    recorder.clear()
    expect(recorder.getEntries()).toEqual([])
    expect(recorder.record(recognized('RUKU')).pose).toBe('RUKU')
  })

  it('records independently of diagnostics visibility', () => {
    let diagnosticsExpanded = false
    const recorder = createPoseRecognitionHistory({ now: () => 1000 })
    const entry = recorder.record(recognized('SUJUD'), quality())
    expect(diagnosticsExpanded).toBe(false)
    expect(entry.pose).toBe('SUJUD')
    diagnosticsExpanded = true
    expect(recorder.getEntries()[0].pose).toBe('SUJUD')
  })

  it('avoids per-frame duplicate spam while sampling stable posture periodically', () => {
    let now = 1000
    const recorder = createPoseRecognitionHistory({ now: () => now })
    expect(recorder.record(recognized()).pose).toBe('QIYAM')
    now = 1050
    expect(recorder.record(recognized())).toBeNull()
    now = 1300
    expect(recorder.record(recognized())).toBeNull()
    now = 2000
    expect(recorder.record(recognized()).pose).toBe('QIYAM')
    expect(recorder.getEntries()).toHaveLength(2)
  })

  it('records meaningful changes after the debounce interval without waiting for the periodic sample', () => {
    let now = 1000
    const recorder = createPoseRecognitionHistory({ now: () => now })
    recorder.record(recognized())
    now = 1400
    recorder.record(recognized('RUKU'))
    expect(recorder.getEntries().map((entry) => entry.pose)).toEqual(['RUKU', 'QIYAM'])
  })

  it('records tracking recovery even when the detected pose returns to the same state', () => {
    let now = 1000
    const recorder = createPoseRecognitionHistory({ now: () => now })
    recorder.record(recognized('QIYAM'), quality('tracking'))
    now = 1400
    recorder.record(recognized('UNKNOWN', { candidate: 'UNKNOWN', confidence: 0, status: 'tracking-unavailable', stable: false }), quality('tracking-lost'))
    now = 1800
    recorder.record(recognized('QIYAM'), quality('tracking'))
    expect(recorder.getEntries().map((entry) => entry.trackingStatus)).toEqual(['tracking', 'tracking-lost', 'tracking'])
  })

  it('preserves timestamp-gap reset diagnostics in the sampled history', () => {
    let now = 1000
    const recorder = createPoseRecognitionHistory({ now: () => now })
    recorder.record(recognized('UNKNOWN', {
      candidatePose: 'UNKNOWN', confirmedPose: 'UNKNOWN', status: 'tracking-unavailable', stable: false,
      diagnosticReason: 'Recognition history reset: timestamp-gap-over-1800ms',
      rejectionReasons: ['tracking-history-reset', 'timestamp-gap-over-1800ms'],
      timeSincePreviousMs: 1801, pendingFrames: 0, stableFramesRequired: 3,
    }), quality('tracking'))
    now += 400
    recorder.record(recognized('QIYAM', {
      candidatePose: 'QIYAM', confirmedPose: 'UNKNOWN', pendingFrames: 1, stableFramesRequired: 3,
      diagnosticReason: 'Candidate QIYAM pending temporal confirmation (1/3 frames)', timeSincePreviousMs: 99,
    }), quality('tracking'))
    expect(recorder.getEntries().map((entry) => entry.recognitionReason)).toEqual([
      'Candidate QIYAM pending temporal confirmation (1/3 frames)',
      'Recognition history reset: timestamp-gap-over-1800ms',
    ])
    expect(recorder.getEntries()[1]).toMatchObject({ timeSincePreviousMs: 1801, rejectionReasons: ['tracking-history-reset', 'timestamp-gap-over-1800ms'] })
  })
})
