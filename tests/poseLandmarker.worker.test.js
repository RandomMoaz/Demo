import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createFromOptions, forVisionTasks } = vi.hoisted(() => ({
  createFromOptions: vi.fn(),
  forVisionTasks: vi.fn(),
}))

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks },
  PoseLandmarker: { createFromOptions },
}))

async function loadWorker() {
  vi.resetModules()
  await import('../src/workers/poseLandmarker.worker.js')
  return globalThis.self
}

const okResponse = (body = null) => new Response(body, { status: 200 })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('self', { postMessage: vi.fn(), onmessage: null })
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => options.method === 'HEAD' ? okResponse() : okResponse(new Uint8Array([1, 2, 3]))))
  forVisionTasks.mockResolvedValue({ wasmLoaderPath: '/wasm/vision_wasm_module_internal.js', wasmBinaryPath: '/wasm/vision_wasm_module_internal.wasm' })
})

describe('MediaPipe pose worker pipeline', () => {
  it('checks local WASM/model HTTP status and falls back from GPU to CPU with diagnostic details', async () => {
    const landmarker = { detectForVideo: vi.fn(), close: vi.fn() }
    createFromOptions.mockRejectedValueOnce(new Error('WebGL context unavailable')).mockResolvedValueOnce(landmarker)
    const worker = await loadWorker()
    worker.onmessage({ data: { type: 'init', wasmPath: 'http://localhost/mediapipe/wasm/', modelPath: 'http://localhost/models/pose_landmarker_lite.task' } })

    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready', delegate: 'CPU' })))
    expect(fetch).toHaveBeenCalledWith('http://localhost/mediapipe/wasm/vision_wasm_module_internal.js', { method: 'HEAD', cache: 'no-store' })
    expect(fetch).toHaveBeenCalledWith('http://localhost/mediapipe/wasm/vision_wasm_module_internal.wasm', { method: 'HEAD', cache: 'no-store' })
    expect(fetch).toHaveBeenCalledWith('http://localhost/models/pose_landmarker_lite.task', { method: 'GET', cache: 'no-store' })
    expect(createFromOptions.mock.calls[0][1].baseOptions.delegate).toBe('GPU')
    expect(createFromOptions.mock.calls[1][1].baseOptions.delegate).toBe('CPU')
    expect(forVisionTasks).toHaveBeenCalledTimes(2)
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'diagnostic', stage: 'gpu-failure', message: 'GPU initialization failed; trying CPU fallback',
      details: expect.objectContaining({ error: 'Error: WebGL context unavailable' }),
    }))
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'diagnostic', message: 'Pose Landmarker model HTTP 200' }))
  })

  it('returns actual MediaPipe landmarks after receiving a transferable frame', async () => {
    const landmarks = Array.from({ length: 33 }, (_, index) => ({ x: index / 33, y: 0.5, z: 0, visibility: 0.9 }))
    const landmarker = { detectForVideo: vi.fn(() => ({ landmarks: [landmarks] })) }
    createFromOptions.mockResolvedValue(landmarker)
    const worker = await loadWorker()
    worker.onmessage({ data: { type: 'init', wasmPath: 'http://localhost/mediapipe/wasm/', modelPath: 'http://localhost/models/pose_landmarker_lite.task' } })
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready', delegate: 'GPU' })))

    const bitmap = { width: 640, height: 480, close: vi.fn() }
    worker.onmessage({ data: { type: 'frame', id: 7, timestamp: 1234, bitmap } })
    expect(landmarker.detectForVideo).toHaveBeenCalledWith(bitmap, 1234)
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'result', id: 7, timestamp: 1234, width: 640, height: 480, poses: [expect.arrayContaining([expect.objectContaining({ x: 0, visibility: 0.9 })])],
    }))
    expect(worker.postMessage.mock.calls.find(([message]) => message.type === 'result')[0].poses[0]).toHaveLength(33)
    expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it('skips GPU initialization for a recovered CPU-only worker', async () => {
    createFromOptions.mockResolvedValue({ detectForVideo: vi.fn(), close: vi.fn() })
    const worker = await loadWorker()
    worker.onmessage({ data: { type: 'init', delegate: 'CPU', wasmPath: 'http://localhost/mediapipe/wasm/', modelPath: 'http://localhost/models/pose_landmarker_lite.task' } })
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready', delegate: 'CPU' })))
    expect(createFromOptions).toHaveBeenCalledOnce()
    expect(createFromOptions.mock.calls[0][1].baseOptions.delegate).toBe('CPU')
  })

  it('reports inference failure and always releases the transferred bitmap', async () => {
    const landmarker = { detectForVideo: vi.fn(() => { throw new Error('WASM inference failed') }), close: vi.fn() }
    createFromOptions.mockResolvedValue(landmarker)
    const worker = await loadWorker()
    worker.onmessage({ data: { type: 'init', wasmPath: 'http://localhost/mediapipe/wasm/', modelPath: 'http://localhost/models/pose_landmarker_lite.task' } })
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready' })))
    const bitmap = { width: 640, height: 480, close: vi.fn() }
    worker.onmessage({ data: { type: 'frame', id: 8, timestamp: 1450, bitmap } })
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'frame-error', id: 8, message: 'Error: WASM inference failed' })
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'diagnostic', stage: 'frame-received', details: expect.objectContaining({ id: 8 }) }))
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'diagnostic', stage: 'inference-start', details: expect.objectContaining({ id: 8 }) }))
  })

  it('reports a missing local model with its actual HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (options.method === 'HEAD') return okResponse()
      return new Response('missing', { status: 404 })
    }))
    const worker = await loadWorker()
    worker.onmessage({ data: { type: 'init', wasmPath: 'http://localhost/mediapipe/wasm/', modelPath: 'http://localhost/models/pose_landmarker_lite.task' } })
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error', stage: 'asset-check', message: expect.stringContaining('HTTP 404'),
    })))
    expect(createFromOptions).not.toHaveBeenCalled()
  })

  it('reports both delegate failures without losing the original GPU exception', async () => {
    createFromOptions.mockRejectedValueOnce(new Error('GPU delegate unavailable')).mockRejectedValueOnce(new Error('CPU kernel rejected model'))
    const worker = await loadWorker()
    worker.onmessage({ data: { type: 'init', wasmPath: 'http://localhost/mediapipe/wasm/', modelPath: 'http://localhost/models/pose_landmarker_lite.task' } })
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'error', stage: 'delegate-initialization',
      message: 'GPU failed: Error: GPU delegate unavailable; CPU failed: Error: CPU kernel rejected model',
    })))
  })
})
