import { describe, it, expect } from 'vitest'
import { normalizeText, normalizeWord } from '../src/lib/ingredients/normalize.js'
import { isKnownWord } from '../src/lib/ingredients/vocabulary.js'
import { parseIngredients, takeFreeFrom } from '../src/lib/ingredients/parse.js'

const texts = (p) => p.items.map((i) => i.text)
const item = (p, t) => p.items.find((i) => i.text === t || i.text.includes(t))

describe('normalizeText', () => {
  it('lower-cases, trims and collapses spaces', () => expect(normalizeText('  SUGAR,   Salt ')).toBe('sugar, salt'))
  it('turns every separator into a comma', () => expect(normalizeText('a؛ b، c; d\ne')).toBe('a, b, c, d, e'))
  it('turns every bracket into parentheses', () => expect(normalizeText('a [b, c] {d}')).toBe('a (b, c) (d)'))
  it('drops percentages and the parentheses they leave empty', () => expect(normalizeText('Biscuit 70% (sugar 12 %), cream (30%)')).toBe('biscuit (sugar), cream'))
  it('converts Arabic-Indic digits and strips diacritics', () => {
    expect(normalizeText('E٤٧١')).toBe('e471')
    expect(normalizeText('خَالٍ مِنْ')).toBe('خال من')
  })
  it('never throws on null or non-strings', () => { for (const v of [null, undefined, 42, {}]) expect(() => normalizeText(v)).not.toThrow(); expect(normalizeText(null)).toBe('') })
  it('normalizeWord drops the Arabic definite article', () => { expect(normalizeWord('الخنزير')).toBe('خنزير'); expect(normalizeWord('Pork')).toBe('pork') })
})

describe('vocabulary', () => {
  it.each(['sugar', 'Sugars', 'weizenmehl', 'سكر', 'السكر', 'sucre', 'palmöl'])('knows %s', (w) => expect(isKnownWord(w)).toBe(true))
  it.each(['asdf', 'qwer', 'zxcv', '', '12'])('does not know %j', (w) => expect(isKnownWord(w)).toBe(false))
})

describe('parseIngredients: structure', () => {
  it('splits on commas and keeps the original text', () => {
    const p = parseIngredients('Sugar, Salt , Flour')
    expect(texts(p)).toEqual(['sugar', 'salt', 'flour'])
    expect(p.original).toBe('Sugar, Salt , Flour')
  })
  it('drops an "Ingredients:" heading in several languages', () => {
    for (const h of ['Ingredients:', 'Ingrédients :', 'Zutaten:', 'المكونات:']) {
      const p = parseIngredients(`${h} sugar, salt`)
      expect(texts(p), h).toEqual(['sugar', 'salt']); expect(p.heading).toBe(true)
    }
  })
  it('turns "(a, b)" into components and keeps the parent', () => {
    const p = parseIngredients('chocolate (sugar, cocoa butter, emulsifier (E471, soy lecithin)), wafer')
    expect(texts(p)).toEqual(['chocolate', 'sugar', 'cocoa butter', 'emulsifier', 'e471', 'soy lecithin', 'wafer'])
    expect(item(p, 'e471').parent).toBe('emulsifier')
    expect(item(p, 'sugar').parent).toBe('chocolate')
  })
  it('keeps a single-item note on its ingredient', () => {
    expect(texts(parseIngredients('emulsifier (E471 from palm oil), salt'))).toEqual(['emulsifier e471 from palm oil', 'salt'])
  })
  it('reads E-numbers, with or without a space', () => {
    expect(parseIngredients('E120, e 471, colour (E150d)').items.flatMap((i) => i.eNumbers)).toEqual(['e120', 'e471', 'e150d'])
  })
  it('survives unbalanced parentheses', () => {
    expect(() => parseIngredients('sugar (salt, flour')).not.toThrow()
    expect(texts(parseIngredients('sugar (salt, flour'))).toEqual(expect.arrayContaining(['sugar', 'salt', 'flour']))
    expect(() => parseIngredients('sugar), salt))')).not.toThrow()
  })
  it('handles empty, null and huge input quickly', () => {
    expect(parseIngredients('').items).toEqual([]); expect(parseIngredients(null).items).toEqual([])
    const t0 = Date.now()
    parseIngredients('sugar, '.repeat(20000)); parseIngredients('a'.repeat(100000)); parseIngredients('(' .repeat(5000))
    expect(Date.now() - t0).toBeLessThan(3000)
  })
})

