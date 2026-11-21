// Small Qur'anic Arabic NLP toolkit for the word-by-word view. Pure, no DOM.
// normalizeArabic is ported from QURAN-NLP (src/quran_nlp/arabic.py, Apache-2.0, github.com/islamAndAi/QURAN-NLP).

const ALEF_VARIANTS = /[ٰٱآأإ]/g
const STRIP = /[ً-ٟؐ-ؚۖ-ۭ࣓-ࣿ]/g

/** Diacritic-free, alef-normalised Arabic for matching only — never for display or recitation. */
export function normalizeArabic(text) {
  if (!text) return ''
  return String(text)
    .replace(/ـ/g, '') // tatweel
    .replace(/ىٰ/g, 'ى') // alef maqsura + superscript alef -> alef maqsura
    .replace(ALEF_VARIANTS, 'ا') // alef variants -> plain alef
    .replace(STRIP, '') // harakat + Qur'anic annotation marks
    .replace(/ة/g, 'ه') // teh marbuta -> heh
    .replace(/ى/g, 'ي') // alef maqsura -> yeh
    .replace(/ء/g, '') // standalone hamza
    .replace(/\s+/g, ' ')
    .trim()
}

// Extended Buckwalter, as used by the Quranic Arabic Corpus
const BW = {
  "'": 'ء', '>': 'أ', '&': 'ؤ', '<': 'إ', '}': 'ئ', A: 'ا', b: 'ب', p: 'ة',
  t: 'ت', v: 'ث', j: 'ج', H: 'ح', x: 'خ', d: 'د', '*': 'ذ', r: 'ر',
  z: 'ز', s: 'س', $: 'ش', S: 'ص', D: 'ض', T: 'ط', Z: 'ظ', E: 'ع',
  g: 'غ', _: 'ـ', f: 'ف', q: 'ق', k: 'ك', l: 'ل', m: 'م', n: 'ن',
  h: 'ه', w: 'و', Y: 'ى', y: 'ي', F: 'ً', N: 'ٌ', K: 'ٍ', a: 'َ',
  u: 'ُ', i: 'ِ', '~': 'ّ', o: 'ْ', '^': 'ٓ', '#': 'ٔ', '`': 'ٰ', '{': 'ٱ',
  '|': 'آ', ':': 'ۜ', '@': '۟', '"': '۠', '[': 'ۢ', ';': 'ۣ', ',': 'ۥ',
  '.': 'ۦ', '!': 'ۨ', '-': '۪', '+': '۫', '%': '۬', ']': 'ۭ',
}
export const bwToArabic = (s) => [...String(s || '')].map((c) => BW[c] ?? c).join('').normalize('NFC')

/** A corpus root ("rHm", "Alh") as spaced Arabic letters ("ر ح م", "أ ل ه"); A is a hamza in roots. */
export const rootToArabic = (r) => [...String(r || '')].map((c) => (c === 'A' || c === '>' ? 'أ' : BW[c] ?? c)).join(' ')

/* ---------- grammar in plain words ---------- */

const L = {
  en: {
    pos: { N: 'Noun', PN: 'Proper noun', ADJ: 'Adjective', V: 'Verb', P: 'Preposition', PRON: 'Pronoun', REL: 'Relative pronoun', DEM: 'Demonstrative', CONJ: 'Conjunction', NEG: 'Negative particle', ACC: 'Particle of emphasis', DET: 'Definite article', REM: 'Resumption particle' },
    prefix: { 'bi+': 'the preposition “bi” (with, in)', 'Al+': 'the article “al” (the)', 'l:P+': 'the preposition “li” (for, to)', 'w:CONJ+': 'the conjunction “wa” (and)', 'f:REM+': 'the particle “fa” (so)' },
    suffix: 'attached pronoun', stem: 'main word',
    person: { 1: 'first person', 2: 'second person', 3: 'third person' },
    gender: { M: 'masculine', F: 'feminine' }, number: { S: 'singular', D: 'dual', P: 'plural' },
    code: { NOM: 'nominative', ACC: 'accusative', GEN: 'genitive', PERF: 'past tense', IMPF: 'present tense', IMPV: 'command', PASS: 'passive', '(II)': 'verb form II', '(IV)': 'verb form IV', '(X)': 'verb form X' },
    actPcpl: 'active participle', passPcpl: 'passive participle',
  },
  ar: {
    pos: { N: 'اسم', PN: 'اسم علم', ADJ: 'صفة', V: 'فعل', P: 'حرف جر', PRON: 'ضمير', REL: 'اسم موصول', DEM: 'اسم إشارة', CONJ: 'حرف عطف', NEG: 'حرف نفي', ACC: 'حرف توكيد ونصب', DET: 'أداة التعريف', REM: 'حرف استئناف' },
    prefix: { 'bi+': 'حرف الجر «الباء»', 'Al+': 'أداة التعريف «ال»', 'l:P+': 'حرف الجر «اللام»', 'w:CONJ+': 'حرف العطف «الواو»', 'f:REM+': 'حرف «الفاء»' },
    suffix: 'ضمير متصل', stem: 'أصل الكلمة',
    person: { 1: 'متكلم', 2: 'مخاطب', 3: 'غائب' },
    gender: { M: 'مذكر', F: 'مؤنث' }, number: { S: 'مفرد', D: 'مثنى', P: 'جمع' },
    code: { NOM: 'مرفوع', ACC: 'منصوب', GEN: 'مجرور', PERF: 'ماضٍ', IMPF: 'مضارع', IMPV: 'أمر', PASS: 'مبني للمجهول', '(II)': 'الوزن الثاني (فعّل)', '(IV)': 'الوزن الرابع (أفعل)', '(X)': 'الوزن العاشر (استفعل)' },
    actPcpl: 'اسم فاعل', passPcpl: 'اسم مفعول',
  },
}
const pick = (lang) => (lang === 'ar' ? L.ar : L.en)

