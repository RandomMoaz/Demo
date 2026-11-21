// Builds src/data/quranNlp.json — word-by-word analysis of Al-Fatihah, Al-Kawthar and An-Nas — from a local clone of
// https://github.com/islamAndAi/QURAN-NLP (morphology from the Quranic Arabic Corpus, corpus.quran.com).
//
//   git clone --depth 1 https://github.com/islamAndAi/QURAN-NLP.git ../QURAN-NLP
//   node scripts/quran-nlp/build.mjs ../QURAN-NLP [1,108,114]
//
// No dependencies. Fails loudly if the corpus and the app's Qur'an text disagree.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bwToArabic, rootToArabic, normalizeArabic } from '../../src/lib/quranNlp.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = path.resolve(here, '../..')
const repo = process.argv[2]
const SURAHS = (process.argv[3] || '1,108,114').split(',').map(Number)
if (!repo || !fs.existsSync(path.join(repo, 'data/quran/corpus/quran_morphology.csv'))) {
  console.error('usage: node scripts/quran-nlp/build.mjs <path to QURAN-NLP clone> [surahs]')
  process.exit(1)
}

/** RFC 4180 CSV -> array of objects. */
function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8')
  const rows = []
  let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ } else if (c === '"') q = false; else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [head, ...body] = rows.filter((r) => r.length > 1)
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

const fail = (msg) => { console.error('BUILD FAILED:', msg); process.exit(1) }
const loc = (s) => s.replace(/[()]/g, '').split(':').map(Number)

// 1. the whole morphology: one row per segment (prefix / stem / suffix) of every word in the Qur'an
const morph = readCsv(path.join(repo, 'data/quran/corpus/quran_morphology.csv'))
console.log('morphology rows', morph.length)

const parse = (features) => {
  const parts = features.split('|')
  const out = { kind: parts[0].toLowerCase(), codes: [] }
  for (const p of parts.slice(1)) {
    if (p.startsWith('POS:')) out.pos = p.slice(4)
    else if (p.startsWith('LEM:')) out.lemma = p.slice(4)
    else if (p.startsWith('ROOT:')) out.root = p.slice(5)
    else if (p.startsWith('SP:')) out.special = p.slice(3)
    else out.codes.push(p)
  }
  return out
}

// 2. word-level index + whole-Qur'an counts of each root and lemma (counted once per word)
const words = new Map() // "s:a:w" -> segments
const rootWords = new Map(), lemmaWords = new Map(), rootLemmas = new Map()
for (const r of morph) {
  const [s, a, w] = loc(r.LOCATION)
  const key = `${s}:${a}:${w}`
  const seg = { form: r.FORM, tag: r.TAG, ...parse(r.FEATURES) }
  if (!words.has(key)) words.set(key, [])
  words.get(key).push(seg)
  if (seg.kind === 'stem') {
    if (seg.root) {
      if (!rootWords.has(seg.root)) rootWords.set(seg.root, new Set())
      rootWords.get(seg.root).add(key)
      if (!rootLemmas.has(seg.root)) rootLemmas.set(seg.root, new Map())
      if (seg.lemma) rootLemmas.get(seg.root).set(seg.lemma, (rootLemmas.get(seg.root).get(seg.lemma) || 0) + 1)
    }
    if (seg.lemma) {
      if (!lemmaWords.has(seg.lemma)) lemmaWords.set(seg.lemma, new Set())
      lemmaWords.get(seg.lemma).add(key)
    }
  }
}
console.log('words', words.size, 'roots', rootWords.size, 'lemmas', lemmaWords.size)

// 3. word meanings + transliterations (dictionary) and the app's own Uthmani text
const dict = new Map()
for (const r of readCsv(path.join(repo, 'data/quran/corpus/quran_dictionary.csv'))) {
  const m = /^\((\d+):(\d+):(\d+)\)$/.exec(r.location)
  if (m) dict.set(`${m[1]}:${m[2]}:${m[3]}`, r)
}
const glosses = JSON.parse(fs.readFileSync(path.join(here, 'glosses.json'), 'utf8')).words
const quran = JSON.parse(fs.readFileSync(path.join(app, 'src/assets/quran.json'), 'utf8'))

const usedRoots = new Set()
const surahs = SURAHS.map((s) => {
  const src = quran[s]
  if (!src) fail(`surah ${s} missing from src/assets/quran.json`)
  const ayat = src.v.map(([n, text]) => {
    const shown = text.trim().split(/\s+/)
    return {
      n,
      words: shown.map((ar, i) => {
        const key = `${s}:${n}:${i + 1}`
        const segs = words.get(key)
        if (!segs) fail(`${key}: no morphology`)
        const stem = segs.find((g) => g.kind === 'stem') || segs[0]
        const d = dict.get(key)
        const g = glosses[key]
        if (!d && !g) fail(`${key} (${ar}): no dictionary entry and no gloss in glosses.json`)
        if (g && normalizeArabic(ar).replace(/[^ء-ي]/g, '') !== normalizeArabic(g.ar)) fail(`${key}: gloss is for "${g.ar}" but the text has "${ar}"`)
        const root = stem.root ? rootToArabic(stem.root) : ''
        // the corpus dictionary names the root in Arabic: check our Buckwalter conversion against it
        if (root && d?.title && d.title.replace(/\s/g, '') !== root.replace(/\s/g, '')) fail(`${key}: root ${root} != dictionary ${d.title}`)
        if (stem.root) usedRoots.add(stem.root)
        return {
          ar,
          tr: d?.transliteration || g.tr,
          en: d?.translation || g.en,
          gloss: d ? 'corpus' : 'app',
          pos: stem.pos || stem.tag,
          root,
          lemma: stem.lemma ? bwToArabic(stem.lemma) : '',
          lemmaCount: stem.lemma ? lemmaWords.get(stem.lemma).size : 0,
          segs: segs.map((g2) => ({
            ar: bwToArabic(g2.form), kind: g2.kind, tag: g2.tag,
            ...(g2.pos ? { pos: g2.pos } : {}), codes: g2.codes,
          })),
        }
      }),
    }
  })
  return { n: s, name: src.n, en: src.e, meaning: src.t, ayat }
})

const roots = {}
for (const r of [...usedRoots].sort()) {
  const lemmas = [...rootLemmas.get(r)].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l, c]) => ({ ar: bwToArabic(l), count: c }))
  roots[rootToArabic(r)] = { count: rootWords.get(r).size, lemmas }
}

const out = {
  source: {
    name: 'QURAN-NLP (islamAndAi), morphology from the Quranic Arabic Corpus',
    repo: 'https://github.com/islamAndAi/QURAN-NLP',
    corpus: 'https://corpus.quran.com',
    note: 'Root and lemma counts are over the whole Qur\'an (77,429 words). Meanings marked "app" were added by this app.',
    built: 'scripts/quran-nlp/build.mjs',
  },
  totals: { words: words.size, roots: rootWords.size, lemmas: lemmaWords.size },
  surahs,
  roots,
}
const file = path.join(app, 'src/data/quranNlp.json')
fs.mkdirSync(path.dirname(file), { recursive: true })
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n')
const n = surahs.reduce((a, s) => a + s.ayat.reduce((b, x) => b + x.words.length, 0), 0)
console.log(`wrote ${path.relative(app, file)}: ${surahs.length} surahs, ${n} words, ${Object.keys(roots).length} roots`)
