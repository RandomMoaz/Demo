import { describe, expect, it } from 'vitest'
import { classifyPrayerPose, createPrayerPoseRecognizer, DEFAULT_POSE_THRESHOLDS, POSE_STATES } from '../src/lib/poseRecognition.js'

function processedPose({ torso = 0, knee = 170, hip = 170, seated = false, low = false, raisedHand = false, confidence = 0.95, timestamp = 100 } = {}) {
  const joints = Array.from({ length: 33 }, (_, index) => ({ index, x: 0.5, y: 0.5, z: 0, confidence, reliable: true }))
  const sy = low ? 0.53 : seated ? 0.30 : 0.25
  const hy = seated ? 0.60 : low ? 0.55 : 0.50
  for (const [index, x, y] of [[11, 0.4, sy], [12, 0.6, sy], [23, 0.44, hy], [24, 0.56, hy], [25, 0.44, seated ? 0.72 : 0.72], [26, 0.56, seated ? 0.72 : 0.72], [15, 0.35, raisedHand ? 0.10 : 0.43], [16, 0.65, 0.43]]) joints[index] = { ...joints[index], x, y }
  const angle = (value) => ({ value, confidence, available: true })
  const missing = () => ({ value: null, confidence: 0, available: false })
  const jointAngles = {
    leftElbow: angle(145), rightElbow: angle(145), leftShoulder: angle(90), rightShoulder: angle(90),
    leftHip: angle(hip), rightHip: angle(hip), leftKnee: angle(knee), rightKnee: angle(knee),
    leftAnkle: angle(90), rightAnkle: angle(90),
  }
  return {
    timestamp, trackingStatus: 'tracking', validLandmarkCount: 33, confidence,
    joints, jointAngles,
    torsoInclination: { value: torso, confidence, available: true },
  }
}

