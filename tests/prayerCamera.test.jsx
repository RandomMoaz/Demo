import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, create } from 'react-test-renderer'
import { AppProvider } from '../src/context/AppContext.jsx'
import { Salah } from '../src/screens/Features.jsx'
import { createPrayerCameraController, openPrayerCamera } from '../src/lib/prayerCamera'

function makeStream(trackCount = 1) {
  const tracks = Array.from({ length: trackCount }, () => ({ stop: vi.fn() }))
  return { tracks, stream: { getTracks: () => tracks } }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function makeVideo(play = vi.fn().mockResolvedValue(undefined)) {
  return { play, srcObject: null }
}

afterEach(() => vi.unstubAllGlobals())

describe('openPrayerCamera', () => {
  it('opens the permitted video-only stream and returns cleanup that stops every track', async () => {
    const { tracks, stream } = makeStream(2)
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    const video = makeVideo()
    const cleanup = await openPrayerCamera(video, { mediaDevices: { getUserMedia }, secure: true })

    expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
    expect(video.srcObject).toBe(stream)
    cleanup()
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce())
    expect(video.srcObject).toBeNull()
  })

  it('reports an insecure context before requesting camera permission', async () => {
    const getUserMedia = vi.fn()
    await expect(openPrayerCamera({}, { mediaDevices: { getUserMedia }, secure: false })).rejects.toMatchObject({ code: 'insecure' })
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('reports camera unavailable when getUserMedia is missing', async () => {
    await expect(openPrayerCamera({}, { mediaDevices: undefined, secure: true })).rejects.toMatchObject({ code: 'unavailable' })
  })

  it.each([
    ['NotAllowedError', 'denied'], ['SecurityError', 'denied'], ['NotFoundError', 'unavailable'],
    ['OverconstrainedError', 'unavailable'], ['NotReadableError', 'busy'], ['UnknownError', 'error'],
  ])('maps camera initialization failure %s to %s', async (name, code) => {
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error(name), { name }))
    await expect(openPrayerCamera({}, { mediaDevices: { getUserMedia }, secure: true })).rejects.toMatchObject({ code })
  })

  it('stops all acquired tracks and clears the preview if video playback fails', async () => {
    const { tracks, stream } = makeStream(2)
    const video = makeVideo(vi.fn().mockRejectedValue(new Error('play failed')))
    await expect(openPrayerCamera(video, { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) }, secure: true })).rejects.toMatchObject({ code: 'error' })
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce())
    expect(video.srcObject).toBeNull()
  })
})

