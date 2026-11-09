/**
 * MediaPipe Pose Landmarker landmark processing and geometric measurements.
 * Coordinates remain normalized to the source image. Derived 2D distances use
 * image-diagonal units so their values do not depend on pixel resolution.
 */

export const LANDMARK_COUNT = 33
export const LANDMARK_NAMES = Object.freeze([
  'nose', 'leftEyeInner', 'leftEye', 'leftEyeOuter', 'rightEyeInner', 'rightEye', 'rightEyeOuter',
  'leftEar', 'rightEar', 'mouthLeft', 'mouthRight', 'leftShoulder', 'rightShoulder', 'leftElbow',
  'rightElbow', 'leftWrist', 'rightWrist', 'leftPinky', 'rightPinky', 'leftIndex', 'rightIndex',
  'leftThumb', 'rightThumb', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle',
  'rightAnkle', 'leftHeel', 'rightHeel', 'leftFootIndex', 'rightFootIndex',
])

const I = Object.freeze({
  leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14, leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28,
  leftFootIndex: 31, rightFootIndex: 32,
})

const clamp01 = (value) => Math.max(0, Math.min(1, value))
const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const unavailable = (reason = 'unavailable', confidence = 0) => ({ value: null, confidence, available: false, unit: 'degrees', reason })

function confidenceOf(point) {
  if (!point || typeof point !== 'object') return { value: null, reason: 'missing-landmark' }
  const scores = []
  for (const key of ['visibility', 'presence']) {
    if (point[key] === undefined || point[key] === null) continue
    if (!finite(point[key]) || point[key] < 0 || point[key] > 1) return { value: null, reason: `invalid-${key}` }
    scores.push(point[key])
  }
  if (scores.length === 0) return { value: null, reason: 'missing-confidence' }
  return { value: Math.min(...scores), reason: null }
}

function normalizedJoint(point, index, minConfidence, warnings) {
  const name = LANDMARK_NAMES[index] || `landmark${index}`
  const confidence = confidenceOf(point)
  const validCoordinates = finite(point?.x) && finite(point?.y) && (point?.z == null || finite(point.z))
  if (!validCoordinates) {
    return { index, name, x: null, y: null, z: null, normalized: null, confidence: confidence.value, reliable: false, reason: 'invalid-coordinates' }
  }
  if (confidence.value === null) {
    return { index, name, x: point.x, y: point.y, z: point.z ?? null, normalized: { x: point.x, y: point.y, z: point.z ?? null }, confidence: null, reliable: false, reason: confidence.reason }
  }
  if (confidence.value < minConfidence) {
    return { index, name, x: point.x, y: point.y, z: point.z ?? null, normalized: { x: point.x, y: point.y, z: point.z ?? null }, confidence: confidence.value, reliable: false, reason: 'low-confidence' }
  }
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) warnings.push(`landmark-outside-frame:${name}`)
  return {
    index, name, x: point.x, y: point.y, z: point.z ?? null,
    normalized: { x: point.x, y: point.y, z: point.z ?? null },
    confidence: confidence.value, reliable: true, reason: null,
  }
}

function pointConfidence(point) {
  if (!point || point.reliable === false) return null
  if (finite(point.confidence)) return point.confidence
  return confidenceOf(point).value
}

