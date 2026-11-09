/**
 * Explainable visual posture classifier built on processPoseLandmarks output.
 * This module classifies visible geometry only; it contains no teaching or
 * religious validity rules. Short-term context distinguishes visually
 * equivalent upright/prostration postures without tracking prayer sequences.
 */

export const POSE_STATES = Object.freeze([
  'QIYAM', 'RUKU', 'ITIDAL', 'SUJUD', 'JALSA', 'SECOND_SUJUD', 'TASHAHHUD',
  'SALAM', 'TRANSITIONING', 'UNKNOWN',
])

export const DEFAULT_POSE_THRESHOLDS = Object.freeze({
  minConfidence: 0.58,
  minValidLandmarks: 20,
  uprightTorsoDegrees: 22,
  bowTorsoDegrees: 38,
  prostrationTorsoDegrees: 48,
  seatedKneeDegrees: 138,
  standingKneeDegrees: 150,
  armRaisedHeightOffset: 0.035,
  bowVerticalRatio: 0.25,
  prostrateAlignmentRatio: 0.25,
  seatedTorsoRatio: 0.12,
  transitionAngleDeltaDegrees: 16,
  stableFrames: 3,
  candidateMargin: 0.08,
  historyFrames: 1800,
})

const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const measure = (pose, key) => pose?.jointAngles?.[key]
const joint = (pose, index) => pose?.joints?.[index]
const reliable = (point) => point?.reliable === true && finite(point.x) && finite(point.y)
const available = (item) => item?.available === true && finite(item.value) && finite(item.confidence)
const clamp01 = (value) => Math.max(0, Math.min(1, value))

function avgReliable(items) {
  const values = items.filter(available)
  return values.length ? {
    value: values.reduce((sum, item) => sum + item.value, 0) / values.length,
    confidence: values.reduce((sum, item) => sum + item.confidence, 0) / values.length,
  } : null
}

function verticalOrder(pose) {
  const shoulders = [joint(pose, 11), joint(pose, 12)].filter(reliable)
  const hips = [joint(pose, 23), joint(pose, 24)].filter(reliable)
  const knees = [joint(pose, 25), joint(pose, 26)].filter(reliable)
  if (!shoulders.length || !hips.length || !knees.length) return null
  const meanY = (points) => points.reduce((sum, point) => sum + point.y, 0) / points.length
  return { shoulders: meanY(shoulders), hips: meanY(hips), knees: meanY(knees) }
}

function evidenceConfidence(pose, measurements) {
  const confidence = [pose?.confidence, ...measurements.filter(available).map((item) => item.confidence)].filter(finite)
  return confidence.length ? Math.min(...confidence) : 0
}

