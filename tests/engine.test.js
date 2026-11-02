import { describe, it, expect } from 'vitest'
import { analyze } from '../src/lib/data.js'

describe('analyze: result shape and per-ingredient behaviour', () => {
  it('keeps the fields the screen relies on', () => {
    const r = analyze('sugar, gelatin')
    expect(r.v).toBe('warn'); expect(Array.isArray(r.found)).toBe(true)
    for (const f of r.found) { expect(f.n.en && f.n.ar && f.w.en && f.w.ar).toBeTruthy(); expect(['haram', 'doubtful']).toContain(f.s) }
    expect(r.items.length).toBe(2); expect(typeof r.credible).toBe('boolean')
  })
  it('records which text each flagged rule matched', () => {
    expect(analyze('sugar, beef gelatin (bovine), salt').found.find((f) => f.id === 'gelatin').evidence).toEqual(['beef gelatin (bovine)'])
  })
  it('judges each item on its own: a source named on one item does not clean another', () => {
    expect(analyze('vegetable oil, gelatin').v).toBe('warn')
    expect(analyze('microbial rennet, animal enzymes').v).toBe('warn')
    expect(analyze('fish gelatin, pork gelatin').v).toBe('bad')
  })
  it('"pork-free" only clears pork, nothing else on the item', () => {
    expect(analyze('pork-free gelatin').v).toBe('warn')
    expect(analyze('pork-free ham').v).toBe('ok') // nothing left to flag once the claim is accepted
  })
  it('a statement can never hide an ingredient that is listed', () => {
    expect(analyze('Contains no pork. Ingredients: sugar, pork fat').v).toBe('bad')
    expect(analyze('alcohol free: sugar, wine').v).toBe('bad')
  })
  it('a halal claim on one item does not cover another dependent item', () => {
    expect(analyze('halal beef, gelatin').v).toBe('warn')
    expect(analyze('beef gelatin (halal), gelatin').v).toBe('warn')
  })
  it('traces: haram traces are doubtful, doubtful traces are ignored', () => {
    expect(analyze('sugar, salt. May contain traces of pork').v).toBe('warn')
    expect(analyze('sugar, salt. May contain traces of gelatin').v).toBe('ok')
  })
  it('turkey ham is not pork, but it is still meat of unknown slaughter', () => {
    const r = analyze('turkey ham, water')
    expect(r.found.map((f) => f.id)).toEqual(['meat']); expect(r.v).toBe('warn')
  })
  it('wine vinegar is doubtful, not alcohol; blood orange is not blood', () => {
    expect(analyze('wine vinegar, water').found.map((f) => f.id)).toEqual(['winevinegar'])
    expect(analyze('blood orange juice, sugar').v).toBe('ok')
  })
  it('E441 is gelatin; Schweinefett and Schmalz are pork fat; présure is rennet', () => {
    expect(analyze('E441, sugar').found.map((f) => f.id)).toEqual(['gelatin'])
    expect(analyze('Zucker, Schweinefett, Salz').v).toBe('bad')
    expect(analyze('lait, sel, présure').found.map((f) => f.id)).toEqual(['rennet'])
  })
})
