import { describe, expect, it, vi } from 'vitest'
import { createPoseTracker, drawPoseSkeleton, summarizePoseResult } from '../src/lib/poseTracker.js'

const points = (visibility = 0.9) => Array.from({ length: 33 }, (_, index) => ({ x: index / 33, y: index / 33, z: 0, visibility, presence: visibility }))

describe('real pose result handling', () => {
  it('keeps empty and multi-person results unclassified', () => {
    expect(summarizePoseResult([])).toMatchObject({ status: 'no-pose', confidence: 0, landmarks: null })
    expect(summarizePoseResult([points(), points()])).toMatchObject({ status: 'multiple', landmarks: null })
  })

  it('reports complete, partial, and insufficient visibility with confidence', () => {
    expect(summarizePoseResult([points()])).toMatchObject({ status: 'tracking', visible: 33 }); expect(summarizePoseResult([points()]).confidence).toBeCloseTo(0.9)
    const partial = points(0.1); partial[0].visibility = 0.9; partial[1].visibility = 0.9; partial[2].visibility = 0.9; partial[3].visibility = 0.9; partial[4].visibility = 0.9; partial[5].visibility = 0.9; partial[6].visibility = 0.9; partial[7].visibility = 0.9; partial[8].visibility = 0.9
    expect(summarizePoseResult([partial])).toMatchObject({ status: 'partial', visible: 9 })
    expect(summarizePoseResult([points(0.1)])).toMatchObject({ status: 'no-pose', visible: 0 })
  })

  it('draws only sufficiently visible real landmarks and clears previous strokes', () => {
    const ctx = { clearRect: vi.fn(), save: vi.fn(), translate: vi.fn(), scale: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(), restore: vi.fn() }
    const canvas = { width: 640, height: 480, getContext: () => ctx }
    const pose = points()
    pose[0].visibility = 0.1
    drawPoseSkeleton(canvas, pose)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480)
    expect(ctx.stroke).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalledTimes(32)
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1)
  })
})

