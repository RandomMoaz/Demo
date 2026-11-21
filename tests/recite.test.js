import { describe, it, expect } from 'vitest'
import { skeleton, similarity, sameWord, tokens, trimExtras, align, locate, Tracker, score } from '../src/lib/recite.js'
import quran from '../src/assets/quran.json'

const wordsOf = (n) => quran[n].v.flatMap(([a, text]) => text.trim().split(/\s+/).map((ar, i) => ({ ar, a, i })))
// what a speech engine writes: ordinary spelling, no Qur'anic marks
const FATIHA = 'بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين اياك نعبد واياك نستعين اهدنا الصراط المستقيم صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين'
const NAS = 'قل اعوذ برب الناس ملك الناس اله الناس من شر الوسواس الخناس الذي يوسوس في صدور الناس من الجنة والناس'
const KAWTHAR = 'انا اعطيناك الكوثر فصل لربك وانحر ان شانئك هو الابتر'

describe('comparing Quranic and everyday spelling', () => {
  it('sees through Uthmani marks and spelling', () => {
    expect(sameWord('ٱلرَّحۡمَٰنِ', 'الرحمن')).toBe(true)
    expect(sameWord('ٱلۡعَٰلَمِينَ', 'العالمين')).toBe(true)
    expect(sameWord('ٱلصِّرَٰطَ', 'الصراط')).toBe(true)
    expect(sameWord('مَٰلِكِ', 'ملك')).toBe(true) // both readings, maliki and maaliki
    expect(sameWord('شَانِئَكَ', 'شانيك')).toBe(true)
    expect(skeleton('إِيَّاكَ')).toBe(skeleton('اياك'))
  })
  it('keeps different words apart', () => {
    expect(sameWord('مِن', 'ما')).toBe(false)
    expect(sameWord('ٱلدِّينِ', 'القيامة')).toBe(false)
    expect(sameWord('ٱلنَّاسِ', 'الجنة')).toBe(false)
    expect(similarity('ربك', 'لربك')).toBeGreaterThan(0.7)
  })
  it('drops what is said around the recitation', () => {
    expect(trimExtras(tokens('أعوذ بالله من الشيطان الرجيم بسم الله الرحمن الرحيم قل اعوذ'))).toEqual(['قل', 'اعوذ'])
    expect(trimExtras(tokens('بسم الله الرحمن الرحيم الحمد لله'), { keepBasmala: true })).toEqual(tokens('بسم الله الرحمن الرحيم الحمد لله'))
    expect(trimExtras(tokens('هو الابتر صدق الله العظيم'))).toEqual(['هو', 'الابتر'])
  })
})

describe('align', () => {
  const exp = wordsOf(108).map((w) => w.ar)
  it('matches a clean recitation word for word and stops where the reciter stopped', () => {
    const steps = align(exp, tokens('انا اعطيناك الكوثر فصل'))
    expect(steps.map((s) => s.op)).toEqual(['ok', 'ok', 'ok', 'ok'])
  })
  it('finds a skipped word, a wrong word and an extra word', () => {
    expect(align(exp, tokens('انا الكوثر فصل')).map((s) => s.op)).toEqual(['ok', 'skip', 'ok', 'ok'])
    expect(align(exp, tokens('انا اعطيناك النهر فصل')).map((s) => s.op)).toEqual(['ok', 'ok', 'wrong', 'ok'])
    expect(align(exp, tokens('انا اعطيناك يعني الكوثر')).map((s) => s.op)).toEqual(['ok', 'ok', 'extra', 'ok'])
  })
  it('finds where a reciter started', () => {
    const nas = wordsOf(114).map((w) => w.ar)
    expect(locate(nas, tokens('من شر الوسواس الخناس'))).toBe(nas.findIndex((w, k) => k >= 8 && sameWord(w, 'من')))
    expect(locate(nas, tokens('كلام لا علاقة له'))).toBe(-1)
  })
})

describe('Tracker', () => {
  it('follows a perfect recitation of Al-Fatihah, said with the isti’adha first', () => {
    const t = new Tracker(wordsOf(1), { basmalaIsText: true })
    const v = t.hear('أعوذ بالله من الشيطان الرجيم ' + FATIHA, true)
    expect(v.finished).toBe(true)
    expect(v.mistakes).toEqual([])
    expect(score(v)).toBe(100)
  })
  it('marks a skipped word and a wrong word, and keeps going', () => {
    const t = new Tracker(wordsOf(1), { basmalaIsText: true })
    const v = t.hear(FATIHA.replace('رب العالمين', 'العالمين').replace('يوم الدين', 'يوم القيامة'), true)
    expect(v.mistakes.map((m) => [m.type, m.a])).toEqual([['skip', 2], ['wrong', 4]])
    expect(v.mistakes[1].heard).toBe('القيامه')
    expect(v.finished).toBe(true)
    expect(score(v)).toBe(Math.round((27 / 29) * 100))
  })
  it('moves on with interim text but only flags mistakes once the text is final', () => {
    const t = new Tracker(wordsOf(108))
    let v = t.hear('انا اعطيناك النهر')
    expect(v.pos).toBe(2)
    expect(v.mistakes).toEqual([])
    v = t.hear('انا اعطيناك النهر', true)
    expect(v.mistakes.map((m) => m.type)).toEqual(['wrong'])
    expect(v.pos).toBe(3)
  })
  it('does not count unrelated words said after stopping as mistakes', () => {
    const t = new Tracker(wordsOf(108))
    const v = t.hear('انا اعطيناك جزاك', true)
    expect(v.mistakes).toEqual([])
    expect(v.extras).toBe(1)
    expect(v.pos).toBe(2)
  })
  it('carries on across listening sessions', () => {
    const t = new Tracker(wordsOf(114))
    t.hear('قل اعوذ برب الناس', true)
    t.endSession()
    const v = t.hear(NAS.split(' ').slice(4).join(' '), true)
    expect(v.finished).toBe(true)
    expect(v.mistakes).toEqual([])
  })
  it('follows a reciter who starts in the middle, without counting the start as skipped', () => {
    const t = new Tracker(wordsOf(114))
    const v = t.hear('من شر الوسواس الخناس الذي يوسوس', true)
    expect(v.mistakes).toEqual([])
    expect(v.state.slice(0, 8).every((s) => s === 'pending')).toBe(true)
    expect(v.done).toBe(6)
  })
  it('can be told where to start', () => {
    const t = new Tracker(wordsOf(108))
    t.startAt(3)
    expect(t.hear('فصل لربك وانحر', true).pos).toBe(6)
  })
  it('ignores the basmala before surahs where it is not part of the text, and noise words', () => {
    const t = new Tracker(wordsOf(108))
    const v = t.hear('بسم الله الرحمن الرحيم ' + KAWTHAR + ' صدق الله العظيم', true)
    expect(v.finished).toBe(true)
    expect(v.mistakes).toEqual([])
    expect(v.extras).toBe(0)
  })
  it('starts again cleanly', () => {
    const t = new Tracker(wordsOf(108))
    t.hear(KAWTHAR, true)
    expect(t.reset().view().done).toBe(0)
  })
})