/** Calculate the inner angle at b. Returns a measurement object, never NaN. */
export function calculateAngle(a, b, c, { dimensions = 2, width = 1, height = 1, minConfidence = 0.5 } = {}) {
  const confidenceValues = [pointConfidence(a), pointConfidence(b), pointConfidence(c)]
  if (confidenceValues.some((value) => value === null)) {
    const reason = [a, b, c].some((point) => point?.reason === 'missing-confidence') ? 'missing-confidence' : 'unreliable-landmark'
    return unavailable(reason, 0)
  }
  if (confidenceValues.some((value) => value < minConfidence)) return unavailable('low-confidence', Math.min(...confidenceValues))
  const use3d = dimensions === 3 || dimensions === '3d'
  const sx = finite(width) && width > 0 ? width : 1
  const sy = finite(height) && height > 0 ? height : 1
  const coordinate = (point) => {
    if (!finite(point?.x) || !finite(point?.y) || (use3d && !finite(point?.z))) return null
    return use3d
      ? [point.x * sx, point.y * sy, point.z * sx]
      : [point.x * sx, point.y * sy]
  }
  const pa = coordinate(a), pb = coordinate(b), pc = coordinate(c)
  if (!pa || !pb || !pc) return unavailable('invalid-coordinates', 0)
  const u = pa.map((value, index) => value - pb[index])
  const v = pc.map((value, index) => value - pb[index])
  const normU = Math.hypot(...u), normV = Math.hypot(...v)
  if (!(normU > 0) || !(normV > 0)) return unavailable('zero-length-vector', Math.min(...confidenceValues))
  const cosine = Math.max(-1, Math.min(1, u.reduce((sum, value, index) => sum + value * v[index], 0) / (normU * normV)))
  return { value: Math.acos(cosine) * 180 / Math.PI, confidence: Math.min(...confidenceValues), available: true, unit: 'degrees', reason: null }
}

function pointAt(joints, index) { return joints[index] || null }

function midpoint(a, b) {
  if (!a?.reliable || !b?.reliable) return null
  return {
    x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
    z: finite(a.z) && finite(b.z) ? (a.z + b.z) / 2 : null,
    confidence: Math.min(a.confidence, b.confidence), reliable: true,
  }
}

function distanceMeasurement(a, b, { width, height, torsoLength = null } = {}) {
  if (!a?.reliable || !b?.reliable) return { value: null, confidence: 0, available: false, unit: 'image-diagonals', relativeToTorso: null, reason: 'unreliable-landmark' }
  const diagonal = Math.hypot(width, height)
  if (!(diagonal > 0)) return { value: null, confidence: 0, available: false, unit: 'image-diagonals', relativeToTorso: null, reason: 'invalid-image-dimensions' }
  const dx = (a.x - b.x) * width, dy = (a.y - b.y) * height
  const dz = finite(a.z) && finite(b.z) ? (a.z - b.z) * width : 0
  const value = Math.hypot(dx, dy, dz) / diagonal
  const relativeToTorso = finite(torsoLength) && torsoLength > 0 ? Math.hypot(dx, dy, dz) / torsoLength : null
  return { value, confidence: Math.min(a.confidence, b.confidence), available: true, unit: 'image-diagonals', relativeToTorso, reason: relativeToTorso === null ? 'torso-reference-unavailable' : null }
}

function alignmentMeasurement(a, b, width, height) {
  if (!a?.reliable || !b?.reliable) return { value: null, confidence: 0, available: false, unit: 'degrees', reason: 'unreliable-landmark' }
  const dx = (b.x - a.x) * width, dy = (b.y - a.y) * height
  if (Math.hypot(dx, dy) === 0) return unavailable('zero-length-vector', Math.min(a.confidence, b.confidence))
  return { value: Math.atan2(dy, dx) * 180 / Math.PI, confidence: Math.min(a.confidence, b.confidence), available: true, unit: 'degrees', reason: null }
}

