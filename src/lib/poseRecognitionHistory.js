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
        confidence,
        status,
        stable: Boolean(recognition?.stable),
        evidence,
        trackingStatus,
        landmarkCount: finite(quality.landmarkCount) ? quality.landmarkCount : null,
        validLandmarkCount: finite(quality.validLandmarkCount) ? quality.validLandmarkCount : null,
        trackingConfidence: finite(quality.confidence) ? Math.max(0, Math.min(1, quality.confidence)) : null,
      }
      entries = [entry, ...entries].slice(0, limit)
      lastSampleAt = at
      lastSignature = signature
      lastConfidence = confidence
      return entry
    },
  }
}
