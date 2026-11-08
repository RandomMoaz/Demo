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
    if (!p || !q || (p.visibility ?? 0) < threshold || (q.visibility ?? 0) < threshold) continue
    ctx.beginPath(); ctx.moveTo(p.x * width, p.y * height); ctx.lineTo(q.x * width, q.y * height); ctx.stroke()
  }
  for (const point of landmarks) {
    if (!point || (point.visibility ?? 0) < threshold) continue
    ctx.beginPath(); ctx.arc(point.x * width, point.y * height, Math.max(2.5, width / 160), 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

/** Sends local camera frames to a MediaPipe worker. No frame leaves this device. */
export function createPoseTracker(video, { onStatus = () => {}, onResult = () => {}, workerFactory, bitmapFactory } = {}) {
  let worker
  let stopped = false
  let ready = false
  let inFlight = false
  let frameHandle
  let useVideoFrameCallback = typeof video?.requestVideoFrameCallback === 'function'
  let lastSentAt = 0
  let frameId = 0
  let fallbackRaf

  const base = new URL(import.meta.env.BASE_URL || '/', globalThis.document?.baseURI || 'http://localhost/')
  const makeWorker = workerFactory || (() => new Worker(new URL('../workers/poseLandmarker.worker.js', import.meta.url), { type: 'module' }))
  const makeBitmap = bitmapFactory || ((source) => createImageBitmap(source))
  const schedule = () => {
    if (stopped || !ready) return
    if (useVideoFrameCallback) frameHandle = video.requestVideoFrameCallback(onFrame)
    else fallbackRaf = requestAnimationFrame((time) => onFrame(time, { mediaTime: time / 1000 }))
  }
  const onFrame = async (now, metadata = {}) => {
    if (stopped) return
    schedule()
    if (!ready || inFlight || video.readyState < 2 || now - lastSentAt < 110) return
    lastSentAt = now
    inFlight = true
    let bitmap
    try {
      bitmap = await makeBitmap(video)
      if (stopped) { bitmap.close?.(); return }
      worker.postMessage({ type: 'frame', id: ++frameId, timestamp: Math.max(0, (metadata.mediaTime || now / 1000) * 1000), bitmap }, [bitmap])
    } catch {
      bitmap?.close?.()
      inFlight = false
      if (!stopped) onStatus('error')
    }
  }

  try {
    worker = makeWorker()
    worker.onmessage = ({ data }) => {
      if (stopped) return
      if (data.type === 'ready') { ready = true; onStatus('searching'); schedule() }
      if (data.type === 'error') onStatus('error')
      if (data.type === 'result' || data.type === 'frame-error') {
        inFlight = false
        if (data.type === 'frame-error') { onStatus('error'); return }
        onResult(data)
      }
    }
    worker.onerror = () => { if (!stopped) onStatus('error') }
    worker.postMessage({ type: 'init', wasmPath: new URL('mediapipe/wasm/', base).href, modelPath: new URL('models/pose_landmarker_lite.task', base).href })
    onStatus('loading')
  } catch {
    onStatus('error')
  }

  return {
    stop() {
      if (stopped) return
      stopped = true
      if (useVideoFrameCallback && frameHandle != null) video.cancelVideoFrameCallback?.(frameHandle)
      if (fallbackRaf != null) cancelAnimationFrame(fallbackRaf)
      worker?.terminate()
    },
  }
}