describe('rule-based prayer pose recognition', () => {
  it('defines the ten requested states and configurable conservative thresholds', () => {
    expect(POSE_STATES).toEqual(['QIYAM', 'RUKU', 'ITIDAL', 'SUJUD', 'JALSA', 'SECOND_SUJUD', 'TASHAHHUD', 'SALAM', 'TRANSITIONING', 'UNKNOWN'])
    expect(DEFAULT_POSE_THRESHOLDS.minConfidence).toBeGreaterThan(0)
  })

  it('recognizes a standing Qiyam candidate', () => {
    expect(classifyPrayerPose(processedPose())).toMatchObject({ state: 'QIYAM', status: 'candidate' })
  })

  it('distinguishes bowing Ruku from upright posture by torso inclination and knees', () => {
    expect(classifyPrayerPose(processedPose({ torso: 55 })).state).toBe('RUKU')
    expect(classifyPrayerPose(processedPose({ torso: 32 })).state).toBe('UNKNOWN')
  })

  it('uses immediate stable-pose context to distinguish Itidal from Qiyam', () => {
    expect(classifyPrayerPose(processedPose(), { previousPose: { state: 'RUKU' } }).state).toBe('ITIDAL')
    expect(classifyPrayerPose(processedPose()).state).toBe('QIYAM')
  })

  it('recognizes prostration and uses Jalsa context for second sujud', () => {
    const sujud = processedPose({ torso: 58, low: true })
    expect(classifyPrayerPose(sujud).state).toBe('SUJUD')
    expect(classifyPrayerPose(sujud, { previousPose: { state: 'JALSA' } }).state).toBe('SECOND_SUJUD')
  })

  it('does not force a sitting subtype when geometry is ambiguous', () => {
    expect(classifyPrayerPose(processedPose({ seated: true, knee: 100 })).state).toBe('UNKNOWN')
  })

  it('uses recent postural context to report Jalsa and retain an explicit Tashahhud context', () => {
    const sitting = processedPose({ seated: true, knee: 100 })
    expect(classifyPrayerPose(sitting, { previousPose: { state: 'SUJUD' } }).state).toBe('JALSA')
    expect(classifyPrayerPose(sitting, { previousPose: { state: 'TASHAHHUD' } }).state).toBe('TASHAHHUD')
  })

  it('recognizes Salam only with upright geometry and visible raised wrist', () => {
    expect(classifyPrayerPose(processedPose({ raisedHand: true })).state).toBe('SALAM')
    expect(classifyPrayerPose(processedPose({ torso: 55, raisedHand: true })).state).toBe('RUKU')
  })

  it('returns UNKNOWN for insufficient confidence, landmarks, or lost tracking', () => {
    expect(classifyPrayerPose(processedPose({ confidence: 0.2 })).state).toBe('UNKNOWN')
    expect(classifyPrayerPose({ ...processedPose(), validLandmarkCount: 9 }).state).toBe('UNKNOWN')
    expect(classifyPrayerPose({ ...processedPose(), trackingStatus: 'tracking-lost' })).toMatchObject({ state: 'UNKNOWN', status: 'tracking-unavailable' })
  })

  it('handles missing required joint measurements without manufacturing a posture', () => {
    const pose = processedPose({ torso: 55 })
    pose.jointAngles.leftKnee.available = false
    pose.jointAngles.rightKnee.available = false
    expect(classifyPrayerPose(pose).state).toBe('UNKNOWN')
  })

  it('classifies transition from substantial, multi-joint temporal change', () => {
    const prior = { state: 'QIYAM', angles: { leftHip: 170, rightHip: 170, leftKnee: 170, rightKnee: 170 } }
    const pose = processedPose({ torso: 55, hip: 120, knee: 120 })
    expect(classifyPrayerPose(pose, { previousPose: prior }).state).toBe('TRANSITIONING')
  })

  it('applies temporal stability and hysteresis across posture changes', () => {
    const recognizer = createPrayerPoseRecognizer({ stableFrames: 3 })
    const first = recognizer.process(processedPose({ timestamp: 100 }))
    expect(first).toMatchObject({ state: 'UNKNOWN', candidatePose: 'QIYAM', confirmedPose: 'UNKNOWN', pendingFrames: 1, stableFramesRequired: 3 })
    expect(first.diagnosticReason).toContain('pending temporal confirmation')
    const second = recognizer.process(processedPose({ timestamp: 200 }))
    expect(second).toMatchObject({ state: 'UNKNOWN', candidatePose: 'QIYAM', confirmedPose: 'UNKNOWN', pendingFrames: 2 })
    const third = recognizer.process(processedPose({ timestamp: 300 }))
    expect(third).toMatchObject({ state: 'QIYAM', candidatePose: 'QIYAM', confirmedPose: 'QIYAM', pendingFrames: 3, stable: true })
    expect(third.diagnosticReason).toContain('confirmed after 3/3')
    recognizer.process(processedPose({ torso: 55, timestamp: 400 }))
    expect(recognizer.process(processedPose({ torso: 55, timestamp: 500 })).state).toBe('QIYAM')
    expect(recognizer.process(processedPose({ torso: 55, timestamp: 600 })).state).toBe('RUKU')
  })

  it('reports exact torso and knee threshold failures without changing the classification', () => {
    const torsoRejected = classifyPrayerPose(processedPose({ torso: 23 }))
    expect(torsoRejected.state).toBe('UNKNOWN')
    expect(torsoRejected.rejectionReasons).toContain('QIYAM: torso inclination 23.0° exceeds 22°')
    const kneeRejected = classifyPrayerPose(processedPose({ knee: 149 }))
    expect(kneeRejected.state).toBe('UNKNOWN')
    expect(kneeRejected.rejectionReasons).toContain('QIYAM: average available knee angle 149.0° is below 150°')
  })

  it('reports a low critical-measurement confidence even when overall confidence is high', () => {
    const pose = processedPose({ confidence: 0.92 })
    pose.torsoInclination.confidence = 0.55
    const result = classifyPrayerPose(pose)
    expect(result.state).toBe('UNKNOWN')
    expect(result.reasons).toContain('low-measurement-confidence')
    expect(result.rejectionReasons).toContain('torsoInclination confidence 55% is below 58%')
    expect(result.confidenceBreakdown.overall).toBe(0.92)
  })

  it('identifies missing critical landmarks and unavailable derived angles', () => {
    const pose = processedPose()
    pose.joints[11] = { ...pose.joints[11], reliable: false, reason: 'low-confidence', confidence: 0.2 }
    pose.torsoInclination = { value: null, confidence: 0, available: false, reason: 'unreliable-landmark' }
    const result = classifyPrayerPose(pose)
    expect(result.state).toBe('UNKNOWN')
    expect(result.measurements.torsoInclination).toMatchObject({ available: false, degrees: null })
    expect(result.criticalLandmarks.find((item) => item.index === 11)).toMatchObject({ reliable: false, confidence: 0.2 })
    expect(result.rejectionReasons.join(' ')).toContain('Critical landmarks unavailable or unreliable: leftShoulder')
  })

  it('resets state after tracking loss and recovers after tracking resumes', () => {
    const recognizer = createPrayerPoseRecognizer({ stableFrames: 1 })
    expect(recognizer.process(processedPose()).state).toBe('QIYAM')
    expect(recognizer.process({ trackingStatus: 'no-pose', timestamp: 200 })).toMatchObject({ state: 'UNKNOWN', stable: false, diagnosticReason: 'Recognition history reset: tracking-no-pose', timeSincePreviousMs: 100 })
    expect(recognizer.process(processedPose({ timestamp: 300 })).timeSincePreviousMs).toBe(100)
    expect(recognizer.process(processedPose({ timestamp: 400 })).state).toBe('QIYAM')
  })

  it('reports timestamp gaps that reset temporal confirmation and resumes with a fresh candidate', () => {
    const recognizer = createPrayerPoseRecognizer({ stableFrames: 3 })
    recognizer.process(processedPose({ timestamp: 100 }))
    recognizer.process(processedPose({ timestamp: 200 }))
    const gap = recognizer.process(processedPose({ timestamp: 2001 }))
    expect(gap).toMatchObject({
      state: 'UNKNOWN', candidatePose: 'UNKNOWN', confirmedPose: 'UNKNOWN', pendingFrames: 0,
      timeSincePreviousMs: 1801, diagnosticReason: 'Recognition history reset: timestamp-gap-over-1800ms',
    })
    const resumed = recognizer.process(processedPose({ timestamp: 2100 }))
    expect(resumed).toMatchObject({ candidatePose: 'QIYAM', pendingFrames: 1, timeSincePreviousMs: 99 })
    expect(resumed.measurements).toMatchObject({ torsoInclination: { degrees: 0, available: true }, leftKnee: { degrees: 170, available: true }, rightKnee: { degrees: 170, available: true } })
  })

  it('rejects stale timestamps and handles camera-angle/proportion variation conservatively', () => {
    const recognizer = createPrayerPoseRecognizer({ stableFrames: 1 })
    recognizer.process(processedPose({ timestamp: 300 }))
    expect(recognizer.process(processedPose({ torso: 55, timestamp: 100 })).state).toBe('UNKNOWN')
    expect(classifyPrayerPose(processedPose({ torso: 24 })).state).toBe('UNKNOWN')
    // Rule inputs are normalized angles and confidence, independent of pixel scale.
    expect(classifyPrayerPose(processedPose({ torso: 55, knee: 165 })).state).toBe('RUKU')
  })
})