function calculateMeasurements(joints, width, height, minConfidence = 0.5) {
  const angle = (a, b, c) => calculateAngle(pointAt(joints, a), pointAt(joints, b), pointAt(joints, c), { width, height, minConfidence })
  const jointAngles = {
    leftElbow: angle(I.leftShoulder, I.leftElbow, I.leftWrist),
    rightElbow: angle(I.rightShoulder, I.rightElbow, I.rightWrist),
    leftShoulder: angle(I.leftElbow, I.leftShoulder, I.leftHip),
    rightShoulder: angle(I.rightElbow, I.rightShoulder, I.rightHip),
    leftHip: angle(I.leftShoulder, I.leftHip, I.leftKnee),
    rightHip: angle(I.rightShoulder, I.rightHip, I.rightKnee),
    leftKnee: angle(I.leftHip, I.leftKnee, I.leftAnkle),
    rightKnee: angle(I.rightHip, I.rightKnee, I.rightAnkle),
    leftAnkle: angle(I.leftKnee, I.leftAnkle, I.leftFootIndex),
    rightAnkle: angle(I.rightKnee, I.rightAnkle, I.rightFootIndex),
  }
  const leftShoulder = pointAt(joints, I.leftShoulder), rightShoulder = pointAt(joints, I.rightShoulder)
  const leftHip = pointAt(joints, I.leftHip), rightHip = pointAt(joints, I.rightHip)
  const shoulders = midpoint(leftShoulder, rightShoulder), hips = midpoint(leftHip, rightHip)
  const diagonal = Math.hypot(width, height)
  const torsoLengthPx = shoulders?.reliable && hips?.reliable
    ? Math.hypot((shoulders.x - hips.x) * width, (shoulders.y - hips.y) * height)
    : null
  const torsoLength = finite(torsoLengthPx) ? torsoLengthPx / diagonal : null
  const bodyGeometry = {
    shoulderWidth: distanceMeasurement(leftShoulder, rightShoulder, { width, height, torsoLength: torsoLengthPx }),
    hipWidth: distanceMeasurement(leftHip, rightHip, { width, height, torsoLength: torsoLengthPx }),
    torsoLength: torsoLength == null
      ? { value: null, confidence: 0, available: false, unit: 'image-diagonals', relativeToTorso: null, reason: 'unreliable-landmark' }
      : { value: torsoLength, confidence: Math.min(shoulders.confidence, hips.confidence), available: true, unit: 'image-diagonals', relativeToTorso: 1, reason: null },
    leftUpperArmLength: distanceMeasurement(leftShoulder, pointAt(joints, I.leftElbow), { width, height, torsoLength: torsoLengthPx }),
    rightUpperArmLength: distanceMeasurement(rightShoulder, pointAt(joints, I.rightElbow), { width, height, torsoLength: torsoLengthPx }),
    leftForearmLength: distanceMeasurement(pointAt(joints, I.leftElbow), pointAt(joints, I.leftWrist), { width, height, torsoLength: torsoLengthPx }),
    rightForearmLength: distanceMeasurement(pointAt(joints, I.rightElbow), pointAt(joints, I.rightWrist), { width, height, torsoLength: torsoLengthPx }),
    leftThighLength: distanceMeasurement(leftHip, pointAt(joints, I.leftKnee), { width, height, torsoLength: torsoLengthPx }),
    rightThighLength: distanceMeasurement(rightHip, pointAt(joints, I.rightKnee), { width, height, torsoLength: torsoLengthPx }),
    leftLowerLegLength: distanceMeasurement(pointAt(joints, I.leftKnee), pointAt(joints, I.leftAnkle), { width, height, torsoLength: torsoLengthPx }),
    rightLowerLegLength: distanceMeasurement(pointAt(joints, I.rightKnee), pointAt(joints, I.rightAnkle), { width, height, torsoLength: torsoLengthPx }),
    shoulderHipDistance: distanceMeasurement(shoulders, hips, { width, height, torsoLength: torsoLengthPx }),
  }
  const kneeDifference = jointAngles.leftKnee.available && jointAngles.rightKnee.available
    ? Math.abs(jointAngles.leftKnee.value - jointAngles.rightKnee.value)
    : null
  const bodyOrientation = finite(leftShoulder?.z) && finite(rightShoulder?.z) && leftShoulder.reliable && rightShoulder.reliable
    ? {
        yawDegrees: Math.atan2((rightShoulder.z - leftShoulder.z) * width, Math.abs((rightShoulder.x - leftShoulder.x) * width)) * 180 / Math.PI,
        confidence: Math.min(leftShoulder.confidence, rightShoulder.confidence), available: true,
        reference: 'camera-relative estimate from shoulder depth; not a calibrated anatomical orientation',
      }
    : { yawDegrees: null, confidence: 0, available: false, reference: 'requires reliable shoulder depth landmarks' }
  const torsoInclination = shoulders?.reliable && hips?.reliable
    ? (() => {
        const dx = (shoulders.x - hips.x) * width
        const dy = (hips.y - shoulders.y) * height
        if (Math.hypot(dx, dy) === 0) return unavailable('zero-length-torso', Math.min(shoulders.confidence, hips.confidence))
        return { value: Math.atan2(dx, dy) * 180 / Math.PI, confidence: Math.min(shoulders.confidence, hips.confidence), available: true, unit: 'degrees', reason: null }
      })()
    : unavailable('unreliable-landmark')
  const center = hips
    ? { x: hips.x, y: hips.y, confidence: hips.confidence, available: true, reference: 'midpoint of hips' }
    : { x: null, y: null, confidence: 0, available: false, reference: 'requires both hip landmarks' }
  return {
    jointAngles,
    bodyGeometry,
    torsoInclination,
    shoulderAlignment: alignmentMeasurement(leftShoulder, rightShoulder, width, height),
    hipAlignment: alignmentMeasurement(leftHip, rightHip, width, height),
    kneeSymmetry: { value: kneeDifference, confidence: kneeDifference === null ? 0 : Math.min(jointAngles.leftKnee.confidence, jointAngles.rightKnee.confidence), available: kneeDifference !== null, unit: 'degrees', reason: kneeDifference === null ? 'both-knee-angles-required' : null },
    bodyCenter: center,
    bodyOrientation,
  }
}

