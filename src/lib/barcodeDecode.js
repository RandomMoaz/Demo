/* Robust still-image barcode/QR decoding (no DOM, so it can be tested in Node).
   A plain ZXing pass fails on small, tilted, blurred or glare-covered barcodes, so we
   locate the barcode first, enlarge it, and try several tilts and binarizers. */
import { MultiFormatReader, BinaryBitmap, HybridBinarizer, GlobalHistogramBinarizer, RGBLuminanceSource, DecodeHintType, BarcodeFormat } from '@zxing/library'

const hints = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.QR_CODE]],
  [DecodeHintType.TRY_HARDER, true],
])

export function toGray(rgba, w, h) {
  const g = new Uint8ClampedArray(w * h)
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]
  return g
}

export function crop(g, w, x, y, cw, ch) {
  const out = new Uint8ClampedArray(cw * ch)
  for (let r = 0; r < ch; r++) out.set(g.subarray((y + r) * w + x, (y + r) * w + x + cw), r * cw)
  return out
}

export function resize(g, w, h, nw, nh) {
  const out = new Uint8ClampedArray(nw * nh)
  const sx = (w - 1) / Math.max(1, nw - 1), sy = (h - 1) / Math.max(1, nh - 1)
  for (let y = 0; y < nh; y++) {
    const fy = y * sy, y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0
    for (let x = 0; x < nw; x++) {
      const fx = x * sx, x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0
      const a = g[y0 * w + x0] * (1 - tx) + g[y0 * w + x1] * tx
      const b = g[y1 * w + x0] * (1 - tx) + g[y1 * w + x1] * tx
      out[y * nw + x] = a * (1 - ty) + b * ty
    }
  }
  return out
}

/** Rotate by deg around the centre; the canvas grows so nothing is cut, background is white. */
export function rotate(g, w, h, deg) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t)
  const nw = Math.ceil(Math.abs(w * c) + Math.abs(h * s)), nh = Math.ceil(Math.abs(w * s) + Math.abs(h * c))
  const out = new Uint8ClampedArray(nw * nh).fill(255)
  const cx = w / 2, cy = h / 2, ncx = nw / 2, ncy = nh / 2
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const dx = x - ncx, dy = y - ncy
    const sx = c * dx + s * dy + cx, sy = -s * dx + c * dy + cy
    if (sx < 0 || sy < 0 || sx >= w - 1 || sy >= h - 1) continue
    const x0 = sx | 0, y0 = sy | 0, tx = sx - x0, ty = sy - y0
    const a = g[y0 * w + x0] * (1 - tx) + g[y0 * w + x0 + 1] * tx
    const b = g[(y0 + 1) * w + x0] * (1 - tx) + g[(y0 + 1) * w + x0 + 1] * tx
    out[y * nw + x] = a * (1 - ty) + b * ty
  }
  return { g: out, w: nw, h: nh }
}

/** Find the most barcode-like regions: strong horizontal change, little vertical change. */
export function localize(g, w, h, max = 2) {
  const B = 16, bw = Math.floor(w / B), bh = Math.floor(h / B)
  if (bw < 3 || bh < 3) return []
  const score = new Float32Array(bw * bh)
  let top = 0
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let dx = 0, dy = 0
    for (let y = by * B; y < by * B + B - 1; y++) for (let x = bx * B; x < bx * B + B - 1; x++) {
      const v = g[y * w + x]
      dx += Math.abs(g[y * w + x + 1] - v); dy += Math.abs(g[(y + 1) * w + x] - v)
    }
    const sc = (dx - dy) / (B * B)
    score[by * bw + bx] = sc > 4 ? sc : 0
    if (sc > top) top = sc
  }
  if (top <= 0) return []
  const seen = new Uint8Array(bw * bh), found = []
  for (let i = 0; i < score.length; i++) {
    if (seen[i] || score[i] < top * 0.3) continue
    const stack = [i]; seen[i] = 1
    let total = 0, x0 = bw, y0 = bh, x1 = 0, y1 = 0
    while (stack.length) {
      const k = stack.pop(), kx = k % bw, ky = (k / bw) | 0
      total += score[k]; x0 = Math.min(x0, kx); x1 = Math.max(x1, kx); y0 = Math.min(y0, ky); y1 = Math.max(y1, ky)
      for (let ny = ky - 1; ny <= ky + 1; ny++) for (let nx = kx - 1; nx <= kx + 1; nx++) {
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue
        const n = ny * bw + nx
        if (!seen[n] && score[n] >= top * 0.3) { seen[n] = 1; stack.push(n) }
      }
    }
    found.push({ total, x0: x0 * B, y0: y0 * B, x1: (x1 + 1) * B, y1: (y1 + 1) * B })
  }
  found.sort((a, b) => b.total - a.total)
  return found.slice(0, max).map(({ x0, y0, x1, y1 }) => {
    const mx = Math.round((x1 - x0) * 0.25), my = Math.round((y1 - y0) * 0.25)
    const X = Math.max(0, x0 - mx), Y = Math.max(0, y0 - my)
    return { x: X, y: Y, w: Math.min(w, x1 + mx) - X, h: Math.min(h, y1 + my) - Y }
  })
}

