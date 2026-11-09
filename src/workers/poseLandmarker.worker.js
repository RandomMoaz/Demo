import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

let landmarker
let frameCount = 0
const workerStartedAt = performance.now()

function emit(stage, message, details = {}) {
  self.postMessage({ type: 'diagnostic', stage, message, details, at: Math.round(performance.now() - workerStartedAt) })
}

function describeError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error || 'Unknown error')
}

async function requireHttp200(url, label, method = 'HEAD') {
  const startedAt = performance.now()
  emit('asset-request', `Requesting ${label}`, { url, method })
  const response = await fetch(url, { method, cache: 'no-store' })
  emit('asset-response', `${label} HTTP ${response.status}`, { url, status: response.status, ok: response.ok, durationMs: Math.round(performance.now() - startedAt) })
  if (!response.ok) throw Object.assign(new Error(`${label} request returned HTTP ${response.status} (${url})`), { stage: 'asset-check' })
  return response
}

async function initialize({ wasmPath, modelPath, delegate: requestedDelegate = 'AUTO' }) {
  const initializationStartedAt = performance.now()
  emit('wasm-loading', 'Loading MediaPipe WASM fileset', { wasmPath })
  const wasmLoader = new URL('vision_wasm_module_internal.js', wasmPath).href
  const wasmBinary = new URL('vision_wasm_module_internal.wasm', wasmPath).href
  await Promise.all([
    requireHttp200(wasmLoader, 'MediaPipe WASM loader'),
    requireHttp200(wasmBinary, 'MediaPipe WASM binary'),
  ])

  let files
  try {
    files = await FilesetResolver.forVisionTasks(wasmPath, true)
  } catch (error) {
    throw Object.assign(new Error(`MediaPipe WASM initialization failed: ${describeError(error)}`), { stage: 'wasm-initialization' })
  }
  emit('wasm-ready', 'MediaPipe WASM fileset resolved', { wasmLoaderPath: files.wasmLoaderPath, wasmBinaryPath: files.wasmBinaryPath, durationMs: Math.round(performance.now() - initializationStartedAt) })

  emit('model', 'Loading pose_landmarker_lite.task')
  const modelResponse = await requireHttp200(modelPath, 'Pose Landmarker model', 'GET')
  const modelAssetBuffer = new Uint8Array(await modelResponse.arrayBuffer())
  emit('model-ready', 'Pose model bytes loaded', { byteLength: modelAssetBuffer.byteLength, durationMs: Math.round(performance.now() - initializationStartedAt) })

  const commonOptions = {
    runningMode: 'VIDEO',
    numPoses: 2,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
    outputPoseSegmentationMasks: false,
  }
  emit('gpu-initialization', 'Attempting GPU delegate initialization')
  let gpuFailure = 'GPU initialization was not attempted'
  try {
    if (requestedDelegate === 'CPU') throw Object.assign(new Error('CPU delegate selected by recovery policy'), { skipGpu: true })
    landmarker = await PoseLandmarker.createFromOptions(files, {
      ...commonOptions,
      baseOptions: { modelAssetBuffer: new Uint8Array(modelAssetBuffer), delegate: 'GPU' },
    })
    emit('gpu-ready', 'GPU delegate initialized')
    self.postMessage({ type: 'ready', delegate: 'GPU', initializationDurationMs: Math.round(performance.now() - initializationStartedAt) })
    return
  } catch (gpuError) {
    if (gpuError.skipGpu) gpuFailure = 'GPU skipped by recovery policy'
    else gpuFailure = describeError(gpuError)
    if (!gpuError.skipGpu) emit('gpu-failure', 'GPU initialization failed; trying CPU fallback', { error: gpuFailure })
  }

  emit('cpu-initialization', 'Attempting CPU delegate initialization', { reason: gpuFailure })
  try {
    // Recreate the WASM fileset after a failed GPU graph initialization so the
    // CPU fallback gets a clean task runtime in browsers with partial GPU setup.
    const cpuFiles = await FilesetResolver.forVisionTasks(wasmPath, true)
    emit('cpu-wasm-ready', 'CPU fallback WASM fileset resolved', { wasmLoaderPath: cpuFiles.wasmLoaderPath, wasmBinaryPath: cpuFiles.wasmBinaryPath })
    landmarker = await PoseLandmarker.createFromOptions(cpuFiles, {
      ...commonOptions,
      baseOptions: { modelAssetBuffer: new Uint8Array(modelAssetBuffer), delegate: 'CPU' },
    })
    emit('cpu-ready', 'CPU fallback initialized')
    self.postMessage({ type: 'ready', delegate: 'CPU', initializationDurationMs: Math.round(performance.now() - initializationStartedAt) })
  } catch (cpuError) {
    const message = `GPU failed: ${gpuFailure}; CPU failed: ${describeError(cpuError)}`
    try { landmarker?.close?.() } catch { /* no live task to close */ }
    landmarker = undefined
    self.postMessage({ type: 'error', stage: 'delegate-initialization', message })
  }
}

function detectFrame({ bitmap, id, timestamp }) {
  const startedAt = performance.now()
  frameCount++
  emit('frame-received', 'Pose worker received transferred camera frame', {
    id, timestampMs: timestamp, width: bitmap.width, height: bitmap.height, frameCount,
  })
  try {
    if (!landmarker) throw new Error('Pose Landmarker is not initialized')
    emit('inference-start', 'Calling PoseLandmarker.detectForVideo', { id, timestampMs: timestamp })
    const result = landmarker.detectForVideo(bitmap, timestamp)
    const poses = (result.landmarks || []).map((landmarks) => landmarks.map((point) => ({
      x: point.x, y: point.y, z: point.z,
      visibility: point.visibility ?? point.presence ?? 0,
      presence: point.presence ?? point.visibility ?? 0,
    })))
    const visibleCounts = poses.map((pose) => pose.filter((point) => point.visibility >= 0.4).length)
    const durationMs = Math.round((performance.now() - startedAt) * 10) / 10
    emit('inference-complete', 'detectForVideo completed', {
      id, durationMs, poseCount: poses.length, landmarkCounts: poses.map((pose) => pose.length), visibleCounts,
    })
    self.postMessage({ type: 'result', id, poses, width: bitmap.width, height: bitmap.height, durationMs })
  } catch (error) {
    const message = describeError(error)
    emit('inference-error', message, { id })
    self.postMessage({ type: 'frame-error', id, message })
  } finally {
    bitmap.close()
  }
}

self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    emit('init-received', 'Initialization message received', { requestedDelegate: data.delegate || 'AUTO' })
    initialize(data).catch((error) => {
      self.postMessage({ type: 'error', stage: error.stage || 'model-initialization', message: describeError(error) })
    })
    return
  }
  if (data.type === 'frame') detectFrame(data)
}
