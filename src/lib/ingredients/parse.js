/* Ingredient-list parser (pure, no DOM). Turns free text into a list of items, each with what the label says
   about it (free-from phrases, halal claims, source such as "vegetable" or "microbial"), plus the statements
   and claims that do not belong to one ingredient. It never decides halal / haram: that is the engine's job. */
import { normalizeText, normalizeWord } from './normalize.js'
import { isKnownWord } from './vocabulary.js'

const L = '\\p{L}'
const B = `(?:^|[^${L}])` // "start of a word" without lookbehind (Safari before 16.4 cannot parse it)
const SUBJ = `${L}+(?:\\s*(?:,|\\band\\b|\\bor\\b|&|/|و|أو)\\s*${L}+){0,3}`
const SPLIT_SUBJ = /\s*(?:,|\band\b|\bor\b|&|\/|و(?=\s)|أو)\s*/u
const SKIP = '(?:(?:any|added|artificial)\\s+)*'

// phrases that say an ingredient is NOT present. Group 1 (and 2) hold the subject words.
const FREE_FROM = [
  new RegExp(`${B}(${L}+)[- ]free(?!${L})`, 'giu'),                                  // pork-free, gelatin free
  new RegExp(`${B}free\\s+(?:from|of)\\s+${SKIP}(${SUBJ})`, 'giu'),                  // free from alcohol
  new RegExp(`${B}(?:contains?\\s+no|containing\\s+no|does\\s+not\\s+contain|doesn't\\s+contain|made\\s+without|without|no)\\s+${SKIP}(${SUBJ})`, 'giu'),
  new RegExp(`(?:خال(?:ي|يه|ية)?\\s+من|بدون|لا\\s+يحتوي\\s+على|يخلو\\s+من)\\s+${SKIP}(${SUBJ})`, 'gu'), // Arabic
  new RegExp(`${B}(?:sans|ohne|sin)\\s+(${SUBJ})`, 'giu'),                           // French, German, Spanish
]
const FIXED_FREE_FROM = [[/non[- ]?alcoholic/giu, ['alcohol']]]
const FREE_STOP = new Set(['any', 'added', 'the', 'a', 'of', 'from', 'and', 'or'])

const HALAL = new RegExp(`${B}(?:halal|حلال)(?!${L})`, 'iu')
const NOT_HALAL = new RegExp(`${B}(?:non|not|no)[- ]?halal|غير\\s+حلال`, 'iu')
const CERT_WORDS = new RegExp(`${B}(?:halal|certified|certification|certificate|حلال|معتمد|شهادة)(?!${L})`, 'giu')
const FILLER = new RegExp(`${B}(?:and|with|of|the|an?|contains?|product|from)(?!${L})`, 'giu')
const MAY_CONTAIN = new RegExp(`^(?:may\\s+contain|can\\s+contain|might\\s+contain|peut\\s+contenir|kann\\s+spuren\\s+von|قد\\s+يحتوي\\s+على)\\s*(?:traces?\\s+of\\s+|آثار\\s+من\\s+|اثار\\s+من\\s+)?`, 'iu')
const HEADING = /^(?:ingredients?|ingr[eé]dients?|zutaten|ingredientes|ingredienti|composition|inhaltsstoffe|contenido|contains?|المكونات|مكونات)$/iu

const SOURCES = [
  ['porcine', new RegExp(`${B}(?:porcine|pork|pig|swine)(?!${L})|خنزير`, 'iu')],
  ['fish', new RegExp(`${B}(?:fish|marine|seafood)(?!${L})|سمك`, 'iu')],
  ['microbial', new RegExp(`${B}(?:microbial|microbially|bacterial|fungal|fermentation|fermented)(?!${L})`, 'iu')],
  ['synthetic', new RegExp(`${B}(?:synthetic|synthetically)(?!${L})`, 'iu')],
  ['plant', new RegExp(`${B}(?:vegetable|vegetal|plant|plant-based|vegan|palm|soy|soya|coconut|sunflower|rapeseed|canola|olive)(?!${L})|نباتي`, 'iu')],
  ['animal', new RegExp(`${B}(?:animal|bovine|beef|calf|cow|sheep|lamb|chicken|poultry)(?!${L})|حيواني`, 'iu')],
]

function detectSource(text) {
  const hit = Object.fromEntries(SOURCES.map(([k, re]) => [k, re.test(text)]))
  if (hit.porcine) return 'porcine'
  if (hit.animal && hit.plant) return 'mixed'          // "animal and vegetable fat": cannot be trusted either way
  return SOURCES.map(([k]) => k).find((k) => hit[k]) ?? null
}

/** Remove "X-free", "contains no X", "خال من X", ... from a text and return what they said. */
export function takeFreeFrom(text) {
  const subjects = []
  const add = (grp) => { for (const w of String(grp).split(SPLIT_SUBJ)) { const n = normalizeWord(w); if (n && !FREE_STOP.has(n)) subjects.push(n) } }
  let out = text
  for (const re of FREE_FROM) out = out.replace(re, (...m) => { m.slice(1, -2).forEach((g) => typeof g === 'string' && add(g)); return ' ' })
  for (const [re, subs] of FIXED_FREE_FROM) out = out.replace(re, () => { subjects.push(...subs); return ' ' })
  return { text: out.replace(/\s+/g, ' ').trim(), subjects: [...new Set(subjects)] }
}

