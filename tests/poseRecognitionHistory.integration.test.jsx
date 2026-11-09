import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, create } from 'react-test-renderer'
import { AppProvider } from '../src/context/AppContext.jsx'

const trackerState = vi.hoisted(() => ({ callbacks: null, stop: null }))
vi.mock('../src/lib/poseTracker', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    createPoseTracker: vi.fn((_video, callbacks) => {
      trackerState.callbacks = callbacks
      trackerState.stop = vi.fn()
      return { stop: trackerState.stop }
    }),
  }
})

import { Salah } from '../src/screens/Features.jsx'

function makeStream() {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] }
  return { track, stream }
}

afterEach(() => {
  trackerState.callbacks = null
  trackerState.stop = null
  vi.unstubAllGlobals()
})

describe('pose recognition history screen integration', () => {
  it('continues recording and shows results while the diagnostics panel stays collapsed', async () => {
    const { track, stream } = makeStream()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } })
    vi.stubGlobal('window', { isSecureContext: true, devicePixelRatio: 1 })
    const video = { play: vi.fn().mockResolvedValue(undefined), srcObject: null, videoWidth: 640, videoHeight: 480 }
    let root
    await act(async () => {
      root = create(<AppProvider><Salah /></AppProvider>, {
        createNodeMock: (element) => element.type === 'video' ? video : null,
      })
    })
    const start = root.root.findAllByType('button').find((button) => button.props.className === 'btn block')
    await act(async () => { start.props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(trackerState.callbacks).toBeTruthy()

    await act(async () => trackerState.callbacks.onResult({ poses: [], width: 640, height: 480, timestamp: 100 }))
    const details = root.root.findAllByType('details')
    expect(details.length).toBeGreaterThanOrEqual(2)
    expect(details[0].props.open).toBeUndefined()
    expect(details[1].props.open).toBeUndefined()
    expect(root.root.findAllByType('summary').some((summary) => String(summary.props.children).includes('Pose Recognition History'))).toBe(true)
    expect(JSON.stringify(root.toJSON())).toContain('UNKNOWN')

    const clear = root.root.findAllByType('button').find((button) => button.children.includes('Clear History'))
    await act(async () => clear.props.onClick())
    expect(root.root.findAllByType('details')).toHaveLength(2)
    expect(root.root.findAllByType('p').some((item) => item.children.includes('No results recorded yet.'))).toBe(true)
    await act(async () => root.unmount())
    expect(track.stop).toHaveBeenCalledOnce()
  })
})