describe('Prayer camera screen lifecycle', () => {
  it.each([
    ['permission denied', 'denied', 'Camera access was denied'],
    ['camera unavailable', 'unavailable', 'No camera is available'],
    ['insecure context', 'insecure', 'Camera access requires a secure'],
    ['camera busy', 'busy', 'camera is in use'],
    ['initialization failure', 'error', 'Could not start the camera'],
  ])('shows a clear status for %s', async (_case, failure, message) => {
    const names = { denied: 'NotAllowedError', unavailable: 'NotFoundError', busy: 'NotReadableError', error: 'UnknownError' }
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error(failure), { name: names[failure] }))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    vi.stubGlobal('window', { isSecureContext: failure !== 'insecure' })
    let root
    await act(async () => {
      root = create(<AppProvider><Salah /></AppProvider>, { createNodeMock: (element) => element.type === 'video' ? makeVideo() : null })
    })
    const button = root.root.findAllByType('button').find((item) => item.props.className === 'btn block')
    await act(async () => { button.props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(root.root.findByProps({ role: 'status' }).props.children).toContain(message)
    expect(getUserMedia).toHaveBeenCalledTimes(failure === 'insecure' ? 0 : 1)
    await act(async () => root.unmount())
  })

  it('shows playback failure and releases the stream in the screen', async () => {
    const { tracks, stream } = makeStream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } })
    vi.stubGlobal('window', { isSecureContext: true })
    let root
    await act(async () => {
      root = create(<AppProvider><Salah /></AppProvider>, { createNodeMock: (element) => element.type === 'video' ? makeVideo(vi.fn().mockRejectedValue(new Error('play failed'))) : null })
    })
    const button = root.root.findAllByType('button').find((item) => item.props.className === 'btn block')
    await act(async () => { button.props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(root.root.findByProps({ role: 'status' }).props.children).toContain('Could not start the camera')
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce())
    await act(async () => root.unmount())
  })

  it('stops every track when Stop is pressed and supports repeated start/stop cycles', async () => {
    const first = makeStream(2)
    const second = makeStream(2)
    const getUserMedia = vi.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    vi.stubGlobal('window', { isSecureContext: true })
    const video = makeVideo()
    let root
    await act(async () => {
      root = create(<AppProvider><Salah /></AppProvider>, { createNodeMock: (element) => element.type === 'video' ? video : null })
    })
    const startStop = () => root.root.findAllByType('button').find((button) => button.props.className === 'btn block')

    await act(async () => { startStop().props.onClick(); await Promise.resolve() })
    expect(root.root.findByProps({ role: 'status' }).props.children).toContain('Camera is on')
    await act(async () => { startStop().props.onClick() })
    first.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce())
    expect(video.srcObject).toBeNull()

    await act(async () => { startStop().props.onClick(); await Promise.resolve() })
    await act(async () => { startStop().props.onClick() })
    second.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce())
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    await act(async () => root.unmount())
  })

  it('stops all active camera tracks when the Salah screen unmounts', async () => {
    const { tracks, stream } = makeStream(2)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } })
    vi.stubGlobal('window', { isSecureContext: true })
    let root
    await act(async () => {
      root = create(<AppProvider><Salah /></AppProvider>, { createNodeMock: (element) => element.type === 'video' ? makeVideo() : null })
    })
    const startButton = root.root.findAllByType('button').find((button) => button.props.className === 'btn block')
    await act(async () => { startButton.props.onClick(); await Promise.resolve() })
    await act(async () => root.unmount())
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce())
  })

  it('cleans up a late camera result when the user leaves immediately after Start', async () => {
    const pending = deferred()
    const { tracks, stream } = makeStream(2)
    const getUserMedia = vi.fn(() => pending.promise)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    vi.stubGlobal('window', { isSecureContext: true })
    const video = makeVideo()
    let root
    await act(async () => {
      root = create(<AppProvider><Salah /></AppProvider>, { createNodeMock: (element) => element.type === 'video' ? video : null })
    })
    const startButton = root.root.findAllByType('button').find((button) => button.props.className === 'btn block')
    await act(async () => { startButton.props.onClick() })
    expect(getUserMedia).toHaveBeenCalledOnce()
    await act(async () => root.unmount())

    pending.resolve(stream)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce())
    expect(video.srcObject).toBeNull()
  })
})

describe('createPrayerCameraController race handling', () => {
  it('does not publish state after disposal when getUserMedia resolves late', async () => {
    const pending = deferred()
    const { stream } = makeStream()
    const onState = vi.fn()
    const controller = createPrayerCameraController(makeVideo(), {
      onState,
      cameraOptions: { mediaDevices: { getUserMedia: () => pending.promise }, secure: true },
    })

    const started = controller.start()
    expect(onState).toHaveBeenLastCalledWith('starting')
    controller.dispose()
    pending.resolve(stream)
    await expect(started).resolves.toBe(false)
    expect(onState).toHaveBeenCalledTimes(1)
    stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalledOnce())
  })

  it('stops a stale first stream when a second start supersedes it', async () => {
    const pendingFirst = deferred()
    const pendingSecond = deferred()
    const first = makeStream()
    const second = makeStream()
    const getUserMedia = vi.fn().mockReturnValueOnce(pendingFirst.promise).mockReturnValueOnce(pendingSecond.promise)
    const video = makeVideo()
    const controller = createPrayerCameraController(video, { cameraOptions: { mediaDevices: { getUserMedia }, secure: true } })

    const firstStart = controller.start()
    const secondStart = controller.start()
    pendingFirst.resolve(first.stream)
    await expect(firstStart).resolves.toBe(false)
    first.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce())
    pendingSecond.resolve(second.stream)
    await expect(secondStart).resolves.toBe(true)
    controller.stop()
    second.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledOnce())
  })
})
