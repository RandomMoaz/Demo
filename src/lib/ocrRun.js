/* Read the text in a photo, on the device (Tesseract.js). Shared by the ingredient scanner and the map.
   The photo never leaves the phone; only the language model is downloaded, the first time. */
import { binarize, readResult } from './ocrPrep'

// three preprocessing settings; the most reliable read wins (measured best-of beat any single setting)
export const PASSES = [{ k: 0.8, div: 60 }, { k: 0.88, div: 30 }, { k: 0.7, div: 90 }]
const GOOD_ENOUGH = 85 // stop early when a pass is already this reliable

/** Scale to ~2000px and return the raw pixels; each pass then thresholds its own copy. */
async function prepare(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const scale = Math.min(2, 2000 / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    return { w, h, data: ctx.getImageData(0, 0, w, h).data }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function pass({ w, h, data }, opt) {
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  const img = new ImageData(new Uint8ClampedArray(data), w, h)
  binarize(img.data, w, h, opt)
  ctx.putImageData(img, 0, 0)
  return canvas
}

const aborted = () => Object.assign(new Error('aborted'), { name: 'AbortError' })

/**
 * Best of several preprocessing passes.
 *   langs: Tesseract languages ('eng', 'eng+ara', 'eng+jpn', …)
 *   psm:   page layout — '6' one block (ingredient lists), '11' sparse text (signs, certificates)
 *   onProgress(0..100) once recognition starts; `signal` stops the worker straight away.
 * Resolves { text, conf, words }; text keeps line breaks in `lines` for callers that need them.
 */
export async function readPhotoText(file, { langs = 'eng', psm = '6', onProgress, onLoading, signal } = {}) {
  if (signal?.aborted) throw aborted()
  onLoading?.()
  const base = await prepare(file)
  // loaded on demand so the OCR engine is not part of the main bundle
  const { createWorker } = await import('tesseract.js')
  let n = 0
  const worker = await createWorker(langs, 1, {
    logger: (p) => { if (p.status === 'recognizing text') onProgress?.(Math.round(((n + p.progress) / PASSES.length) * 100)) },
  })
  const stop = () => { worker.terminate().catch(() => {}) }
  signal?.addEventListener('abort', stop, { once: true })
  try {
    if (signal?.aborted) throw aborted()
    await worker.setParameters({ tessedit_pageseg_mode: psm })
    let best = null
    for (; n < PASSES.length; n++) {
      const { data } = await worker.recognize(pass(base, PASSES[n]), {}, { text: true, blocks: true })
      if (signal?.aborted) throw aborted()
      const lines = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((q) => q.lines.map((l) => l.words)))
      const r = { ...readResult(lines, data.text), raw: data.text || '' } // full text + mean word confidence
      if (!best || r.conf > best.conf) best = r
      if (best.conf >= GOOD_ENOUGH) break
    }
    return best
  } finally {
    signal?.removeEventListener('abort', stop)
    stop()
  }
}
