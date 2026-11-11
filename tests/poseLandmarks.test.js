import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LANDMARK_COUNT, calculateAngle, createPoseLandmarkProcessor,
  drawJointAngleLabels, processPoseLandmarks,
} from '../src/lib/poseLandmarks.js'

function pose() {
  const points = Array.from({ length: LANDMARK_COUNT }, (_, index) => ({ x: 0.5 + (index % 3) * 0.01, y: 0.1 + index * 0.02, z: 0, visibility: 0.95, presence: 0.92 }))
  const put = (index, x, y, z = 0) => { points[index] = { ...points[index], x, y, z } }
  put(11, 0.4, 0.25, -0.02); put(12, 0.6, 0.25, 0.02)
  put(13, 0.35, 0.35, -0.02); put(14, 0.65, 0.35, 0.02)
  put(15, 0.35, 0.45, -0.02); put(16, 0.65, 0.45, 0.02)
  put(23, 0.44, 0.5, -0.01); put(24, 0.56, 0.5, 0.01)
  put(25, 0.44, 0.7, -0.01); put(26, 0.56, 0.7, 0.01)
  put(27, 0.44, 0.9, -0.01); put(28, 0.56, 0.9, 0.01)
  put(31, 0.46, 0.95, -0.01); put(32, 0.58, 0.95, 0.01)
  return points
}

const confident = (x, y, z = 0) => ({ x, y, z, visibility: 1, presence: 1 })

