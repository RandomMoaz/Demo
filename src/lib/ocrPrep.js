/* Pure image helpers for OCR (no DOM), so they can be unit-tested in Node. */

/** Adaptive (local-mean) threshold on RGBA pixels, in place. Handles shadows and uneven light on phone photos. */
export function binarize(px, w, h, { k = 0.8, div = 60 } = {}) {
  const n = w * h
  const gray = new Uint8ClampedArray(n)
  for (let i = 0, j = 0; i < n; i++, j += 4) gray[i] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2]
  // integral image for fast window means
  const W = w + 1
  const ii = new Float64Array(W * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) { row += gray[y * w + x]; ii[(y + 1) * W + x + 1] = ii[y * W + x + 1] + row }
  }
  const r = Math.max(8, Math.round(Math.min(w, h) / div)) // half window
  const out = new Uint8ClampedArray(n)
  let dark = 0
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1)
      const sum = ii[y1 * W + x1] - ii[y0 * W + x1] - ii[y1 * W + x0] + ii[y0 * W + x0]
      const mean = sum / ((x1 - x0) * (y1 - y0))
      const v = gray[y * w + x] < mean * k ? 0 : 255
      out[y * w + x] = v
      if (!v) dark++
    }
  }
  const invert = dark > n * 0.5 // light text on a dark background -> flip to dark-on-light
  for (let i = 0, j = 0; i < n; i++, j += 4) { const v = invert ? 255 - out[i] : out[i]; px[j] = px[j + 1] = px[j + 2] = v; px[j + 3] = 255 }
}

export const OCR_BLOCK = 55 // below this mean word confidence the read is rejected
export const OCR_TRUST = 70 // a clean (green) verdict needs at least this

const DIG = { A: '4', O: '0', I: '1', l: '1', S: '5', B: '8', G: '6' }
const toDigits = (s) => s.replace(/[AOIlSBG]/g, (c) => DIG[c])
const validE = (n) => n >= 100 && n <= 1599

/** OCR often misreads "E471" as "5471", "EA71" or "(12471)". Repair only clear E-number shapes. */
export function fixENumbers(text) {
  return String(text || '')
    // letter-led: E471, E 471, EA71, F471, B471 (needs at least two real digits)
    .replace(/\b[EFB]\s?[-.]?\s?([0-9AOIlSBG]{3,4})\b/g, (m, d) => {
      if ((d.match(/[0-9]/g) || []).length < 2) return m
      const n = parseInt(toDigits(d), 10)
      return validE(n) ? `E${n}` : m
    })
    // digits only, but wrapped in parentheses and with up to two stray leading characters
    .replace(/\((?:[EFBS0-9]{1,2})?([0-9AOIlSBG]{3})\)/g, (m, d) => {
      const n = parseInt(toDigits(d), 10)
      return validE(n) ? `(E${n})` : m
    })
}

/** Light cleanup that keeps every real word: joins hyphenated line breaks, drops stripe/border symbols. */
export function tidyText(raw) {
  return String(raw || '')
    .replace(/-\s*\n\s*/g, '')
    .replace(/[—–_~|=*#]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Text to analyze + a reliability score. No word is thrown away (a low-confidence word can be the haram one);
 * the score is the mean word confidence, so noisy reads are blocked instead of guessed.
 */
export function readResult(lines, raw) {
  const confs = []
  for (const line of lines) for (const w of line) {
    if (((w.text || '').match(/\p{L}/gu) || []).length >= 3) confs.push(w.confidence)
  }
  const conf = confs.length >= 3 ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : 0
  return { text: fixENumbers(tidyText(raw)), conf, words: confs.length }
}