describe('pose tracker worker lifecycle', () => {
  it('loads the on-device model, transfers camera frames, reports results, and terminates on stop', async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null }
    let videoFrame
    const video = {
      readyState: 2,
      videoWidth: 640,
      videoHeight: 480,
      requestVideoFrameCallback: vi.fn((callback) => { videoFrame = callback; return 11 }),
      cancelVideoFrameCallback: vi.fn(),
    }
    const bitmap = { width: 640, height: 480, close: vi.fn() }
    const onResult = vi.fn(), onStatus = vi.fn()
    const tracker = createPoseTracker(video, {
      workerFactory: () => worker,
      bitmapFactory: vi.fn().mockResolvedValue(bitmap),
      onResult, onStatus,
    })
    expect(worker.postMessage.mock.calls[0][0]).toMatchObject({ type: 'init', modelPath: expect.stringContaining('pose_landmarker_lite.task'), wasmPath: expect.stringContaining('/mediapipe/wasm/') })
    worker.onmessage({ data: { type: 'ready' } })
    await videoFrame(200, { mediaTime: 0.2 })
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'frame', id: 1, timestamp: 200, bitmap }, [bitmap])
    worker.onmessage({ data: { type: 'result', id: 1, poses: [points()], width: 640, height: 480 } })
    expect(onResult).toHaveBeenCalledOnce()
    expect(onStatus).toHaveBeenCalledWith('initializing', '')
    expect(onStatus).toHaveBeenCalledWith('loading-model', 'Loading model')
    expect(onStatus).toHaveBeenCalledWith('waiting-person', 'Ready (undefined)')
    expect(onResult.mock.calls[0][0].poses[0]).toHaveLength(33)
    tracker.stop()
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(11)
    expect(worker.terminate).toHaveBeenCalledOnce()
    worker.onmessage({ data: { type: 'result', id: 2, poses: [], width: 640, height: 480 } })
    expect(onResult).toHaveBeenCalledOnce()
  })

  it('uses one monotonic clock for MediaPipe video timestamps', async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null }
    let videoFrame
    const video = { readyState: 2, videoWidth: 640, videoHeight: 480, requestVideoFrameCallback: (callback) => { videoFrame = callback; return 1 }, cancelVideoFrameCallback: vi.fn() }
    const bitmap = { width: 640, height: 480, close: vi.fn() }
    createPoseTracker(video, { workerFactory: () => worker, bitmapFactory: async () => bitmap })
    worker.onmessage({ data: { type: 'ready', delegate: 'CPU' } })
    await videoFrame(5000, { mediaTime: 0 })
    expect(worker.postMessage.mock.calls.at(-1)[0].timestamp).toBe(5000)
    worker.onmessage({ data: { type: 'result', id: 1, poses: [], width: 640, height: 480 } })
    await videoFrame(5110, { mediaTime: 0.11 })
    expect(worker.postMessage.mock.calls.at(-1)[0].timestamp).toBe(5110)
  })

  it('surfaces the exact worker/model error and terminates the failed worker', () => {
    const workers = []
    const makeWorker = () => { const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null }; workers.push(worker); return worker }
    const onStatus = vi.fn(), onDiagnostic = vi.fn()
    createPoseTracker({ requestVideoFrameCallback: vi.fn(), cancelVideoFrameCallback: vi.fn() }, { workerFactory: makeWorker, onStatus, onDiagnostic })
    workers[0].onmessage({ data: { type: 'error', stage: 'asset-check', message: 'Pose Landmarker model request returned HTTP 404' } })
    workers[1].onmessage({ data: { type: 'error', stage: 'asset-check', message: 'Pose Landmarker model request returned HTTP 404' } })
    expect(onStatus).toHaveBeenLastCalledWith('error', 'asset-check: Error: Pose Landmarker model request returned HTTP 404')
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ stage: 'asset-check', message: 'Error: Pose Landmarker model request returned HTTP 404', details: expect.objectContaining({ fatal: true }) }))
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    expect(workers[1].terminate).toHaveBeenCalledOnce()
  })

  it('reports frame transfer failures with their real error text', async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null }
    let videoFrame
    const video = { readyState: 2, videoWidth: 640, videoHeight: 480, requestVideoFrameCallback: (callback) => { videoFrame = callback; return 1 }, cancelVideoFrameCallback: vi.fn() }
    const onStatus = vi.fn()
    createPoseTracker(video, { workerFactory: () => worker, bitmapFactory: async () => { throw new Error('ImageBitmap decode failed') }, onStatus })
    worker.onmessage({ data: { type: 'ready', delegate: 'CPU' } })
    await videoFrame(200, { mediaTime: 0.1 })
    expect(onStatus).toHaveBeenLastCalledWith('error', 'frame-transfer: Error: ImageBitmap decode failed')
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('recovers from a frame timeout using one fresh CPU worker without duplicating frame processing', async () => {
    vi.useFakeTimers()
    const workers = []
    const makeWorker = () => { const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null }; workers.push(worker); return worker }
    let videoFrame
    const video = { readyState: 2, videoWidth: 640, videoHeight: 480, requestVideoFrameCallback: (callback) => { videoFrame = callback; return 1 }, cancelVideoFrameCallback: vi.fn() }
    const bitmaps = [0, 1].map(() => ({ width: 640, height: 480, close: vi.fn() }))
    const onDiagnostic = vi.fn(), onResult = vi.fn()
    const tracker = createPoseTracker(video, { workerFactory: makeWorker, bitmapFactory: vi.fn().mockImplementation(() => Promise.resolve(bitmaps.shift())), onDiagnostic, onResult, initTimeoutMs: 1000, frameTimeoutMs: 50 })
    workers[0].onmessage({ data: { type: 'ready', delegate: 'GPU' } })
    await videoFrame(200, { mediaTime: 0.2 })
    expect(workers[0].postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'frame', id: 1 }), expect.any(Array))
    workers[0].onmessage({ data: { type: 'diagnostic', stage: 'frame-received', message: 'received' } })
    workers[0].onmessage({ data: { type: 'diagnostic', stage: 'inference-start', message: 'detect started' } })
    await vi.advanceTimersByTimeAsync(50)
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    expect(workers).toHaveLength(2)
    expect(workers[1].postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'init', delegate: 'CPU' }))
    workers[1].onmessage({ data: { type: 'ready', delegate: 'CPU' } })
    await videoFrame(400, { mediaTime: 0.4 })
    const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
    workers[1].onmessage({ data: { type: 'result', id: 2, poses: [points], width: 640, height: 480, durationMs: 14 } })
    expect(onResult).toHaveBeenCalledOnce()
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ stage: 'detectForVideo-timeout', details: expect.objectContaining({ recovery: 'restarting worker with CPU delegate' }) }))
    expect(workers[1].postMessage.mock.calls.filter(([message]) => message.type === 'frame')).toHaveLength(1)
    tracker.stop()
    vi.useRealTimers()
  })

  it('times out model initialization and retries exactly once with CPU', async () => {
    vi.useFakeTimers()
    const workers = []
    const tracker = createPoseTracker({}, { workerFactory: () => { const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null }; workers.push(worker); return worker }, initTimeoutMs: 25 })
    await vi.advanceTimersByTimeAsync(25)
    expect(workers).toHaveLength(2)
    expect(workers[1].postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'init', delegate: 'CPU' }))
    await vi.advanceTimersByTimeAsync(25)
    expect(workers[1].terminate).toHaveBeenCalledOnce()
    tracker.stop()
    vi.useRealTimers()
  })

  it('recovers once from worker startup errors and then reports CPU failure clearly', () => {
    const workers = []
    const onStatus = vi.fn()
    const tracker = createPoseTracker({}, { workerFactory: () => { const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null }; workers.push(worker); return worker }, onStatus })
    workers[0].onerror({ message: 'module parse failed' })
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    workers[1].onerror({ message: 'worker unavailable' })
    expect(onStatus).toHaveBeenLastCalledWith('error', 'worker-runtime: Error: worker unavailable')
    expect(workers[1].terminate).toHaveBeenCalledOnce()
    tracker.stop()
  })
})