describe('pose landmark processing', () => {
  it('validates and preserves a complete MediaPipe pose and original indices', () => {
    const raw = pose()
    const result = processPoseLandmarks(raw, { width: 640, height: 480, timestamp: 123 })
    expect(result).toMatchObject({ timestamp: 123, trackingStatus: 'tracking', landmarkCount: 33, validLandmarkCount: 33 })
    expect(result.rawLandmarks).toBe(raw)
    expect(result.joints[11]).toMatchObject({ index: 11, name: 'leftShoulder', reliable: true, confidence: 0.92 })
    expect(result.joints[12].name).toBe('rightShoulder')
    expect(result.jointAngles.leftElbow.available).toBe(true)
    expect(result.confidence).toBeCloseTo(0.92)
  })

  it('marks missing landmarks unavailable without inventing coordinates', () => {
    const raw = pose(); raw[13] = null
    const result = processPoseLandmarks(raw, { width: 640, height: 480 })
    expect(result.landmarkCount).toBe(33)
    expect(result.validLandmarkCount).toBe(32)
    expect(result.joints[13]).toMatchObject({ reliable: false, reason: 'invalid-coordinates', x: null, y: null })
    expect(result.jointAngles.leftElbow).toMatchObject({ available: false, value: null })
    expect(result.jointAngles.rightElbow.available).toBe(true)
  })

  it('reports incorrect landmark counts while retaining original indices for supplied points', () => {
    const result = processPoseLandmarks(pose().slice(0, 32), { width: 640, height: 480 })
    expect(result.landmarkCount).toBe(32)
    expect(result.joints).toHaveLength(33)
    expect(result.joints[31].index).toBe(31)
    expect(result.joints[32]).toMatchObject({ index: 32, reliable: false })
    expect(result.qualityWarnings).toContain('expected-33-landmarks:received-32')
  })

  it('rejects a non-array landmark payload and reports no usable points', () => {
    const result = processPoseLandmarks({ landmarks: pose() }, { width: 640, height: 480 })
    expect(result).toMatchObject({ landmarkCount: 0, validLandmarkCount: 0, trackingStatus: 'no-pose' })
    expect(result.qualityWarnings).toContain('landmarks-not-an-array')
  })

  it.each([
    ['NaN x', (points) => { points[11].x = Number.NaN }],
    ['infinite y', (points) => { points[11].y = Number.POSITIVE_INFINITY }],
    ['infinite z', (points) => { points[11].z = Number.NEGATIVE_INFINITY }],
  ])('rejects %s coordinates', (_label, mutate) => {
    const raw = pose(); mutate(raw)
    const result = processPoseLandmarks(raw, { width: 640, height: 480 })
    expect(result.joints[11]).toMatchObject({ reliable: false, reason: 'invalid-coordinates' })
    expect(result.validLandmarkCount).toBe(32)
  })

  it('rejects low or malformed confidence and treats missing confidence as unavailable', () => {
    const raw = pose()
    raw[11].visibility = 0.2
    raw[12].visibility = Number.NaN
    delete raw[13].visibility; delete raw[13].presence
    const result = processPoseLandmarks(raw, { width: 640, height: 480, minConfidence: 0.5 })
    expect(result.joints[11]).toMatchObject({ reliable: false, confidence: 0.2, reason: 'low-confidence' })
    expect(result.joints[12]).toMatchObject({ reliable: false, reason: 'invalid-visibility' })
    expect(result.joints[13]).toMatchObject({ reliable: false, confidence: null, reason: 'missing-confidence' })
    expect(result.jointAngles.leftElbow.value).toBeNull()
  })

  it('calculates known 90 degree and straight 180 degree angles in degrees', () => {
    expect(calculateAngle(confident(0, 0), confident(0, 1), confident(1, 1))).toMatchObject({ value: 90, available: true, unit: 'degrees', confidence: 1 })
    expect(calculateAngle(confident(0, 0), confident(1, 0), confident(2, 0)).value).toBeCloseTo(180)
    expect(calculateAngle(confident(1, 0), confident(0, 0), confident(0, 1)).value).toBeCloseTo(90)
    expect(calculateAngle(confident(0, 0, 0), confident(0, 0, 1), confident(1, 0, 1), { dimensions: 3 }).value).toBeCloseTo(90)
    const withoutDepth = (x, y) => ({ x, y, visibility: 1, presence: 1 })
    expect(calculateAngle(withoutDepth(0, 0), withoutDepth(0, 1), withoutDepth(1, 1), { dimensions: 3 })).toMatchObject({ value: null, reason: 'invalid-coordinates' })
  })

  it('calculates symmetric left/right geometry and exposes requested measurements', () => {
    const result = processPoseLandmarks(pose(), { width: 640, height: 480 })
    expect(result.jointAngles.leftElbow.value).toBeCloseTo(result.jointAngles.rightElbow.value)
    expect(result.jointAngles.leftShoulder.value).toBeCloseTo(result.jointAngles.rightShoulder.value)
    expect(result.jointAngles.leftHip.value).toBeCloseTo(result.jointAngles.rightHip.value)
    expect(result.jointAngles.leftKnee.value).toBeCloseTo(result.jointAngles.rightKnee.value)
    expect(result.bodyGeometry).toMatchObject({
      shoulderWidth: { available: true }, hipWidth: { available: true }, torsoLength: { available: true },
      leftUpperArmLength: { available: true }, rightUpperArmLength: { available: true },
      leftForearmLength: { available: true }, rightForearmLength: { available: true },
      leftThighLength: { available: true }, rightThighLength: { available: true },
      leftLowerLegLength: { available: true }, rightLowerLegLength: { available: true },
      shoulderHipDistance: { available: true },
    })
    expect(result.bodyGeometry.leftUpperArmLength.relativeToTorso).toBeGreaterThan(0)
    expect(result.shoulderAlignment.available).toBe(true)
    expect(result.hipAlignment.available).toBe(true)
    expect(result.kneeSymmetry).toMatchObject({ available: true, value: 0 })
    expect(result.bodyCenter).toMatchObject({ available: true, x: 0.5, y: 0.5 })
    expect(result.bodyOrientation.available).toBe(true)
    expect(result.torsoInclination).toMatchObject({ available: true, value: 0 })
  })

  it('returns null instead of zero for zero-length, unreliable, or invalid geometry', () => {
    expect(calculateAngle(confident(0, 0), confident(0, 0), confident(1, 1))).toMatchObject({ value: null, available: false, reason: 'zero-length-vector' })
    expect(calculateAngle(confident(0, 0), { ...confident(0, 1), visibility: 0.1 }, confident(1, 1))).toMatchObject({ value: null, available: false })
    const result = processPoseLandmarks(pose(), { width: 0, height: 0 })
    expect(result.qualityWarnings).toContain('invalid-image-dimensions')
    expect(result.bodyGeometry.torsoLength).toMatchObject({ value: null, available: false })
  })

  it('produces resolution-independent normalized geometry and angles', () => {
    const raw = pose()
    const small = processPoseLandmarks(raw, { width: 640, height: 480 })
    const large = processPoseLandmarks(raw, { width: 1280, height: 960 })
    expect(large.bodyGeometry.shoulderWidth.value).toBeCloseTo(small.bodyGeometry.shoulderWidth.value)
    expect(large.bodyGeometry.torsoLength.value).toBeCloseTo(small.bodyGeometry.torsoLength.value)
    expect(large.bodyGeometry.leftUpperArmLength.relativeToTorso).toBeCloseTo(small.bodyGeometry.leftUpperArmLength.relativeToTorso)
    expect(large.jointAngles.leftKnee.value).toBeCloseTo(small.jointAngles.leftKnee.value)
  })
})