/**
 * Validate MediaPipe's 33-point pose and calculate normalized measurements.
 * Unavailable values are represented by `value: null` plus `available: false`.
 */
export function processPoseLandmarks(rawLandmarks, { timestamp = null, width = 1, height = 1, minConfidence = 0.5, trackingStatus = null } = {}) {
  const startedAt = performance.now()
  const warnings = []
  const validDimensions = finite(width) && width > 0 && finite(height) && height > 0
  const landmarks = Array.isArray(rawLandmarks) ? rawLandmarks : []
  if (!Array.isArray(rawLandmarks)) warnings.push('landmarks-not-an-array')
  if (landmarks.length !== LANDMARK_COUNT) warnings.push(`expected-${LANDMARK_COUNT}-landmarks:received-${landmarks.length}`)
  if (!validDimensions) warnings.push('invalid-image-dimensions')
  const joints = Array.from({ length: LANDMARK_COUNT }, (_, index) => normalizedJoint(landmarks[index], index, minConfidence, warnings))
  const validLandmarkCount = joints.filter((joint) => joint.reliable).length
  if (validLandmarkCount < LANDMARK_COUNT) warnings.push(`unreliable-landmarks:${LANDMARK_COUNT - validLandmarkCount}`)
  const status = trackingStatus || (validLandmarkCount >= 27 ? 'tracking' : validLandmarkCount > 0 ? 'partial' : 'no-pose')
  const measurements = validDimensions
    ? calculateMeasurements(joints, width, height, minConfidence)
    : calculateMeasurements(Array(LANDMARK_COUNT).fill(null), 0, 0, minConfidence)
  const confidenceValues = joints.filter((joint) => joint.reliable).map((joint) => joint.confidence)
  return {
    timestamp, trackingStatus: status, landmarkCount: landmarks.length, validLandmarkCount,
    joints, rawLandmarks, ...measurements,
    confidence: confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : 0,
    qualityWarnings: [...new Set(warnings)],
    processingDurationMs: performance.now() - startedAt,
  }
}

/**
 * Stateful, lightweight EMA processor. `smoothingFactor` is the current-frame
 * weight (0 means frozen; 1 means no smoothing). Loss, identity change, or a
 * stale timestamp clears all history; unreliable joints are never smoothed.
 */
