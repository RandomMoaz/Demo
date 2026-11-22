import { describe, it, expect } from 'vitest'
import {
  normalizeArabic, bwToArabic, rootToArabic, describeCodes, describeWord, searchWords, sameRoot, surahStats, allWords,
} from '../src/lib/quranNlp.js'
import data from '../src/data/quranNlp.json'
import quran from '../src/assets/quran.json'
import glosses from '../scripts/quran-nlp/glosses.json'

describe('normalizeArabic (same cases as QURAN-NLP tests/test_arabic.py)', () => {
  it('strips tashkeel and wasla', () => expect(normalizeArabic('بِسْمِ ٱللَّهِ')).toBe('بسم الله'))
  it('collapses alef variants', () => expect(normalizeArabic('آدم أدم إدم ادم')).toBe('ادم ادم ادم ادم'))
  it('treats teh marbuta and alef maqsura alike', () => expect(normalizeArabic('موسى صلاه')).toBe(normalizeArabic('موسي صلاة')))
  it('matches Uthmani alef maqsura + superscript alef', () => expect(normalizeArabic('مُوسَىٰ')).toBe(normalizeArabic('موسى')))
  it('strips tashkeel', () => expect(normalizeArabic('مُحَمَّدٌ')).toBe('محمد'))
  it('handles the Uthmani marks used in this app’s text', () => {
    expect(normalizeArabic('ٱلۡحَمۡدُ')).toBe('الحمد')
    expect(normalizeArabic('إِنَّآ أَعۡطَيۡنَٰكَ ٱلۡكَوۡثَرَ')).toBe('انا اعطيناك الكوثر') // superscript alef becomes alef, as in QURAN-NLP
    expect(normalizeArabic('')).toBe('')
  })
})

describe('Buckwalter', () => {
  it('turns corpus forms into Arabic', () => {
    expect(bwToArabic('{ll~ahi')).toBe('ٱللَّهِ'.normalize('NFC'))
    expect(bwToArabic('r~aHoma`ni')).toBe('رَّحْمَٰنِ'.normalize('NFC'))
    expect(bwToArabic('{ll~ahi').normalize('NFC')).toBe(bwToArabic('{ll~ahi')) // always in standard order
  })
  it('spells roots as Arabic letters, hamza as alef-hamza', () => {
    expect(rootToArabic('rHm')).toBe('ر ح م')
    expect(rootToArabic('Alh')).toBe('أ ل ه')
    expect(rootToArabic('')).toBe('')
  })
})

describe('grammar in plain words', () => {
  it('reads person, gender, number and case', () => {
    expect(describeCodes(['MS', 'GEN'])).toEqual(['masculine, singular', 'genitive'])
    expect(describeCodes(['IMPF', '(X)', '1P'])).toEqual(['present tense', 'verb form X', 'first person, plural'])
    expect(describeCodes(['PRON:2MS'])).toEqual(['second person, masculine, singular'])
  })
  it('names participles instead of listing their parts', () => {
    expect(describeCodes(['PASS', 'PCPL', 'M', 'GEN'])).toEqual(['passive participle', 'masculine', 'genitive'])
    expect(describeCodes(['ACT', 'PCPL', 'M', 'GEN'], 'ar')).toEqual(['اسم فاعل', 'مذكر', 'مجرور'])
  })
  it('explains each part of a word', () => {
    const bismi = data.surahs[0].ayat[0].words[0]
    const d = describeWord(bismi)
    expect(d.pos).toBe('Noun')
    expect(d.parts.map((p) => p.role)).toEqual(['the preposition “bi” (with, in)', 'main word'])
    expect(describeWord(bismi, 'ar').pos).toBe('اسم')
    const lirabbika = data.surahs.find((s) => s.n === 108).ayat[1].words[1]
    expect(describeWord(lirabbika).parts.map((p) => p.role)).toEqual(['the preposition “li” (for, to)', 'main word', 'attached pronoun · second person, masculine, singular'])
  })
})

describe('search', () => {
  it('finds every word of a root, written with or without spaces', () => {
    const hits = searchWords(data, 'رحم')
    expect(hits.map((h) => `${h.s}:${h.a}:${h.i + 1}`)).toEqual(['1:1:3', '1:1:4', '1:3:1', '1:3:2'])
    expect(hits.every((h) => h.why === 'root')).toBe(true)
    expect(searchWords(data, 'ر ح م')).toHaveLength(4)
  })
  it('matches words whatever their diacritics', () => {
    expect(searchWords(data, 'الكوثر').map((h) => h.s)).toEqual([108])
    expect(searchWords(data, 'ٱلنَّاسِ').length).toBeGreaterThanOrEqual(3)
  })
  it('searches English meanings from the start of words, so it works while typing', () => {
    const hits = searchWords(data, 'lord')
    expect(hits.map((h) => `${h.s}:${h.a}`)).toEqual(['1:2', '108:2', '114:1'])
    expect(hits.every((h) => h.why === 'meaning')).toBe(true)
    expect(searchWords(data, 'lor').map((h) => `${h.s}:${h.a}`)).toEqual(['1:2', '108:2', '114:1'])
    expect(searchWords(data, 'ord')).toEqual([]) // the middle of a word does not count
  })
  it('returns nothing for an empty or unknown query', () => {
    expect(searchWords(data, '  ')).toEqual([])
    expect(searchWords(data, 'zebra')).toEqual([])
  })
  it('links words of the same root across the three surahs', () => {
    const rabb = sameRoot(data, 'ر ب ب').map((h) => h.s)
    expect(new Set(rabb)).toEqual(new Set([1, 108, 114]))
  })
})

describe('surah numbers', () => {
  it('counts Al-Kawthar', () => {
    const s = surahStats(data, 108)
    expect(s).toMatchObject({ ayat: 3, words: 10 })
    expect(s.top.root).toBe('ر ب ب')
    expect(surahStats(data, 2)).toBeNull()
  })
})

describe('the generated data', () => {
  it('has Al-Fatihah, Al-Kawthar and An-Nas, word for word as the app shows them', () => {
    expect(data.surahs.map((s) => s.n)).toEqual([1, 108, 114])
    for (const su of data.surahs) {
      expect(su.ayat.map((a) => a.words.map((w) => w.ar).join(' '))).toEqual(quran[su.n].v.map((v) => v[1].trim().split(/\s+/).join(' ')))
    }
    expect(allWords(data)).toHaveLength(59)
  })
  it('gives every word a meaning, transliteration and parts, and knows every root it uses', () => {
    for (const { word } of allWords(data)) {
      expect(word.en && word.tr && word.pos && word.segs.length).toBeTruthy()
      if (word.root) expect(data.roots[word.root].count).toBeGreaterThan(0)
    }
  })
  it('only adds its own meanings where the corpus has none', () => {
    const app = allWords(data).filter((h) => h.word.gloss === 'app').map((h) => `${h.s}:${h.a}:${h.i + 1}`)
    expect(app.sort()).toEqual(Object.keys(glosses.words).sort())
  })
  it('agrees with published corpus figures', () => {
    expect(data.totals.words).toBe(77429)
    expect(data.roots['ر ح م'].count).toBe(339)
  })
  it('credits its source', () => {
    expect(data.source.repo).toBe('https://github.com/islamAndAi/QURAN-NLP')
    expect(data.source.corpus).toBe('https://corpus.quran.com')
  })
})