/** "3MP" -> "third person, masculine, plural"; null if it is not a person/gender/number code. */
function pgn(code, t) {
  const m = /^([123])?([MF])?([SDP])?$/.exec(code)
  if (!m || !code) return null
  return [m[1] && t.person[m[1]], m[2] && t.gender[m[2]], m[3] && t.number[m[3]]].filter(Boolean).join(t === L.ar ? ' ' : ', ')
}

/** The grammar of a list of corpus codes, in words. */
export function describeCodes(codes, lang = 'en') {
  const t = pick(lang)
  const out = []
  const pcpl = codes.includes('PCPL')
  if (pcpl) out.push(codes.includes('PASS') ? t.passPcpl : t.actPcpl)
  for (const c of codes) {
    if (pcpl && (c === 'PCPL' || c === 'ACT' || c === 'PASS')) continue
    if (c.startsWith('PRON:')) { const p = pgn(c.slice(5), t); if (p) out.push(p); continue }
    const p = pgn(c, t)
    if (p) out.push(p)
    else if (t.code[c]) out.push(t.code[c])
  }
  return out
}

/** A word's part of speech, its grammar, and the role of each part (prefix, stem, attached pronoun). */
export function describeWord(word, lang = 'en') {
  const t = pick(lang)
  const stem = word.segs.find((s) => s.kind === 'stem') || word.segs[0]
  return {
    pos: t.pos[word.pos] || word.pos,
    grammar: describeCodes(stem.codes, lang),
    parts: word.segs.map((s) => {
      if (s.kind === 'prefix') return { ar: s.ar, role: t.prefix[s.codes[0]] || t.pos[s.tag] || s.tag }
      if (s.kind === 'suffix') return { ar: s.ar, role: [t.suffix, ...describeCodes(s.codes, lang)].join(' · ') }
      return { ar: s.ar, role: t.stem }
    }),
  }
}

/* ---------- searching and counting ---------- */

const ARABIC = /[؀-ۿ]/

/** Every word of `data.surahs` with its place: { s, a, i, word }. */
export const allWords = (data) =>
  data.surahs.flatMap((su) => su.ayat.flatMap((ay) => ay.words.map((word, i) => ({ s: su.n, a: ay.n, i, word }))))

/**
 * Find words by Arabic (diacritics ignored: "الرحمن", or a root: "رحم", "ر ح م") or by English meaning ("lord").
 * Each hit says why it matched: 'word', 'root' or 'meaning'.
 */
export function searchWords(data, query) {
  const q = String(query || '').trim()
  if (!q) return []
  const hits = []
  if (ARABIC.test(q)) {
    const n = normalizeArabic(q)
    const letters = n.replace(/\s/g, '')
    for (const h of allWords(data)) {
      const w = normalizeArabic(h.word.ar)
      if (h.word.root && normalizeArabic(h.word.root).replace(/\s/g, '') === letters) hits.push({ ...h, why: 'root' })
      else if (w.includes(n) || normalizeArabic(h.word.lemma) === n) hits.push({ ...h, why: 'word' })
    }
  } else {
    const terms = q.toLowerCase().split(/\s+/).filter((x) => x.length > 1)
    for (const h of allWords(data)) {
      const gloss = h.word.en.toLowerCase()
      if (terms.length && terms.every((x) => new RegExp(`\\b${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(gloss))) hits.push({ ...h, why: 'meaning' })
    }
  }
  return hits
}

/** Other words in these surahs built on the same root. */
export const sameRoot = (data, root) => (root ? allWords(data).filter((h) => h.word.root === root) : [])

/** Simple numbers about a surah: ayat, words, distinct roots, and its most common root in the whole Qur'an. */
export function surahStats(data, n) {
  const su = data.surahs.find((x) => x.n === n)
  if (!su) return null
  const ws = su.ayat.flatMap((a) => a.words)
  const roots = [...new Set(ws.map((w) => w.root).filter(Boolean))]
  const top = roots.map((r) => ({ root: r, count: data.roots[r]?.count || 0 })).sort((x, y) => y.count - x.count)[0] || null
  return { ayat: su.ayat.length, words: ws.length, roots: roots.length, letters: ws.reduce((c, w) => c + normalizeArabic(w.ar).replace(/[^ء-ي]/g, '').length, 0), top }
}