export function createPoseLandmarkProcessor({ minConfidence = 0.5, smoothingFactor = 0.55, maxGapMs = 1000 } = {}) {
  if (!finite(smoothingFactor) || smoothingFactor < 0 || smoothingFactor > 1) throw new RangeError('smoothingFactor must be between 0 and 1')
  let previousJoints = new Map()
  let previousAngles = new Map()
  let previousTimestamp = null
  let previousTrackId = null

  const reset = () => {
    previousJoints.clear()
    previousAngles.clear()
    previousTimestamp = null
    previousTrackId = null
  }

  return {
    reset,
    process(rawLandmarks, options = {}) {
      const processingStartedAt = performance.now()
      const timestamp = finite(options.timestamp) ? options.timestamp : performance.now()
      const trackId = options.trackId ?? null
      const status = options.trackingStatus || null
      let resetReason = null
      if ((previousTrackId !== null && trackId !== previousTrackId) || (previousTrackId === null && trackId !== null)) resetReason = 'track-changed'
      if (previousTimestamp !== null && (timestamp <= previousTimestamp || timestamp - previousTimestamp > maxGapMs)) resetReason = 'stale-or-nonmonotonic-timestamp'
      if (['no-pose', 'tracking-lost', 'multiple', 'unknown', 'invalid'].includes(status)) resetReason = status
      if (resetReason) reset()

      const result = processPoseLandmarks(rawLandmarks, { ...options, timestamp, minConfidence, trackingStatus: status })
      if (['no-pose', 'tracking-lost', 'multiple', 'unknown', 'invalid'].includes(result.trackingStatus) || result.validLandmarkCount === 0) {
        reset()
        result.smoothing = { enabled: smoothingFactor < 1, factor: smoothingFactor, landmarksApplied: 0, anglesApplied: 0, resetReason: result.trackingStatus }
        result.processingDurationMs = performance.now() - processingStartedAt
        return result
      }

      let landmarksApplied = 0
      const joints = result.joints.map((joint) => {
        if (!joint.reliable) { previousJoints.delete(joint.index); return joint }
        const old = previousJoints.get(joint.index)
        const raw = { x: joint.x, y: joint.y, z: joint.z }
        const smoothed = old
          ? {
              x: old.x + smoothingFactor * (joint.x - old.x),
              y: old.y + smoothingFactor * (joint.y - old.y),
              z: finite(old.z) && finite(joint.z) ? old.z + smoothingFactor * (joint.z - old.z) : joint.z,
            }
          : raw
        if (old) landmarksApplied++
        previousJoints.set(joint.index, smoothed)
        return { ...joint, x: smoothed.x, y: smoothed.y, z: smoothed.z, normalized: { ...smoothed }, raw }
      })

      const measurements = calculateMeasurements(joints, finite(options.width) && options.width > 0 ? options.width : 1, finite(options.height) && options.height > 0 ? options.height : 1, minConfidence)
      let anglesApplied = 0
      for (const [key, measurement] of Object.entries(measurements.jointAngles)) {
        const old = previousAngles.get(key)
        if (!measurement.available) { previousAngles.delete(key); continue }
        if (old) {
          measurement.value = old + smoothingFactor * (measurement.value - old)
          anglesApplied++
        }
        previousAngles.set(key, measurement.value)
      }
      previousTimestamp = timestamp
      previousTrackId = trackId
      return {
        ...result, ...measurements, joints,
        smoothing: { enabled: smoothingFactor < 1, factor: smoothingFactor, landmarksApplied, anglesApplied, resetReason },
        processingDurationMs: performance.now() - processingStartedAt,
      }
    },
  }
}

/** Draw development-only joint-angle labels; no landmarks are synthesized. */
export function drawJointAngleLabels(canvas, processedPose) {
  const ctx = canvas?.getContext?.('2d')
  if (!ctx || !processedPose?.joints) return
  const labels = [
    ['leftElbow', I.leftElbow], ['rightElbow', I.rightElbow],
    ['leftShoulder', I.leftShoulder], ['rightShoulder', I.rightShoulder],
    ['leftHip', I.leftHip], ['rightHip', I.rightHip], ['leftKnee', I.leftKnee], ['rightKnee', I.rightKnee],
  ]
  const { width, height } = canvas
  ctx.save()
  ctx.font = `${Math.max(11, width / 54)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = '#ffe08a'
  for (const [key, index] of labels) {
    const joint = processedPose.joints[index], measurement = processedPose.jointAngles[key]
    if (!joint?.reliable || !measurement?.available) continue
    ctx.fillText(`${Math.round(measurement.value)}°`, joint.x * width, joint.y * height - 5)
  }
  ctx.restore()
}
