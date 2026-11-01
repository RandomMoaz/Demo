import { describe, it, expect } from 'vitest'
import { decodeImage, localize, toGray, sharpen } from '../src/lib/barcodeDecode.js'
import { scanFrame } from '../src/lib/frameScan.js'
import { barcodeImage } from './helpers/ean.js'

const CODES = ['3017624010701', '5000159407236', '9780201379624', '6221033260047']

it('rejects a code whose check digit is wrong, instead of reading it', async () => {
  // 6221033260046 is 6221033260047 with a wrong last digit
  expect(await decodeImage(barcodeImage('6221033260046', { mod: 3 }), { budgetMs: 1500 })).toBeNull()
})

describe('decodeImage (still images)', () => {
  it.each(CODES)('reads a clean EAN-13 %s', async (code) => {
    const r = await decodeImage(barcodeImage(code, { mod: 3 }))
    expect(r?.text).toBe(code)
    expect(r?.format).toBe('EAN_13')
  })

  it('reads a small barcode sitting in a large image', async () => {
    const r = await decodeImage(barcodeImage('5000159407236', { mod: 2, width: 1600, height: 1000, x: 1100, y: 700 }))
    expect(r?.text).toBe('5000159407236')
  })

  it('reads a blurry, noisy barcode', async () => {
    const r = await decodeImage(barcodeImage('3017624010701', { mod: 3, blur: 2, noise: 25, seed: 7 }))
    expect(r?.text).toBe('3017624010701')
  })

  it('returns null, not a guess, for a blank image', async () => {
    expect(await decodeImage(barcodeImage('3017624010701', { mod: 0.0001 }), { budgetMs: 1500 })).toBeNull()
  })

  it('never returns a wrong code on pure noise', async () => {
    const w = 400, h = 300, data = new Uint8ClampedArray(w * h * 4)
    let s = 99
    for (let i = 0; i < w * h; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const v = s >>> 24; data.set([v, v, v, 255], i * 4) }
    expect(await decodeImage({ data, width: w, height: h }, { budgetMs: 2000 })).toBeNull()
  })

  it('stops when the time budget is spent', async () => {
    let t = 0
    const r = await decodeImage(barcodeImage('3017624010701', { mod: 0.0001 }), { budgetMs: 50, now: () => (t += 100) })
    expect(r).toBeNull()
  })
})

describe('localize', () => {
  it('finds the barcode region in a larger image', () => {
    const img = barcodeImage('3017624010701', { mod: 3, width: 1200, height: 800, x: 500, y: 450 })
    const reg = localize(toGray(img.data, img.width, img.height), img.width, img.height, 1)[0]
    expect(reg).toBeTruthy()
    // the barcode occupies x 500..785, y 450..600 (95 modules x 3 px, 50 modules tall); the region must contain it
    expect(reg.x).toBeLessThanOrEqual(500); expect(reg.x + reg.w).toBeGreaterThanOrEqual(785)
    expect(reg.y).toBeLessThanOrEqual(450); expect(reg.y + reg.h).toBeGreaterThanOrEqual(600)
    expect(reg.w * reg.h).toBeLessThan(img.width * img.height * 0.2) // and be a small part of the image
  })
  it('finds nothing in a blank image', () => {
    const w = 320, h = 240
    expect(localize(new Uint8ClampedArray(w * h).fill(200), w, h)).toEqual([])
  })
  it('copes with images too small to tile', () => {
    expect(localize(new Uint8ClampedArray(10 * 10), 10, 10)).toEqual([])
  })
})

describe('sharpen', () => {
  it('increases contrast and keeps the array size', () => {
    const g = new Uint8ClampedArray(64 * 64).map((_, i) => (((i % 64) >> 3) % 2 ? 120 : 140))
    const s = sharpen(g, 64, 64)
    expect(s.length).toBe(g.length)
    const spread = (a) => Math.max(...a) - Math.min(...a)
    expect(spread(s)).toBeGreaterThan(spread(g))
  })
})

describe('scanFrame (live camera helper)', () => {
  it('reads a barcode region of a video-sized frame', async () => {
    const f = barcodeImage('5000159407236', { mod: 2, width: 1280, height: 720, blur: 1, noise: 12, seed: 3 })
    const r = await scanFrame(f, { whole: true })
    expect(r?.text).toBe('5000159407236')
  })
  it('returns null on an empty frame', async () => {
    const w = 640, h = 360
    expect(await scanFrame({ data: new Uint8ClampedArray(w * h * 4).fill(180), width: w, height: h }, { whole: true })).toBeNull()
  })
})
