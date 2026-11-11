import { describe, expect, it } from 'vitest'
import { classifyPrayerPose, createPrayerPoseRecognizer, DEFAULT_POSE_THRESHOLDS, POSE_STATES } from '../src/lib/poseRecognition.js'
import { createPoseRecognitionHistory } from '../src/lib/poseRecognitionHistory.js'

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

  it.each([
    [11, null, 'leftShoulder'], [12, null, 'rightShoulder'],
    [23, null, 'leftHip'], [24, null, 'rightHip'],
    [25, 'leftKnee', 'leftKnee'], [26, 'rightKnee', 'rightKnee'],
    [27, 'leftKnee', 'leftAnkle'], [28, 'rightKnee', 'rightAnkle'],
  ])('rejects QIYAM with exact bilateral evidence diagnostics for missing landmark %i', (index, unavailableAngle, expectedName) => {
    const pose = processedPose({ confidence: 0.94 })
    pose.validLandmarkCount = 32
    pose.joints[index] = { ...pose.joints[index], reliable: false, confidence: 0.2, reason: 'low-confidence' }
    if (unavailableAngle) pose.jointAngles[unavailableAngle] = { value: null, confidence: 0, available: false, reason: 'unreliable-landmark' }

    const result = classifyPrayerPose(pose)
    const rejection = result.candidateRejections.find((item) => item.candidate === 'QIYAM')
    expect(result.state).toBe('UNKNOWN')
    expect(result.rejectionReasons).toContain('candidate-landmarks-unavailable')
    expect(rejection.reason).toContain(`QIYAM: required landmarks unavailable or unreliable: ${expectedName} (low-confidence, confidence 20%)`)
    expect(rejection.missingLandmarks).toContainEqual(expect.objectContaining({ index, name: expectedName, confidence: 0.2, reason: 'low-confidence' }))
  })

  it('requires both knee measurements even if every knee landmark itself is reliable', () => {
    const pose = processedPose({ confidence: 0.94 })
    pose.jointAngles.rightKnee = { value: null, confidence: 0, available: false, reason: 'zero-length-vector' }

    const result = classifyPrayerPose(pose)
    const rejection = result.candidateRejections.find((item) => item.candidate === 'QIYAM')
    expect(result.state).toBe('UNKNOWN')
    expect(rejection.unavailableMeasurements).toContainEqual({ key: 'rightKnee', reason: 'zero-length-vector', confidence: 0 })
    expect(rejection.reason).toContain('rightKnee measurement unavailable (zero-length-vector; uses rightHip, rightKnee, rightAnkle)')
  })

  it('does not reject Jalsa because an unavailable knee angle and ankle on the opposite side are unused', () => {
    const pose = processedPose({ seated: true, knee: 100 })
    pose.joints[28] = { ...pose.joints[28], reliable: false, confidence: 0.2, reason: 'low-confidence' }
    pose.jointAngles.rightKnee = { value: null, confidence: 0, available: false, reason: 'unreliable-landmark' }

    const result = classifyPrayerPose(pose, { previousPose: { state: 'SUJUD' } })
    expect(result.state).toBe('JALSA')
    expect(result.reasons).toContain('single-side knee evidence (leftKnee)')
    expect(result.candidateRejections.find((item) => item.candidate === 'JALSA')).toBeUndefined()
  })

  it.each([
    ['RUKU', processedPose({ torso: 55 }), null],
    ['ITIDAL', processedPose(), { state: 'RUKU' }],
  ])('requires bilateral knee evidence for %s', (candidate, pose, previousPose) => {
    pose.joints[28] = { ...pose.joints[28], reliable: false, confidence: 0.2, reason: 'low-confidence' }
    pose.jointAngles.rightKnee = { value: null, confidence: 0, available: false, reason: 'unreliable-landmark' }

    const result = classifyPrayerPose(pose, { previousPose })
    expect(result.state).toBe('UNKNOWN')
    expect(result.candidateRejections.find((item) => item.candidate === candidate)?.reason).toContain('rightAnkle (low-confidence, confidence 20%)')
  })

  it('allows TRANSITIONING when its two changed angle measurements do not use the missing ankle', () => {
    const pose = processedPose({ hip: 120 })
    pose.joints[28] = { ...pose.joints[28], reliable: false, confidence: 0.2, reason: 'low-confidence' }
    pose.jointAngles.rightKnee = { value: null, confidence: 0, available: false, reason: 'unreliable-landmark' }
    const previousPose = { state: 'QIYAM', angles: { leftHip: 90, leftShoulder: 70 } }

    const result = classifyPrayerPose(pose, { previousPose })
    expect(result.state).toBe('TRANSITIONING')
    expect(result.candidateRejections.find((item) => item.candidate === 'TRANSITIONING')).toBeUndefined()
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
    const ruku1 = recognizer.process(processedPose({ torso: 55, timestamp: 400 }))
    const ruku2 = recognizer.process(processedPose({ torso: 55, timestamp: 500 }))
    const ruku3 = recognizer.process(processedPose({ torso: 55, timestamp: 600 }))
    expect(ruku1).toMatchObject({ candidatePose: 'RUKU', confirmedPose: 'QIYAM', pendingFrames: 1, stable: false })
    expect(ruku2).toMatchObject({ candidatePose: 'RUKU', confirmedPose: 'QIYAM', pendingFrames: 2, stable: false })
    expect(ruku3).toMatchObject({ candidatePose: 'RUKU', confirmedPose: 'RUKU', pendingFrames: 3, stable: true })
  })

  it('keeps an already-confirmed Qiyam while a restarted Qiyam run is only one frame old', () => {
    const recognizer = createPrayerPoseRecognizer({ stableFrames: 3 })
    for (const timestamp of [100, 200, 300]) recognizer.process(processedPose({ timestamp }))
    recognizer.process(processedPose({ torso: 55, timestamp: 400 })) // transient Ruku candidate resets the streak
    const returnedQiyam = recognizer.process(processedPose({ timestamp: 500 }))
    expect(returnedQiyam).toMatchObject({
      state: 'QIYAM', candidatePose: 'QIYAM', confirmedPose: 'QIYAM',
      pendingFrames: 1, stable: false, stableFramesRequired: 3,
    })
    expect(returnedQiyam.diagnosticReason).toContain('remains confirmed from an earlier stable run')
    expect(returnedQiyam.diagnosticReason).not.toContain('confirmed after 1/3')
    const history = createPoseRecognitionHistory({ now: () => 1000, sampleIntervalMs: 0, changeIntervalMs: 0 })
    const historyEntry = history.record(returnedQiyam, { trackingStatus: 'tracking' })
    expect(historyEntry).toMatchObject({
      candidatePose: 'QIYAM', confirmedPose: 'QIYAM', pendingFrames: 1,
      stable: false, stableFramesRequired: 3,
    })
    expect(historyEntry.recognitionReason).toContain('remains confirmed from an earlier stable run')
    expect(recognizer.process(processedPose({ timestamp: 600 })).pendingFrames).toBe(2)
    expect(recognizer.process(processedPose({ timestamp: 700 })).diagnosticReason).toContain('stable (3/3 frames)')
  })

  it('resets the pending counter whenever the candidate changes', () => {
    const recognizer = createPrayerPoseRecognizer({ stableFrames: 3 })
    expect(recognizer.process(processedPose({ torso: 55, timestamp: 100 }))).toMatchObject({ candidatePose: 'RUKU', pendingFrames: 1 })
    const switched = recognizer.process(processedPose({ timestamp: 200 }))
    expect(switched).toMatchObject({ state: 'UNKNOWN', candidatePose: 'QIYAM', confirmedPose: 'UNKNOWN', pendingFrames: 1, stable: false })
    expect(recognizer.process(processedPose({ timestamp: 300 }))).toMatchObject({ state: 'UNKNOWN', candidatePose: 'QIYAM', pendingFrames: 2 })
    expect(recognizer.process(processedPose({ timestamp: 400 }))).toMatchObject({ state: 'QIYAM', confirmedPose: 'QIYAM', pendingFrames: 3, stable: true })
  })

  it('stores one coherent history entry per recognizer result with truthful confirmation state', () => {
    let wallClock = 1000
    const history = createPoseRecognitionHistory({ now: () => wallClock++, sampleIntervalMs: 0, changeIntervalMs: 0 })
    const recognizer = createPrayerPoseRecognizer({ stableFrames: 3 })
    for (const timestamp of [100, 200, 300]) {
      const result = recognizer.process(processedPose({ timestamp }))
      history.record(result, { trackingStatus: 'tracking', validLandmarkCount: 33, landmarkCount: 33 })
    }
    const entries = history.getEntries().reverse()
    expect(entries.map(({ candidatePose, confirmedPose, pendingFrames, stable }) => ({ candidatePose, confirmedPose, pendingFrames, stable }))).toEqual([
      { candidatePose: 'QIYAM', confirmedPose: 'UNKNOWN', pendingFrames: 1, stable: false },
      { candidatePose: 'QIYAM', confirmedPose: 'UNKNOWN', pendingFrames: 2, stable: false },
      { candidatePose: 'QIYAM', confirmedPose: 'QIYAM', pendingFrames: 3, stable: true },
    ])
    expect(entries.map((entry) => entry.recognitionReason)).toEqual([
      'Candidate QIYAM pending temporal confirmation (1/3 frames)',
      'Candidate QIYAM pending temporal confirmation (2/3 frames)',
      'QIYAM confirmed after 3/3 stable frames',
    ])
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
    const recognizer = createPrayerPoseRecognizer({ stableFrames: 3 })
    expect(recognizer.process(processedPose({ timestamp: 100 })).pendingFrames).toBe(1)
    expect(recognizer.process(processedPose({ timestamp: 200 })).pendingFrames).toBe(2)
    expect(recognizer.process({ trackingStatus: 'no-pose', timestamp: 250 })).toMatchObject({
      state: 'UNKNOWN', confirmedPose: 'UNKNOWN', stable: false, pendingFrames: 0,
      diagnosticReason: 'Recognition history reset: tracking-no-pose', timeSincePreviousMs: 50,
    })
    expect(recognizer.process(processedPose({ timestamp: 300 }))).toMatchObject({ candidatePose: 'QIYAM', pendingFrames: 1, stable: false })
    expect(recognizer.process(processedPose({ timestamp: 400 })).pendingFrames).toBe(2)
    expect(recognizer.process(processedPose({ timestamp: 500 })).confirmedPose).toBe('QIYAM')
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
