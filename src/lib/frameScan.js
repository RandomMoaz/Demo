/* Extra help for the LIVE camera when the normal ZXing pass cannot read a frame (far, small, blurry or
   moving barcodes). Pure, no DOM. The normal pass already tries the plain frame, so this starts from the
   barcode region: sharpen -> tilt 5 deg -> enlarge 1.5x, and the whole sharpened frame as a last resort.
   Chosen by measuring candidate plans on 252 simulated hand-held video frames (see the commit message). */
import { toGray, localize, crop, resize, rotate, sharpen, tryDecode } from './barcodeDecode'

const tick = () => new Promise((r) => setTimeout(r, 0)) // keeps the page responsive between decodes

function attempt(g, w, h, scale, deg) {
  const nw = Math.round(w * scale), nh = Math.round(h * scale)
  const base = scale === 1 ? g : resize(g, w, h, nw, nh)
  const s = sharpen(base, nw, nh)
  const r = deg ? rotate(s, nw, nh, deg) : { g: s, w: nw, h: nh }
  return tryDecode(r.g, r.w, r.h)
}

const REGION_PLAN = [[1, 0], [1, 5], [1.5, 0]]

/**
 * @param {{data: Uint8ClampedArray, width: number, height: number}} frame RGBA pixels of one video frame
 * @param {{whole?: boolean}} opts whole: also try the whole sharpened frame (costly, so only now and then)
 * @returns {Promise<{text: string, format: string, how: string} | null>}
 */
export async function scanFrame({ data, width, height }, { whole = false } = {}) {
  const g = toGray(data, width, height)
  const reg = localize(g, width, height, 1)[0]
  if (reg) {
    const c = crop(g, width, reg.x, reg.y, reg.w, reg.h)
    for (const [scale, deg] of REGION_PLAN) {
      await tick()
      const r = attempt(c, reg.w, reg.h, scale, deg)
      if (r) return { ...r, how: `region sharp ${scale}x/${deg}deg` }
    }
  }
  if (whole) {
    await tick()
    const r = attempt(g, width, height, 1, 0)
    if (r) return { ...r, how: 'whole sharp' }
  }
  return null
}
