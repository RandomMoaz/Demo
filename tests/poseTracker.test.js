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
    expect(onStatus).toHaveBeenCalledWith('loading')
    expect(onStatus).toHaveBeenCalledWith('searching')
    tracker.stop()
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(11)
    expect(worker.terminate).toHaveBeenCalledOnce()
    worker.onmessage({ data: { type: 'result', id: 2, poses: [], width: 640, height: 480 } })
    expect(onResult).toHaveBeenCalledOnce()
  })
})
