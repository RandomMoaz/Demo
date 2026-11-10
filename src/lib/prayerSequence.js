/**
 * Phase 6 sequence state machine. It consumes Phase 5's confirmedPose only;
 * candidate poses and camera/landmark data never advance sequence progress.
 *
 * The default graph is the single-unit example used by the project roadmap.
 * Callers can provide a different transition graph and start states for a
 * teaching structure without changing the recognizer or asserting that this
 * example is universal.
 */
export const DEFAULT_PRAYER_TRANSITIONS = Object.freeze({
  QIYAM: Object.freeze(['RUKU']),
  RUKU: Object.freeze(['ITIDAL']),
  ITIDAL: Object.freeze(['SUJUD']),
  SUJUD: Object.freeze(['JALSA']),
  JALSA: Object.freeze(['SECOND_SUJUD']),
  // A basic unit can continue to another standing unit or move into the
  // configured ending stages. Prayer length is not inferred by this engine.
  SECOND_SUJUD: Object.freeze(['QIYAM', 'TASHAHHUD']),
  TASHAHHUD: Object.freeze(['SALAM']),
  SALAM: Object.freeze([]),
})

const KNOWN_POSES = new Set([
  'QIYAM', 'RUKU', 'ITIDAL', 'SUJUD', 'JALSA', 'SECOND_SUJUD', 'TASHAHHUD', 'SALAM',
])
const LOST_TRACKING = new Set(['no-pose', 'tracking-lost', 'multiple', 'unknown', 'invalid'])

function normalizedGraph(transitions) {
  const graph = {}
  for (const [from, next] of Object.entries(transitions || {})) {
    if (!KNOWN_POSES.has(from) || !Array.isArray(next)) continue
    graph[from] = [...new Set(next.filter((pose) => KNOWN_POSES.has(pose)))]
  }
  return graph
}

function findSkippedMovements(graph, currentPose, receivedPose) {
  const queue = (graph[currentPose] || []).map((pose) => ({ pose, skipped: [] }))
  const visited = new Set([currentPose])
  while (queue.length) {
    const current = queue.shift()
    if (current.pose === receivedPose) return current.skipped
    if (visited.has(current.pose)) continue
    visited.add(current.pose)
    for (const next of graph[current.pose] || []) {
      queue.push({ pose: next, skipped: [...current.skipped, current.pose] })
    }
  }
  return null
}

export function createPrayerSequenceRecognizer({
  transitions = DEFAULT_PRAYER_TRANSITIONS,
  startPoses = ['QIYAM'],
} = {}) {
  const graph = normalizedGraph(transitions)
  const allowedStarts = [...new Set(startPoses.filter((pose) => KNOWN_POSES.has(pose)))]
  let previousConfirmedPose = null
  let lastConfirmedPose = null
  let lastObservedConfirmedPose = null
  let completedMovements = []
  let transitionResult = 'not-started'
  let rejectionReason = null
  let trackingStatus = 'waiting'
  let wasTrackingLost = false
  let eventType = 'waiting'

  const snapshot = () => ({
    sequenceState: trackingStatus === 'tracking-lost' ? 'tracking-lost' : lastConfirmedPose || 'not-started',
    previousConfirmedPose,
    lastConfirmedPose,
    lastObservedConfirmedPose,
    expectedNextPoses: lastConfirmedPose ? [...(graph[lastConfirmedPose] || [])] : [...allowedStarts],
    transitionValidationResult: transitionResult,
    rejectionReason,
    trackingStatus,
    eventType,
    completedMovements: [...completedMovements],
  })

  const reset = () => {
    previousConfirmedPose = null
    lastConfirmedPose = null
    lastObservedConfirmedPose = null
    completedMovements = []
    transitionResult = 'not-started'
    rejectionReason = null
    trackingStatus = 'waiting'
    wasTrackingLost = false
    eventType = 'waiting'
    return snapshot()
  }

  return {
    reset,
    getState: snapshot,
    process(recognition) {
      const incomingTracking = recognition?.trackingStatus ||
        (recognition?.status === 'tracking-unavailable' ? 'tracking-lost' : 'tracking')
      const lost = recognition?.status === 'tracking-unavailable' || LOST_TRACKING.has(incomingTracking)
      if (lost) {
        trackingStatus = 'tracking-lost'
        eventType = wasTrackingLost ? 'tracking-lost' : 'tracking-lost'
        transitionResult = 'tracking-lost'
        rejectionReason = 'Tracking is unavailable; sequence position was retained.'
        wasTrackingLost = true
        return snapshot()
      }

      trackingStatus = incomingTracking
      const recovered = wasTrackingLost
      wasTrackingLost = false
      const confirmedPose = recognition?.confirmedPose
      if (!KNOWN_POSES.has(confirmedPose)) {
        eventType = recovered ? 'tracking-recovered' : 'unconfirmed-pose'
        transitionResult = 'awaiting-confirmation'
        rejectionReason = recovered
          ? 'Tracking recovered; waiting for a confirmed pose before validating a movement.'
          : recognition?.candidatePose && recognition.candidatePose !== 'UNKNOWN'
            ? `Candidate ${recognition.candidatePose} is not confirmed; sequence did not advance.`
            : 'No confirmed pose is available; sequence did not advance.'
        return snapshot()
      }

      const duplicateConfirmedEvent = confirmedPose === lastObservedConfirmedPose
      lastObservedConfirmedPose = confirmedPose
      if (duplicateConfirmedEvent) {
        eventType = recovered ? 'tracking-recovered' : 'repeated-pose'
        transitionResult = 'repeated-pose'
        rejectionReason = recovered ? null : `Repeated ${confirmedPose} confirmation was ignored.`
        return snapshot()
      }

      if (recovered) {
        // Mark recovery while still processing this confirmed pose below.
        eventType = 'tracking-recovered'
      }

      const expected = lastConfirmedPose ? graph[lastConfirmedPose] || [] : allowedStarts
      if (!expected.includes(confirmedPose)) {
        const skipped = lastConfirmedPose ? findSkippedMovements(graph, lastConfirmedPose, confirmedPose) : null
        if (skipped?.length) {
          eventType = recovered ? 'tracking-recovered-missing-movement' : 'missing-movement'
          transitionResult = 'missing-movement'
          rejectionReason = `Movement ${skipped.join(', ')} was not confirmed before ${confirmedPose}; sequence position was not advanced.`
        } else {
          eventType = recovered ? 'tracking-recovered-unexpected-transition' : 'unexpected-transition'
          transitionResult = 'unexpected-transition'
          rejectionReason = `Expected ${expected.length ? expected.join(' or ') : 'no further movement'} after ${lastConfirmedPose || 'sequence start'}, received ${confirmedPose}.`
        }
        return snapshot()
      }

      previousConfirmedPose = lastConfirmedPose
      lastConfirmedPose = confirmedPose
      completedMovements = [...completedMovements, confirmedPose]
      eventType = recovered ? 'tracking-recovered-and-accepted' : 'expected-transition'
      transitionResult = 'expected-transition'
      rejectionReason = null
      return snapshot()
    },
  }
}
