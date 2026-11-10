const finite = (value) => typeof value === 'number' && Number.isFinite(value)

/** In-memory, bounded recorder for privacy-safe pose recognition summaries. */
export function createPoseRecognitionHistory({
  limit = 30,
  sampleIntervalMs = 1000,
  changeIntervalMs = 300,
  confidenceDelta = 0.1,
  now = Date.now,
} = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be a positive integer')
  let entries = []
  let lastSampleAt = null
  let lastSignature = null
  let lastConfidence = null

  const getEntries = () => entries
  const clear = () => {
    entries = []
    lastSampleAt = null
    lastSignature = null
    lastConfidence = null
  }

  return {
    getEntries,
    clear,
    record(recognition, quality = {}) {
      const at = now()
      const state = typeof recognition?.state === 'string' ? recognition.state : 'UNKNOWN'
      const candidate = typeof recognition?.candidate === 'string' ? recognition.candidate : state
      const status = typeof recognition?.status === 'string' ? recognition.status : 'unknown'
      const confidence = finite(recognition?.confidence) ? Math.max(0, Math.min(1, recognition.confidence)) : 0
      const trackingStatus = quality.trackingStatus || 'unknown'
      const evidence = Array.isArray(recognition?.reasons) ? recognition.reasons.filter((item) => typeof item === 'string') : []
      const signature = JSON.stringify([state, candidate, status, Boolean(recognition?.stable), trackingStatus])
      const changed = signature !== lastSignature || (lastConfidence !== null && Math.abs(confidence - lastConfidence) >= confidenceDelta)
      const elapsed = lastSampleAt === null ? Infinity : at - lastSampleAt
      const meaningfulChange = changed && elapsed >= changeIntervalMs
      if (lastSampleAt !== null && !meaningfulChange && elapsed < sampleIntervalMs) return null

      const entry = {
        timestamp: new Date(at).toISOString(),
        pose: state,
        candidate,
        candidatePose: recognition?.candidatePose || recognition?.candidate || candidate,
        confirmedPose: recognition?.confirmedPose || (recognition?.stable ? state : 'UNKNOWN'),
        confidence,
        decisionConfidence: finite(recognition?.decisionConfidence) ? recognition.decisionConfidence : null,
        status,
        stable: Boolean(recognition?.stable),
        pendingFrames: finite(recognition?.pendingFrames) ? recognition.pendingFrames : null,
        stableFramesRequired: finite(recognition?.stableFramesRequired) ? recognition.stableFramesRequired : null,
        evidence,
        recognitionReason: recognition?.diagnosticReason || evidence.join(', ') || status,
        rejectionReasons: Array.isArray(recognition?.rejectionReasons) ? recognition.rejectionReasons.filter((item) => typeof item === 'string') : [],
        measurements: recognition?.measurements || null,
        confidenceBreakdown: recognition?.confidenceBreakdown || null,
        criticalLandmarks: Array.isArray(recognition?.criticalLandmarks) ? recognition.criticalLandmarks : [],
        trackingStatus,
        landmarkCount: finite(recognition?.landmarkCount) ? recognition.landmarkCount : finite(quality.landmarkCount) ? quality.landmarkCount : null,
        validLandmarkCount: finite(recognition?.validLandmarkCount) ? recognition.validLandmarkCount : finite(quality.validLandmarkCount) ? quality.validLandmarkCount : null,
        trackingConfidence: finite(quality.confidence) ? Math.max(0, Math.min(1, quality.confidence)) : null,
        timeSincePreviousMs: finite(recognition?.timeSincePreviousMs) ? recognition.timeSincePreviousMs : null,
        sequence: quality.sequence && typeof quality.sequence === 'object' ? {
          sequenceState: quality.sequence.sequenceState || 'not-started',
          previousConfirmedPose: quality.sequence.previousConfirmedPose || null,
          lastConfirmedPose: quality.sequence.lastConfirmedPose || null,
          expectedNextPoses: Array.isArray(quality.sequence.expectedNextPoses) ? [...quality.sequence.expectedNextPoses] : [],
          transitionValidationResult: quality.sequence.transitionValidationResult || 'unknown',
          rejectionReason: quality.sequence.rejectionReason || null,
          trackingStatus: quality.sequence.trackingStatus || trackingStatus,
          eventType: quality.sequence.eventType || 'unknown',
          completedMovements: Array.isArray(quality.sequence.completedMovements) ? [...quality.sequence.completedMovements] : [],
        } : null,
      }
      entries = [entry, ...entries].slice(0, limit)
      lastSampleAt = at
      lastSignature = signature
      lastConfidence = confidence
      return entry
    },
  }
}
