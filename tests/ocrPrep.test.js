import { describe, it, expect } from 'vitest'
import { binarize, fixENumbers, tidyText, readResult, OCR_BLOCK, OCR_TRUST } from '../src/lib/ocrPrep.js'

describe('fixENumbers', () => {
  it.each([
    ['emulsifier (5471)', 'emulsifier (E471)'], ['emulsifier (12471)', 'emulsifier (E471)'], ['emulsifier (EA71)', 'emulsifier (E471)'],
    ['colour E 120, salt', 'colour E120, salt'], ['colour E-120', 'colour E120'], ['flavour enhancer F631', 'flavour enhancer E631'],
  ])('repairs %j', (input, out) => expect(fixENumbers(input)).toBe(out))

  it.each(['Sugar (12%)', 'Vitamin B12', 'Contains 2020 mg', 'BOSS flour', 'Salt 1500 mg', 'E999999', 'colour (5099)', 'code E1600', ''])('leaves %j alone', (s) => {
    expect(fixENumbers(s)).toBe(s)
  })
  it('never throws on null or undefined', () => { expect(fixENumbers(null)).toBe(''); expect(fixENumbers(undefined)).toBe('') })
})

describe('tidyText', () => {
  it('joins hyphenated line breaks and drops decoration', () => {
    expect(tidyText('ingre-\ndients: sugar,\nsalt')).toBe('ingredients: sugar, salt')
    expect(tidyText('—INGREDIENTS—Sugar~~gelatin|')).toBe('INGREDIENTS Sugar gelatin')
  })
  it('keeps Arabic and collapses spaces', () => expect(tidyText('  سكر،   ملح \n جيلاتين ')).toBe('سكر، ملح جيلاتين'))
  it('handles null', () => expect(tidyText(null)).toBe(''))
})

describe('readResult', () => {
  const word = (text, confidence) => ({ text, confidence })
  it('uses the mean confidence of real words only', () => {
    const r = readResult([[word('sugar', 90), word('salt', 70), word('flour', 80), word('%', 5), word('1', 1)]], 'sugar salt flour')
    expect(r.words).toBe(3) // symbols and single characters do not count
    expect(r.conf).toBe(80)
  })
  it('scores a read with fewer than three real words as 0', () => {
    expect(readResult([[word('sugar', 99), word('salt', 99)]], 'sugar salt').conf).toBe(0)
  })
  it('keeps the whole text, including words the engine was unsure about', () => {
    const r = readResult([[word('sugar', 95), word('pork', 40), word('salt', 90)]], 'sugar pork salt')
    expect(r.text).toContain('pork')
  })
  it('repairs E-numbers in the returned text', () => {
    expect(readResult([], 'emulsifier (5471)').text).toBe('emulsifier (E471)')
  })
  it('has sensible thresholds', () => { expect(OCR_BLOCK).toBeLessThan(OCR_TRUST) })
})

describe('binarize', () => {
  const img = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { const v = f(i % w, (i / w) | 0); d.set([v, v, v, 255], i * 4) } return d }
  it('outputs only black or white pixels', () => {
    const d = img(64, 64, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? 40 : 220)
    binarize(d, 64, 64)
    for (let i = 0; i < 64 * 64; i++) expect([0, 255]).toContain(d[i * 4])
  })
  it('flips light-on-dark so text ends up dark on a light page', () => {
    const d = img(80, 40, (x) => (x % 8 < 2 ? 230 : 25)) // thin light lines on a dark ground
    binarize(d, 80, 40)
    let white = 0; for (let i = 0; i < 80 * 40; i++) if (d[i * 4] === 255) white++
    expect(white / (80 * 40)).toBeGreaterThan(0.5)
  })
})