describe('parseIngredients: what the label says about an ingredient', () => {
  it('reads "X-free" and removes the phrase from the item', () => {
    const p = parseIngredients('Pork-free sausage, spices')
    expect(texts(p)).toEqual(['sausage', 'spices']); expect(item(p, 'sausage').freeFrom).toEqual(['pork'])
  })
  it.each([
    ['gelatin free gummies', ['gelatin']], ['free from alcohol', ['alcohol']], ['made without pork', ['pork']],
    ['contains no pork or alcohol', ['pork', 'alcohol']], ['rum flavour (non-alcoholic)', ['alcohol']],
    ['خال من الخنزير', ['خنزير']], ['sans porc', ['porc']], ['ohne Schwein', ['schwein']],
  ])('finds the subject in %j', (t, subjects) => expect(takeFreeFrom(t.toLowerCase()).subjects).toEqual(subjects))
  it('a statement before a colon describes the product, not an ingredient', () => {
    const p = parseIngredients('Contains no pork or alcohol: tomato, basil')
    expect(texts(p)).toEqual(['tomato', 'basil']); expect(p.statements[0].subjects).toEqual(['pork', 'alcohol'])
  })
  it('detects the source: vegetable, microbial, fish, animal, pork, mixed', () => {
    const src = (t) => parseIngredients(t).items[0].source
    expect(src('vegetable glycerin')).toBe('plant'); expect(src('microbial lipase')).toBe('microbial'); expect(src('fish gelatin')).toBe('fish')
    expect(src('bovine gelatin')).toBe('animal'); expect(src('pork gelatin')).toBe('porcine'); expect(src('animal and vegetable fat')).toBe('mixed')
    expect(src('gelatin')).toBeNull()
  })
  it('a halal claim attached to an item is kept on that item', () => {
    const p = parseIngredients('beef gelatin (halal certified), salt')
    expect(item(p, 'beef gelatin').claimHalal).toBe(true); expect(item(p, 'salt').claimHalal).toBe(false)
    expect(texts(p)).toEqual(['beef gelatin', 'salt']) // the claim words are not ingredients
  })
  it('"not halal" is not a halal claim', () => {
    const p = parseIngredients('not halal beef, salt')
    expect(item(p, 'beef').claimHalal).toBe(false); expect(item(p, 'beef').claimNotHalal).toBe(true)
  })
  it('"may contain" turns this and the following items of the sentence into traces', () => {
    const p = parseIngredients('sugar, salt. May contain traces of milk and nuts. Wheat flour')
    expect(p.items.filter((i) => i.trace).map((i) => i.text)).toEqual(['milk and nuts'])
    expect(item(p, 'wheat flour').trace).toBe(false)
    expect(parseIngredients('sugar, may contain pork, soy').items.map((i) => i.trace)).toEqual([false, true, true])
  })
})

describe('parseIngredients: is this an ingredient list at all?', () => {
  it('accepts normal lists in several languages', () => {
    for (const t of ['sugar, palm oil, salt', 'سكر، دقيق قمح، ملح', 'sucre, farine, sel', 'Zucker, Weizenmehl, Salz', 'Pasteurised milk']) expect(parseIngredients(t).credible, t).toBe(true)
  })
  it('rejects gibberish and nutrition tables', () => {
    for (const t of ['asdf qwer zxcv', 'Nutrition facts: energy 520 kJ, fat 4 g, protein 3 g', 'energy 100 kcal, protein 2 g', '', '   ']) expect(parseIngredients(t).credible, t).toBe(false)
  })
  it('needs fewer recognised words when the list has a heading', () => {
    expect(parseIngredients('maltodextrin, annatto, tartrazine, xyzzy').credible).toBe(false)
    expect(parseIngredients('Ingredients: sugar, annatto, tartrazine, xyzzy').credible).toBe(true)
  })
})