function splitTop(str) {
  const out = []
  let depth = 0, cur = ''
  for (const ch of str) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

function extractGroups(part) {
  let depth = 0, head = '', cur = ''
  const groups = []
  for (const ch of part) {
    if (ch === '(') { if (depth > 0) cur += ch; depth++; continue }
    if (ch === ')') { if (depth === 0) continue; depth--; if (depth === 0) { groups.push(cur); cur = '' } else cur += ch; continue }
    if (depth === 0) head += ch; else cur += ch
  }
  if (depth > 0 && cur) groups.push(cur)               // an unclosed "(" keeps what it had
  return { head: head.replace(/\s+/g, ' ').trim(), groups }
}

function finalizeItem(raw, ctx) {
  let text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (MAY_CONTAIN.test(text)) { ctx.state.trace = true; text = text.replace(MAY_CONTAIN, '').trim() }
  let claimHalal = false, claimNotHalal = false
  if (NOT_HALAL.test(text)) claimNotHalal = true
  else if (HALAL.test(text)) { claimHalal = true; text = text.replace(CERT_WORDS, ' ') }
  const ff = takeFreeFrom(text)
  text = ff.text
  // filler words are only ignored for the "is anything left?" check; the item keeps its own words
  if ((text.replace(FILLER, ' ').match(/[\p{L}\p{N}]/gu) || []).length < 2) { // nothing left that names an ingredient: it was only a statement
    if (claimHalal) ctx.claims.halal = true
    if (ff.subjects.length) ctx.statements.push({ type: 'free-from', subjects: ff.subjects, text: raw })
    return null
  }
  const eNumbers = [...text.matchAll(/(?:^|[^\p{L}\d])e\s?-?(\d{3,4}[a-z]?)(?!\d)/giu)].map((m) => `e${m[1].toLowerCase()}`)
  const tokens = text.split(/[^\p{L}\p{N}-]+/u).filter(Boolean)
  return {
    original: ctx.original, text, parent: ctx.parent ?? null, trace: ctx.state.trace,
    claimHalal, claimNotHalal, freeFrom: ff.subjects, source: detectSource(text), eNumbers,
    recognized: eNumbers.length > 0 || tokens.some(isKnownWord),
  }
}

function parseList(str, ctx) {
  const out = []
  for (const part of splitTop(str)) {
    const { head, groups } = extractGroups(part)
    const notes = [], sub = []
    for (const g of groups) (splitTop(g).length > 1 ? sub : notes).push(g)   // "(a, b)" = components; "(E471)" = a note
    const item = finalizeItem([head, ...notes].filter(Boolean).join(' '), { ...ctx, original: part })
    if (item) out.push(item)
    for (const g of sub) out.push(...parseList(g, { ...ctx, parent: head || ctx.parent }))
  }
  return out
}

const NUTRITION = /(?:^|[^\p{L}])(?:energy|kcal|kj|calories|protein|carbohydrates?|saturates|الطاقة|سعرات)(?!\p{L})|nutrition(?:al)?\s+(?:facts|information|value)|per\s+100\s?(?:g|ml)/giu

/**
 * @returns {{ original: string, normalized: string, heading: boolean, items: object[], statements: object[],
 *   claims: { halal: boolean }, nutritionTable: boolean, recognizedRatio: number, credible: boolean }}
 */
export function parseIngredients(raw) {
  const original = String(raw ?? '')
  const normalized = normalizeText(original)
  const ctx = { claims: { halal: false }, statements: [] }
  const items = []
  let heading = false
  for (const sentence of normalized.split(/\.\s+/).map((s) => s.replace(/\.+$/, '').trim()).filter(Boolean)) {
    let list = sentence
    const c = sentence.indexOf(':')
    if (c >= 0) {
      const head = sentence.slice(0, c).trim()
      list = sentence.slice(c + 1).trim()
      if (HEADING.test(head)) heading = true
      else {                                           // "Contains no pork or alcohol: ...", "Pizza: ..."
        const ff = takeFreeFrom(head)
        if (ff.subjects.length) ctx.statements.push({ type: 'free-from', subjects: ff.subjects, text: head })
        if (HALAL.test(head) && !NOT_HALAL.test(head)) ctx.claims.halal = true
      }
    }
    if (list) items.push(...parseList(list, { ...ctx, state: { trace: false }, parent: null }))
  }
  const markers = new Set((normalized.match(NUTRITION) || []).map((m) => m.toLowerCase()))
  const nutritionTable = markers.size >= 2 || /nutrition(?:al)?\s+(?:facts|information|value)/i.test(normalized)
  const real = items.filter((i) => !i.trace)
  const recognizedRatio = real.length ? real.filter((i) => i.recognized).length / real.length : 0
  const credible = !nutritionTable && real.length > 0 && recognizedRatio >= (heading ? 0.25 : 0.5)
  return { original, normalized, heading, items, statements: ctx.statements, claims: ctx.claims, nutritionTable, recognizedRatio, credible }
}