describe('pose landmark temporal smoothing', () => {
  afterEach(() => vi.useRealTimers())

  it('smooths normalized joints and joint angles while preserving raw landmarks', () => {
    const processor = createPoseLandmarkProcessor({ smoothingFactor: 0.5 })
    const first = pose()
    processor.process(first, { width: 640, height: 480, timestamp: 100, trackingStatus: 'tracking' })
    const second = pose(); second[11].x = 0.6; second[13].x = 0.6
    const result = processor.process(second, { width: 640, height: 480, timestamp: 200, trackingStatus: 'tracking' })
    expect(result.joints[11].x).toBeCloseTo(0.5)
    expect(result.joints[11].raw.x).toBe(0.6)
    expect(result.rawLandmarks).toBe(second)
    expect(result.smoothing).toMatchObject({ enabled: true, factor: 0.5, landmarksApplied: 33 })
    expect(result.smoothing.anglesApplied).toBeGreaterThan(0)
  })

  it('resets history after tracking loss and resumes with fresh measurements', () => {
    const processor = createPoseLandmarkProcessor({ smoothingFactor: 0.5 })
    processor.process(pose(), { timestamp: 100, trackingStatus: 'tracking' })
    const lost = processor.process(null, { timestamp: 200, trackingStatus: 'no-pose' })
    expect(lost.smoothing.resetReason).toBe('no-pose')
    const resumed = pose(); resumed[11].x = 0.7
    const result = processor.process(resumed, { timestamp: 300, trackingStatus: 'tracking' })
    expect(result.joints[11].x).toBe(0.7)
    expect(result.smoothing.landmarksApplied).toBe(0)
  })

  it('resets measurements when track identity changes or readings become stale', () => {
    const processor = createPoseLandmarkProcessor({ smoothingFactor: 0.5, maxGapMs: 500 })
    processor.process(pose(), { timestamp: 100, trackId: 'person-a', trackingStatus: 'tracking' })
    const changed = pose(); changed[11].x = 0.7
    expect(processor.process(changed, { timestamp: 200, trackId: 'person-b', trackingStatus: 'tracking' }).joints[11].x).toBe(0.7)
    const stale = pose(); stale[11].x = 0.2
    const result = processor.process(stale, { timestamp: 1000, trackId: 'person-b', trackingStatus: 'tracking' })
    expect(result.joints[11].x).toBe(0.2)
    expect(result.smoothing.resetReason).toBe('stale-or-nonmonotonic-timestamp')
  })

  it('does not smooth unreliable landmarks into valid-looking points', () => {
    const processor = createPoseLandmarkProcessor({ smoothingFactor: 0.4 })
    processor.process(pose(), { timestamp: 1, trackingStatus: 'tracking' })
    const obscured = pose(); obscured[11].visibility = 0.1
    const result = processor.process(obscured, { timestamp: 2, trackingStatus: 'tracking' })
    expect(result.joints[11]).toMatchObject({ reliable: false, confidence: 0.1, x: 0.4 })
    expect(result.jointAngles.leftShoulder.available).toBe(false)
  })

  it('validates smoothing configuration and has bounded repeated processing cost', () => {
    expect(() => createPoseLandmarkProcessor({ smoothingFactor: 1.5 })).toThrow(RangeError)
    const processor = createPoseLandmarkProcessor()
    const raw = pose(), start = performance.now()
    for (let index = 0; index < 500; index++) processor.process(raw, { timestamp: index * 33 + 1, trackingStatus: 'tracking' })
    expect(performance.now() - start).toBeLessThan(2000)
  })

  it('draws optional angle labels only for available reliable measurements', () => {
    const ctx = { save: vi.fn(), restore: vi.fn(), fillText: vi.fn() }
    const canvas = { width: 640, height: 480, getContext: () => ctx }
    const processor = createPoseLandmarkProcessor({ smoothingFactor: 1 })
    const result = processor.process(pose(), { width: 640, height: 480, timestamp: 1, trackingStatus: 'tracking' })
    drawJointAngleLabels(canvas, result)
    expect(ctx.fillText).toHaveBeenCalled()
    expect(ctx.fillText.mock.calls.every(([text]) => text.endsWith('°'))).toBe(true)
  })
})
