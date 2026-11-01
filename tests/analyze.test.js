import { describe, it, expect } from 'vitest'
import cases from './data/ingredient-cases.json'
import { analyze } from '../src/lib/data.js'
import { rng } from './helpers/ean.js'

const STATES = ['ok', 'warn', 'bad', 'unknown']
const counted = cases.filter((c) => !c.debatable)
const good = counted.filter((c) => !c.knownGap)
const gaps = counted.filter((c) => c.knownGap)

describe('ingredient classification: regression guard', () => {
  it.each(good.map((c) => [c.id, c]))('%s', (_id, c) => {
    expect(analyze(c.text).v).toBe(c.expected)
  })
})

// Each of these is wrong today (see tests/data/README.md). `it.fails` keeps the build green now and
// turns into a failure the moment the engine gets it right, as a reminder to delete `knownGap`.
describe('known gaps (engine currently gets these wrong)', () => {
  for (const c of gaps) {
    it.fails(`${c.id} [${c.knownGap}] ${c.text.slice(0, 50)}`, () => {
      expect(analyze(c.text).v).toBe(c.expected)
    })
  }
})

describe('evaluation report', () => {
  const rows = counted.map((c) => ({ ...c, got: analyze(c.text).v }))
  const matrix = Object.fromEntries(STATES.map((e) => [e, Object.fromEntries(STATES.map((g) => [g, 0]))]))
  for (const r of rows) matrix[r.expected][r.got]++
  const accuracy = rows.filter((r) => r.got === r.expected).length / rows.length
  const tp = matrix.bad.bad, fn = STATES.filter((s) => s !== 'bad').reduce((a, s) => a + matrix.bad[s], 0)
  const fp = STATES.filter((s) => s !== 'bad').reduce((a, s) => a + matrix[s].bad, 0)
  const haramRecall = tp / (tp + fn), haramPrecision = tp / (tp + fp)
  const falseGreen = rows.filter((r) => r.expected !== 'ok' && r.expected !== 'unknown' && r.got === 'ok')

  it('prints the confusion matrix and haram precision / recall', () => {
    const line = (e) => `${e.padEnd(8)}` + STATES.map((g) => String(matrix[e][g]).padStart(8)).join('')
    console.info(['', `cases counted: ${rows.length} (debatable excluded: ${cases.length - rows.length})`, `rows = expected, columns = engine`,
      ''.padEnd(8) + STATES.map((s) => s.padStart(8)).join(''), ...STATES.map(line), '',
      `accuracy          ${(accuracy * 100).toFixed(1)}%`,
      `haram precision   ${(haramPrecision * 100).toFixed(1)}%  (${tp} of ${tp + fp} flagged haram really are)`,
      `haram recall      ${(haramRecall * 100).toFixed(1)}%  (${tp} of ${tp + fn} haram cases found)`,
      `false greens      ${falseGreen.length}: ${falseGreen.map((r) => r.id).join(', ') || 'none'}`].join('\n'))
    expect(rows.length).toBeGreaterThan(100)
  })
  // floors = today's measured numbers (accuracy 85.7%, haram precision 70.8%, recall 94.4%, 2 false greens).
  // A change must not make them worse; raise the floors as the engine improves.
  it('accuracy does not drop below today', () => expect(accuracy).toBeGreaterThanOrEqual(0.85))
  it('haram precision does not drop below today', () => expect(haramPrecision).toBeGreaterThanOrEqual(0.70))
  it('haram recall does not drop below today', () => expect(haramRecall).toBeGreaterThanOrEqual(0.94))
  it('no new false greens (a product with a flagged ingredient called clean)', () => expect(falseGreen.length).toBeLessThanOrEqual(2))
})

describe('properties that must always hold', () => {
  const solid = good.filter((c) => !/[():;]/.test(c.text) && c.text.includes(','))
  const order = (a, b) => a.localeCompare(b)

  it('the verdict does not depend on the order of the ingredients', () => {
    const r = rng(5)
    for (const c of solid) {
      const parts = c.text.split(',').map((s) => s.trim())
      for (let k = 0; k < 4; k++) {
        const shuffled = [...parts].sort(() => r() - 0.5).join(', ')
        expect(analyze(shuffled).v, `${c.id}: ${shuffled}`).toBe(analyze(c.text).v)
      }
    }
  })
  it('repeating the same ingredient list changes nothing', () => {
    for (const c of good.filter((c) => c.expected !== 'unknown')) {
      const once = analyze(c.text), twice = analyze(`${c.text}, ${c.text}`)
      expect(twice.v, c.id).toBe(once.v)
      expect(twice.found.map((f) => f.id).sort(order)).toEqual(once.found.map((f) => f.id).sort(order))
    }
  })
  it('adding pork never makes a verdict better', () => {
    for (const c of good.filter((c) => c.text.trim().length > 3)) expect(analyze(`${c.text}, pork`).v, c.id).toBe('bad')
  })
  it('adding gelatin to a clean product never leaves it clean', () => {
    // texts that already mention a halal claim are excluded: today that claim relaxes every certOk rule in the text
    for (const c of good.filter((c) => c.expected === 'ok' && !/halal/i.test(c.text))) expect(analyze(`${c.text}, gelatin`).v, c.id).not.toBe('ok')
  })
  it('letter case does not matter', () => {
    for (const c of good) expect(analyze(c.text.toUpperCase()).v, c.id).toBe(analyze(c.text).v)
  })
  it('never throws and always returns a known state, whatever the input', () => {
    const r = rng(11), junk = ['', ' ', '\n\t', 'ٱلْـ', '🥩🍷', '(((((', ')))', 'E'.repeat(5000), 'a,'.repeat(3000), '\u0000\u0001', '<script>alert(1)</script>']
    for (let i = 0; i < 300; i++) junk.push(Array.from({ length: 1 + Math.floor(r() * 80) }, () => String.fromCharCode(32 + Math.floor(r() * 2000))).join(''))
    for (const t of junk) { const out = analyze(t); expect(STATES).toContain(out.v); expect(Array.isArray(out.found)).toBe(true) }
    for (const t of [null, undefined, 42, {}, []]) expect(STATES).toContain(analyze(t).v)
  })
  it('an unreadable source can never produce a clean verdict', () => {
    for (const c of good.filter((c) => c.expected === 'ok')) expect(analyze(c.text, { trusted: false }).v, c.id).toBe('unknown')
  })
  it('a flagged ingredient is still flagged when the text source is untrusted', () => {
    expect(analyze('Sugar, pork', { trusted: false }).v).toBe('bad')
    expect(analyze('Sugar, gelatin', { trusted: false }).v).toBe('warn')
  })
  it('a halal claim never lowers a haram verdict', () => {
    expect(analyze('Halal certified. Sugar, pork fat').v).toBe('bad')
    expect(analyze('Halal. Wine, sugar').v).toBe('bad')
  })
  it('a halal claim is reported as a claim, not as verification', () => {
    expect(analyze('Halal beef, salt').cert).toBe(true)
    expect(analyze('Not halal beef, salt').cert).toBe(false)
  })
})