/** Score plausible postures from processed landmarks; unavailable evidence is never inferred. */
export function classifyPrayerPose(pose, { thresholds = {}, previousPose = null } = {}) {
  const config = { ...DEFAULT_POSE_THRESHOLDS, ...thresholds }
  const base = { state: 'UNKNOWN', confidence: 0, postureConfidence: 0, status: 'insufficient-evidence', candidates: [], reasons: [] }
  if (!pose || typeof pose !== 'object') return { ...base, reasons: ['missing-processed-pose'] }
  if (['no-pose', 'tracking-lost', 'multiple', 'unknown', 'invalid'].includes(pose.trackingStatus)) {
    return { ...base, status: 'tracking-unavailable', reasons: [`tracking-${pose.trackingStatus}`] }
  }
  if (!finite(pose.validLandmarkCount) || pose.validLandmarkCount < config.minValidLandmarks) {
    return { ...base, reasons: ['too-few-valid-landmarks'] }
  }

  const torso = pose.torsoInclination
  const leftKnee = measure(pose, 'leftKnee'), rightKnee = measure(pose, 'rightKnee')
  const knees = avgReliable([leftKnee, rightKnee])
  const leftHip = measure(pose, 'leftHip'), rightHip = measure(pose, 'rightHip')
  const hips = avgReliable([leftHip, rightHip])
  const leftShoulder = measure(pose, 'leftShoulder'), rightShoulder = measure(pose, 'rightShoulder')
  const shoulders = avgReliable([leftShoulder, rightShoulder])
  const order = verticalOrder(pose)
  const personHeight = order ? Math.max(0.001, order.knees - order.shoulders) : null
  const confidence = evidenceConfidence(pose, [torso, knees, hips, shoulders])
  if (confidence < config.minConfidence) return { ...base, confidence, reasons: ['low-measurement-confidence'] }

  const candidates = []
  const add = (state, score, reasons) => { if (score > 0) candidates.push({ state, score: clamp01(score), reasons }) }
  const torsoAbs = available(torso) ? Math.abs(torso.value) : null
  const armsRaised = [[15, 11], [16, 12]].some(([wristIndex, shoulderIndex]) => {
    const wrist = joint(pose, wristIndex), shoulder = joint(pose, shoulderIndex)
    return reliable(wrist) && reliable(shoulder) && wrist.y < shoulder.y - config.armRaisedHeightOffset
  })

  if (torsoAbs !== null && torsoAbs <= config.uprightTorsoDegrees && knees && knees.value >= config.standingKneeDegrees) {
    if (armsRaised) add('SALAM', Math.min(0.94, confidence * 0.92), ['upright-torso', 'raised-arm-geometry'])
    else if (previousPose?.state === 'RUKU') add('ITIDAL', confidence * 0.9, ['upright-after-stable-ruku'])
    else add('QIYAM', confidence * 0.9, ['upright-torso', 'extended-knees'])
  }

  if (torsoAbs !== null && torsoAbs >= config.bowTorsoDegrees && knees && knees.value >= config.standingKneeDegrees &&
      order && personHeight && (order.hips - order.shoulders) / personHeight >= config.bowVerticalRatio) {
    add('RUKU', confidence * 0.88, ['inclined-torso', 'extended-knees'])
  }

  const lowTorso = torsoAbs !== null && torsoAbs >= config.prostrationTorsoDegrees
  const shoulderHipLevel = order && personHeight && Math.abs(order.shoulders - order.hips) / personHeight <= config.prostrateAlignmentRatio
  if (lowTorso && shoulderHipLevel && knees && knees.value >= config.standingKneeDegrees) {
    const state = previousPose?.state === 'JALSA' || previousPose?.state === 'SECOND_SUJUD' ? 'SECOND_SUJUD' : 'SUJUD'
    add(state, confidence * 0.84, ['low-torso-inclination', 'shoulders-near-hip-height', 'extended-knees'])
  }

  // Sitting requires bent knees and hips visibly lower than shoulders. These
  // visible cues cannot reliably tell tashahhud from jalsa without context.
  const seatedOrder = order && personHeight && (order.hips - order.shoulders) / personHeight >= config.seatedTorsoRatio && order.knees >= order.hips - personHeight * 0.1
  if (seatedOrder && knees && knees.value <= config.seatedKneeDegrees) {
    const state = previousPose?.state === 'JALSA' || previousPose?.state === 'SECOND_SUJUD' || previousPose?.state === 'SUJUD'
      ? 'JALSA' : previousPose?.state === 'TASHAHHUD' ? 'TASHAHHUD' : null
    if (state) add(state, confidence * 0.78, ['bent-knees', 'seated-vertical-order', 'short-term-posture-context'])
  }

  const angleKeys = ['leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftShoulder', 'rightShoulder']
  const angleValues = angleKeys.map((key) => measure(pose, key)).filter(available)
  const priorAngles = previousPose?.angles
  if (priorAngles && angleValues.length >= 2) {
    const current = angleValues.map((item) => item.value)
    const deltas = angleKeys.map((key) => {
      const currentValue = measure(pose, key)
      return available(currentValue) && finite(priorAngles[key]) ? Math.abs(currentValue.value - priorAngles[key]) : null
    }).filter(finite)
    if (deltas.length >= 2 && deltas.filter((delta) => delta >= config.transitionAngleDeltaDegrees).length >= 2) {
      add('TRANSITIONING', Math.min(0.82, confidence * 0.76), ['large-short-term-joint-angle-change'])
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  if (!candidates.length) return { ...base, confidence, reasons: ['no-rule-matched'] }
  if (candidates.length > 1 && candidates[0].score - candidates[1].score < config.candidateMargin) {
    return { ...base, confidence, status: 'ambiguous', candidates: candidates.slice(0, 3), reasons: ['overlapping-geometric-rules'] }
  }
  const best = candidates[0]
  return { state: best.state, confidence: best.score, postureConfidence: best.score, status: 'candidate', candidates: candidates.slice(0, 3), reasons: best.reasons }
}

/** Stateful hysteresis wrapper; tracking interruptions clear all posture history. */
export function createPrayerPoseRecognizer({ thresholds = {}, stableFrames, smoothingHistoryMs } = {}) {
  const config = { ...DEFAULT_POSE_THRESHOLDS, ...thresholds }
  if (stableFrames !== undefined) config.stableFrames = stableFrames
  if (smoothingHistoryMs !== undefined) config.historyFrames = smoothingHistoryMs
  if (!Number.isInteger(config.stableFrames) || config.stableFrames < 1) throw new RangeError('stableFrames must be a positive integer')
  let committed = null
  let pendingState = null
  let pendingCount = 0
  let previous = null
  let lastTimestamp = null

  const reset = () => { committed = null; pendingState = null; pendingCount = 0; previous = null; lastTimestamp = null }
  return {
    reset,
    process(pose) {
      const timestamp = finite(pose?.timestamp) ? pose.timestamp : null
      if (['no-pose', 'tracking-lost', 'multiple', 'unknown', 'invalid'].includes(pose?.trackingStatus) ||
          (lastTimestamp !== null && timestamp !== null && (timestamp <= lastTimestamp || timestamp - lastTimestamp > config.historyFrames))) {
        reset()
        return { state: 'UNKNOWN', confidence: 0, status: 'tracking-unavailable', stable: false, candidate: 'UNKNOWN', reasons: ['tracking-history-reset'] }
      }
      const angles = Object.fromEntries(['leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftShoulder', 'rightShoulder']
        .map((key) => [key, available(measure(pose, key)) ? measure(pose, key).value : null]))
      const instant = classifyPrayerPose(pose, { thresholds: config, previousPose: { ...previous, state: committed || null } })
      if (timestamp !== null) lastTimestamp = timestamp
      previous = { state: committed || null, angles }

      if (instant.state === 'UNKNOWN') {
        pendingState = null; pendingCount = 0
        return { ...instant, state: committed || 'UNKNOWN', candidate: 'UNKNOWN', stable: false, committed: Boolean(committed) }
      }
      if (instant.state === pendingState) pendingCount += 1
      else { pendingState = instant.state; pendingCount = 1 }
      if (pendingCount >= config.stableFrames) committed = pendingState
      previous.state = committed
      return {
        ...instant, candidate: instant.state, state: committed || 'UNKNOWN',
        stable: committed === instant.state, committed: Boolean(committed), pendingFrames: pendingCount,
      }
    },
  }
}
