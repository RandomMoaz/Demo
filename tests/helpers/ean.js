/* Test helper: draws a real EAN-13 barcode into RGBA pixels, so decoders can be tested without image files. */
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

export function ean13Modules(code) {
  const d = code.split('').map(Number)
  let m = '101'
  for (let i = 0; i < 6; i++) m += (PAR[d[0]][i] === 'L' ? L : G)[d[i + 1]]
  m += '01010'
  for (let i = 7; i < 13; i++) m += R[d[i]]
  return m + '101'
}

/** Deterministic pseudo-random numbers so "noisy" tests give the same result every run. */
export function rng(seed = 1) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
}

/** A white canvas with a barcode on it. mod = pixels per module. Returns { data, width, height } (RGBA). */
export function barcodeImage(code, { mod = 3, width = 900, height = 500, x, y, blur = 0, noise = 0, seed = 1 } = {}) {
  const m = ean13Modules(code)
  const bw = m.length * mod, bh = mod * 50
  const ox = x ?? Math.round((width - bw) / 2), oy = y ?? Math.round((height - bh) / 2)
  const gray = new Float32Array(width * height).fill(255)
  for (let i = 0; i < m.length; i++) if (m[i] === '1') for (let yy = oy; yy < oy + bh; yy++) for (let xx = ox + i * mod; xx < ox + (i + 1) * mod; xx++) gray[yy * width + xx] = 0
  let g = gray
  for (let pass = 0; pass < blur; pass++) { // each pass is a 3x3 box blur
    const o = new Float32Array(g.length)
    for (let yy = 1; yy < height - 1; yy++) for (let xx = 1; xx < width - 1; xx++) {
      let s = 0
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += g[(yy + j) * width + xx + i]
      o[yy * width + xx] = s / 9
    }
    g = o
  }
  const rand = rng(seed)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < g.length; i++) {
    const v = g[i] + (noise ? (rand() - 0.5) * 2 * noise : 0)
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255
  }
  return { data, width, height }
}
