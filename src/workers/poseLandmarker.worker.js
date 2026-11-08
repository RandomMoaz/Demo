import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

let landmarker

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const files = await FilesetResolver.forVisionTasks(data.wasmPath, true)
      const options = {
        baseOptions: { modelAssetPath: data.modelPath, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 2,
        minPoseDetectionConfidence: 0.45,
        minPosePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      }
      try {
        landmarker = await PoseLandmarker.createFromOptions(files, options)
      } catch {
        landmarker = await PoseLandmarker.createFromOptions(files, {
          ...options,
          baseOptions: { modelAssetPath: data.modelPath, delegate: 'CPU' },
        })
      }
      self.postMessage({ type: 'ready' })
    } catch (error) {
      self.postMessage({ type: 'error', message: error?.message || 'Pose model could not be loaded' })
    }
    return
  }

  if (data.type === 'frame') {
    try {
      if (!landmarker) throw new Error('Pose model is not ready')
      const result = landmarker.detectForVideo(data.bitmap, data.timestamp)
      const poses = (result.landmarks || []).map((landmarks) => landmarks.map((point) => ({
        x: point.x, y: point.y, z: point.z,
        visibility: point.visibility ?? point.presence ?? 0,
        presence: point.presence ?? point.visibility ?? 0,
      })))
      self.postMessage({ type: 'result', id: data.id, poses, width: data.bitmap.width, height: data.bitmap.height })
    } catch (error) {
      self.postMessage({ type: 'frame-error', id: data.id, message: error?.message || 'Pose detection failed' })
    } finally {
      data.bitmap.close()
    }
  }
}
