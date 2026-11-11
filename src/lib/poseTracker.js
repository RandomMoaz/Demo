export const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [11, 23],
  [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
]

export function summarizePoseResult(poses, threshold = 0.4) {
  if (!poses?.length) return { status: 'no-pose', confidence: 0, visible: 0, landmarks: null }
  if (poses.length > 1) return { status: 'multiple', confidence: 0, visible: 0, landmarks: null }
  const landmarks = poses[0]
  const scores = landmarks.map((point) => Number(point?.visibility ?? point?.presence ?? 0)).filter(Number.isFinite)
  const visible = landmarks.filter((point) => point && Number(point.visibility ?? point.presence ?? 0) >= threshold).length
  const confidence = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
  return { status: visible >= 27 ? 'tracking' : visible >= 8 ? 'partial' : 'no-pose', confidence, visible, landmarks }
}

export function drawPoseSkeleton(canvas, landmarks, { threshold = 0.35, mirrored = true } = {}) {
  const ctx = canvas?.getContext?.('2d')
  if (!ctx) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  if (!landmarks?.length || !width || !height) return
  ctx.save()
  if (mirrored) { ctx.translate(width, 0); ctx.scale(-1, 1) }
  ctx.lineWidth = Math.max(2, width / 240)
  ctx.strokeStyle = '#54d6ba'
  ctx.fillStyle = '#fff'
  for (const [a, b] of POSE_CONNECTIONS) {
    const p = landmarks[a], q = landmarks[b]
    if (!isDrawable(p, threshold) || !isDrawable(q, threshold)) continue
    ctx.beginPath(); ctx.moveTo(p.x * width, p.y * height); ctx.lineTo(q.x * width, q.y * height); ctx.stroke()
  }
  for (const point of landmarks) {
    if (!isDrawable(point, threshold)) continue
    ctx.beginPath(); ctx.arc(point.x * width, point.y * height, Math.max(2.5, width / 160), 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

function isDrawable(point, threshold) {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number(point.visibility ?? point.presence ?? 0) >= threshold)
}

function errorText(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error || 'Unknown error')
}

/** Sends local camera frames to a MediaPipe worker. No frame leaves this device. */
export function createPoseTracker(video, { onStatus = () => {}, onResult = () => {}, onDiagnostic = () => {}, workerFactory, bitmapFactory, initTimeoutMs = 30000, frameTimeoutMs = 10000 } = {}) {
  let worker
  let stopped = false
  let failed = false
  let ready = false
  let inFlight = false
  let recoveryUsed = false
  let workerEpoch = 0
  let frameHandle
  let fallbackRaf
  let lastSentAt = 0
  let lastTimestamp = 0
  let frameId = 0
  let frameCount = 0
  let responseTimer
  let initTimer
  let workerStartedAt = 0
  let inferenceStartedAt = 0
  const useVideoFrameCallback = typeof video?.requestVideoFrameCallback === 'function'
  const base = new URL(import.meta.env.BASE_URL || '/', globalThis.document?.baseURI || 'http://localhost/')
  const makeWorker = workerFactory || (() => new Worker(new URL('../workers/poseLandmarker.worker.js', import.meta.url), { type: 'module' }))
  const makeBitmap = bitmapFactory || ((source) => createImageBitmap(source))

  const diagnostic = (stage, message, details = {}) => {
    if (stopped) return
    onDiagnostic({ stage, message, details, at: new Date().toISOString() })
  }
  const publish = (state, detail = '') => {
    if (!stopped) onStatus(state, detail)
  }
  const cancelScheduledFrame = () => {
    if (useVideoFrameCallback && frameHandle != null) video.cancelVideoFrameCallback?.(frameHandle)
    if (!useVideoFrameCallback && fallbackRaf != null) cancelAnimationFrame(fallbackRaf)
    frameHandle = null
    fallbackRaf = null
  }
  const fail = (stage, error) => {
    if (stopped || failed) return
    failed = true
    ready = false
    inFlight = false
    clearTimeout(responseTimer)
    clearTimeout(initTimer)
    cancelScheduledFrame()
    const message = errorText(error)
    diagnostic(stage, message, { fatal: true })
    publish('error', `${stage}: ${message}`)
    worker?.terminate()
    diagnostic('worker', 'Worker terminated after an unrecoverable error')
  }
  const schedule = () => {
    if (stopped || failed || !ready) return
    if (useVideoFrameCallback) frameHandle = video.requestVideoFrameCallback(onFrame)
    else fallbackRaf = requestAnimationFrame((time) => onFrame(time))
  }
  const onFrame = async (now) => {
    if (stopped || failed) return
    schedule()
    frameCount++
    if (!ready || inFlight) return
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      if (frameCount === 1 || frameCount % 30 === 0) {
        diagnostic('video-frame', 'Waiting for decoded video dimensions/frame', {
          readyState: video?.readyState, videoWidth: video?.videoWidth, videoHeight: video?.videoHeight,
        })
      }
      publish('initializing', 'Waiting for a decoded camera frame')
      return
    }
    if (now - lastSentAt < 110) return
    lastSentAt = now
    inFlight = true
    const id = ++frameId
    let bitmap
    try {
      bitmap = await makeBitmap(video)
      if (stopped || failed) { bitmap?.close?.(); return }
      const timestamp = Math.max(now, lastTimestamp + 1)
      lastTimestamp = timestamp
      diagnostic('frame-transfer', 'Camera frame transferred to pose worker', {
        id, timestampMs: timestamp, bitmapWidth: bitmap.width, bitmapHeight: bitmap.height,
        readyState: video.readyState, videoWidth: video.videoWidth, videoHeight: video.videoHeight,
      })
      inferenceStartedAt = performance.now()
      responseTimer = setTimeout(() => {
        const elapsedMs = Math.round(performance.now() - inferenceStartedAt)
        const stage = lastWorkerStage === 'inference-start' ? 'detectForVideo-timeout' : 'worker-frame-timeout'
        const error = new Error(`Frame ${id} timed out after ${elapsedMs}ms; last worker stage: ${lastWorkerStage || 'no worker acknowledgement'}`)
        if (!recoveryUsed) {
          recoveryUsed = true
          diagnostic(stage, error.message, { id, elapsedMs, recovery: 'restarting worker with CPU delegate' })
          restartWorker('CPU', stage)
        } else {
          fail(stage, error)
        }
      }, frameTimeoutMs)
      worker.postMessage({ type: 'frame', id, timestamp, bitmap }, [bitmap])
      diagnostic('frame-transfer', 'Frame posted to worker; waiting for worker receipt and inference result', { id, timeoutMs: frameTimeoutMs })
    } catch (error) {
      bitmap?.close?.()
      fail('frame-transfer', error)
    }
  }

  let lastWorkerStage = ''
  publish('initializing')
  diagnostic('video', 'Pose tracker attached to camera video element', {
    readyState: video?.readyState, videoWidth: video?.videoWidth, videoHeight: video?.videoHeight,
    requestVideoFrameCallback: useVideoFrameCallback, devicePixelRatio: globalThis.devicePixelRatio || 1,
  })
  const restartWorker = (delegate, reason = 'initialization') => {
    if (stopped || failed) return
    clearTimeout(responseTimer)
    clearTimeout(initTimer)
    cancelScheduledFrame()
    ready = false
    inFlight = false
    const oldWorker = worker
    worker = null
    oldWorker?.terminate()
    const epoch = ++workerEpoch
    lastWorkerStage = ''
    try {
      worker = makeWorker()
      const activeWorker = worker
      workerStartedAt = performance.now()
      diagnostic('worker-start', 'Worker instance created', { epoch, delegate, reason, atMs: Math.round(workerStartedAt) })
      initTimer = setTimeout(() => {
        if (stopped || failed || epoch !== workerEpoch || ready) return
        const message = `Worker did not initialize within ${initTimeoutMs}ms (delegate: ${delegate})`
        if (delegate !== 'CPU' && !recoveryUsed) {
          recoveryUsed = true
          diagnostic('worker-init-timeout', message, { epoch, recovery: 'restarting worker with CPU delegate' })
          restartWorker('CPU', 'worker-init-timeout')
        } else fail('worker-init-timeout', new Error(message))
      }, initTimeoutMs)
      activeWorker.onmessage = ({ data }) => {
        if (stopped || epoch !== workerEpoch) return
        if (data.type === 'diagnostic') {
          if (data.stage) lastWorkerStage = data.stage
          diagnostic(data.stage, data.message, { ...data.details, workerEpoch: epoch, workerAt: data.at })
          return
        }
        if (data.type === 'ready') {
          clearTimeout(initTimer)
          ready = true
          lastWorkerStage = 'ready'
          diagnostic('worker-ready', 'Pose model ready; inference delegate selected', { delegate: data.delegate, epoch, initializationDurationMs: Math.round(performance.now() - workerStartedAt) })
          publish('waiting-person', `Ready (${data.delegate})`)
          schedule()
          return
        }
        if (data.type === 'error') {
          const stage = data.stage || 'model-initialization'
          if (delegate !== 'CPU' && !recoveryUsed) {
            recoveryUsed = true
            diagnostic(stage, data.message || 'Worker initialization failed', { epoch, recovery: 'restarting worker with CPU delegate' })
            restartWorker('CPU', stage)
          } else fail(stage, new Error(data.message || 'Worker reported an unspecified initialization error'))
          return
        }
        if (data.type === 'frame-error') {
          clearTimeout(responseTimer)
          inFlight = false
          lastWorkerStage = 'inference-error'
          diagnostic('inference-error', data.message || 'detectForVideo failed', { id: data.id, epoch, durationMs: Math.round(performance.now() - inferenceStartedAt) })
          if (!recoveryUsed) {
            recoveryUsed = true
            restartWorker('CPU', 'inference-error')
            return
          }
          fail('inference', new Error(data.message || 'detectForVideo failed'))
          return
        }
        if (data.type === 'result') {
          clearTimeout(responseTimer)
          inFlight = false
          lastWorkerStage = 'result'
          const counts = (data.poses || []).map((pose) => pose.filter((point) => (point.visibility ?? point.presence ?? 0) >= 0.4).length)
          diagnostic('landmarks-received', 'Landmark result received on main thread', {
            id: data.id, poseCount: data.poses?.length || 0, landmarkCounts: (data.poses || []).map((pose) => pose.length),
            visibleLandmarkCounts: counts, frameWidth: data.width, frameHeight: data.height,
            durationMs: data.durationMs ?? Math.round(performance.now() - inferenceStartedAt), epoch,
          })
          onResult(data)
        }
      }
      activeWorker.onerror = (event) => {
        if (stopped || epoch !== workerEpoch) return
        const error = new Error(event.message || `Worker error at ${event.filename || 'unknown file'}:${event.lineno || 0}`)
        if (delegate !== 'CPU' && !recoveryUsed) { recoveryUsed = true; restartWorker('CPU', 'worker-runtime'); return }
        fail('worker-runtime', error)
      }
      activeWorker.onmessageerror = () => {
        if (stopped || epoch !== workerEpoch) return
        if (delegate !== 'CPU' && !recoveryUsed) { recoveryUsed = true; restartWorker('CPU', 'worker-message'); return }
        fail('worker-message', new Error('Browser could not deserialize a worker message'))
      }
      publish('loading-model', delegate === 'CPU' ? 'Loading CPU fallback' : 'Loading model')
      diagnostic('worker-init', 'Sending MediaPipe initialization request', {
        wasmPath: new URL('mediapipe/wasm/', base).href,
        modelPath: new URL('models/pose_landmarker_lite.task', base).href, delegate,
      })
      activeWorker.postMessage({ type: 'init', wasmPath: new URL('mediapipe/wasm/', base).href, modelPath: new URL('models/pose_landmarker_lite.task', base).href, delegate })
    } catch (error) {
      if (delegate !== 'CPU' && !recoveryUsed) { recoveryUsed = true; diagnostic('worker-creation', errorText(error), { recovery: 'restarting worker with CPU delegate' }); restartWorker('CPU', 'worker-creation') }
      else fail('worker-creation', error)
    }
  }

  try {
    restartWorker('AUTO', 'initialization')
  } catch (error) {
    fail('worker-creation', error)
  }

  return {
    stop() {
      if (stopped) return
      diagnostic('lifecycle', 'Pose tracker stopped; in-flight worker will be terminated')
      stopped = true
      ready = false
      clearTimeout(responseTimer)
      clearTimeout(initTimer)
      cancelScheduledFrame()
      worker?.terminate()
    },
  }
}
