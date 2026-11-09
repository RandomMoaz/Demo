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
})
