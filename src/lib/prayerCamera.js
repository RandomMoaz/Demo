/** Open a user-facing camera stream for Prayer Trainer. Frames remain in the browser. */
export async function openPrayerCamera(video, options = {}) {
  const {
    mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
    secure = typeof window !== 'undefined' ? window.isSecureContext : true,
  } = options
  if (!secure) throw Object.assign(new Error('insecure'), { code: 'insecure' })
  if (!mediaDevices?.getUserMedia) throw Object.assign(new Error('unavailable'), { code: 'unavailable' })

  let stream
  try {
    stream = await mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    })
    video.srcObject = stream
    await video.play()
    return () => {
      stream.getTracks().forEach((track) => track.stop())
      if (video.srcObject === stream) video.srcObject = null
    }
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop())
    if (video.srcObject === stream) video.srcObject = null
    const code = ({ NotAllowedError: 'denied', SecurityError: 'denied', NotFoundError: 'unavailable', OverconstrainedError: 'unavailable', NotReadableError: 'busy' })[error?.name] || 'error'
    throw Object.assign(new Error(code), { code, cause: error })
  }
}

/** Owns one screen's asynchronous camera lifecycle and suppresses stale callbacks. */
export function createPrayerCameraController(video, { onState = () => {}, cameraOptions } = {}) {
  let requestId = 0
  let stopStream = null
  let disposed = false

  const publish = (state) => { if (!disposed) onState(state) }

  return {
    async start() {
      if (disposed) return false
      const request = ++requestId
      stopStream?.()
      stopStream = null
      publish('starting')
      try {
        const cleanup = await openPrayerCamera(video, cameraOptions)
        if (disposed || request !== requestId) {
          cleanup()
          return false
        }
        stopStream = cleanup
        publish('active')
        return true
      } catch (error) {
        if (!disposed && request === requestId) publish(error.code || 'error')
        return false
      }
    },

    stop() {
      if (disposed) return
      requestId++
      stopStream?.()
      stopStream = null
      publish('idle')
    },

    dispose() {
      if (disposed) return
      disposed = true
      requestId++
      stopStream?.()
      stopStream = null
    },
  }
}