export function tryDecode(g, w, h) {
  for (const Bin of [HybridBinarizer, GlobalHistogramBinarizer]) {
    try {
      const reader = new MultiFormatReader(); reader.setHints(hints)
      const r = reader.decode(new BinaryBitmap(new Bin(new RGBLuminanceSource(g, w, h))))
      return { text: r.getText(), format: BarcodeFormat[r.getBarcodeFormat()] }
    } catch { /* not found at this setting; the caller tries the next one */ }
  }
  return null
}

/* Measured on 60 degraded photos: stretching contrast + unsharp masking recovers most failures,
   while black/white thresholding produced wrong reads, so it is deliberately not used here. */
function boxBlur(g, w, h) {
  const o = new Uint8ClampedArray(g.length)
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    let s = 0
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += g[(y + j) * w + x + i]
    o[y * w + x] = s / 9
  }
  return o
}

export function sharpen(g, w, h, amount = 1.5) {
  const sorted = Array.from(g.length > 40000 ? g.filter((_, i) => i % 7 === 0) : g).sort((a, b) => a - b)
  const lo = sorted[Math.floor(sorted.length * 0.02)], hi = sorted[Math.floor(sorted.length * 0.98)]
  const span = Math.max(1, hi - lo)
  const st = new Uint8ClampedArray(g.length)
  for (let i = 0; i < g.length; i++) st[i] = ((g[i] - lo) * 255) / span
  const b = boxBlur(st, w, h)
  const out = new Uint8ClampedArray(g.length)
  for (let i = 0; i < g.length; i++) out[i] = st[i] + amount * (st[i] - b[i])
  return out
}

const SCALES = [1, 0.6, 1.5, 2.5]
const TILTS = [0, 3, -3, 6, -6, 10, -10]
const MAX_PIXELS = 4e6
const tick = () => new Promise((r) => setTimeout(r, 0)) // lets the page stay responsive between attempts

/**
 * Decode a still image given as RGBA pixels. Returns { text, format, how } or null.
 * Order: plain pass -> locate the barcode -> sharpen at several scales and tilts -> whole image sharpened.
 * Results from the processed passes must be seen twice (different scale/tilt) before they are trusted.
 * `budgetMs` keeps phones responsive: we stop trying when it is spent.
 */
export async function decodeImage({ data, width, height }, { budgetMs = 8000, now = () => Date.now(), onProgress } = {}) {
  const t0 = now(), over = () => now() - t0 > budgetMs
  const g = toGray(data, width, height)
  const full = tryDecode(g, width, height)
  if (full) return { ...full, how: 'plain' }

  const seen = new Map()
  const trySource = async (src, sw, sh, label) => {
    for (const scale of SCALES) {
      const nw = Math.round(sw * scale), nh = Math.round(sh * scale)
      if (nw < 80 || nh < 40 || nw * nh > MAX_PIXELS) continue
      const base = scale === 1 ? src : resize(src, sw, sh, nw, nh)
      const prepped = sharpen(base, nw, nh)
      for (const deg of TILTS) {
        if (over()) return null
        await tick()
        const rot = deg ? rotate(prepped, nw, nh, deg) : { g: prepped, w: nw, h: nh }
        const r = tryDecode(rot.g, rot.w, rot.h)
        if (!r) continue
        const n = (seen.get(r.text) || 0) + 1
        seen.set(r.text, n)
        if (n >= 2) return { ...r, how: `${label}@${scale}x/${deg}deg` }
      }
    }
    return null
  }

  if (onProgress) onProgress('locating')
  for (const reg of localize(g, width, height)) {
    const hit = await trySource(crop(g, width, reg.x, reg.y, reg.w, reg.h), reg.w, reg.h, 'region')
    if (hit) return hit
  }
  if (onProgress) onProgress('whole')
  const hit = await trySource(g, width, height, 'whole')
  if (hit) return hit
  // a single processed read that never got confirmed: better to ask for a clearer photo than to guess
  return null
}
