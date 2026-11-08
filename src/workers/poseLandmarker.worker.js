import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

let landmarker
let frameCount = 0

function emit(stage, message, details = {}) {
  self.postMessage({ type: 'diagnostic', stage, message, details })
}

function describeError(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error || 'Unknown error')
}

async function requireHttp200(url, label, method = 'HEAD') {
  emit('asset-check', `Checking ${label} response`, { url, method })
  const response = await fetch(url, { method, cache: 'no-store' })
  emit('asset-check', `${label} HTTP ${response.status}`, { url, status: response.status, ok: response.ok })
  if (!response.ok) throw Object.assign(new Error(`${label} request returned HTTP ${response.status} (${url})`), { stage: 'asset-check' })
  return response
}

async function initialize({ wasmPath, modelPath }) {
  emit('initialization', 'Loading MediaPipe WASM fileset', { wasmPath })
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
  emit('wasm', 'MediaPipe WASM fileset resolved', { wasmLoaderPath: files.wasmLoaderPath, wasmBinaryPath: files.wasmBinaryPath })

  emit('model', 'Loading pose_landmarker_lite.task')
  const modelResponse = await requireHttp200(modelPath, 'Pose Landmarker model', 'GET')
  const modelAssetBuffer = new Uint8Array(await modelResponse.arrayBuffer())
  emit('model', 'Pose model bytes loaded', { byteLength: modelAssetBuffer.byteLength })

  const commonOptions = {
    runningMode: 'VIDEO',
    numPoses: 2,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
    outputPoseSegmentationMasks: false,
  }
  emit('delegate', 'Attempting GPU delegate')
  let gpuFailure = 'GPU initialization was not attempted'
  try {
    landmarker = await PoseLandmarker.createFromOptions(files, {
      ...commonOptions,
      baseOptions: { modelAssetBuffer: new Uint8Array(modelAssetBuffer), delegate: 'GPU' },
    })
    emit('delegate', 'GPU delegate initialized')
    self.postMessage({ type: 'ready', delegate: 'GPU' })
    return
  } catch (gpuError) {
    gpuFailure = describeError(gpuError)
    emit('delegate', 'GPU initialization failed; trying CPU fallback', { error: gpuFailure })
  }

  emit('delegate', 'Attempting CPU fallback')
  try {
    // Recreate the WASM fileset after a failed GPU graph initialization so the
    // CPU fallback gets a clean task runtime in browsers with partial GPU setup.
    const cpuFiles = await FilesetResolver.forVisionTasks(wasmPath, true)
    emit('wasm', 'CPU fallback fileset resolved', { wasmLoaderPath: cpuFiles.wasmLoaderPath, wasmBinaryPath: cpuFiles.wasmBinaryPath })
    landmarker = await PoseLandmarker.createFromOptions(cpuFiles, {
      ...commonOptions,
      baseOptions: { modelAssetBuffer: new Uint8Array(modelAssetBuffer), delegate: 'CPU' },
    })
    emit('delegate', 'CPU fallback initialized')
    self.postMessage({ type: 'ready', delegate: 'CPU' })
  } catch (cpuError) {
    const message = `GPU failed: ${gpuFailure}; CPU failed: ${describeError(cpuError)}`
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
    emit('inference', 'Calling PoseLandmarker.detectForVideo', { id, timestampMs: timestamp })
    const result = landmarker.detectForVideo(bitmap, timestamp)
    const poses = (result.landmarks || []).map((landmarks) => landmarks.map((point) => ({
      x: point.x, y: point.y, z: point.z,
      visibility: point.visibility ?? point.presence ?? 0,
      presence: point.presence ?? point.visibility ?? 0,
    })))
    const visibleCounts = poses.map((pose) => pose.filter((point) => point.visibility >= 0.4).length)
    const durationMs = Math.round((performance.now() - startedAt) * 10) / 10
    emit('inference', 'detectForVideo completed', {
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
    emit('worker', 'Initialization message received')
    initialize(data).catch((error) => {
      self.postMessage({ type: 'error', stage: error.stage || 'model-initialization', message: describeError(error) })
    })
    return
  }
  if (data.type === 'frame') detectFrame(data)
}
