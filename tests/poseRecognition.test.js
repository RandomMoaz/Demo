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
    expect(recognizer.process(processedPose({ timestamp: 100 })).state).toBe('UNKNOWN')
    expect(recognizer.process(processedPose({ timestamp: 200 })).state).toBe('UNKNOWN')
    expect(recognizer.process(processedPose({ timestamp: 300 })).state).toBe('QIYAM')
    recognizer.process(processedPose({ torso: 55, timestamp: 400 }))
    expect(recognizer.process(processedPose({ torso: 55, timestamp: 500 })).state).toBe('QIYAM')
    expect(recognizer.process(processedPose({ torso: 55, timestamp: 600 })).state).toBe('RUKU')
  })

  it('resets state after tracking loss and recovers after tracking resumes', () => {
    const recognizer = createPrayerPoseRecognizer({ stableFrames: 1 })
    expect(recognizer.process(processedPose()).state).toBe('QIYAM')
    expect(recognizer.process({ trackingStatus: 'no-pose', timestamp: 200 })).toMatchObject({ state: 'UNKNOWN', stable: false })
    expect(recognizer.process(processedPose({ timestamp: 300 })).state).toBe('QIYAM')
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
