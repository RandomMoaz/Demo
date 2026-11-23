import { describe, it, expect } from 'vitest'
import { cleanSegments, fromAyahJson, fromSurahJson, activeAt, ayahSpan, wordSpan, coverage } from '../src/lib/recitation.js'
import { emptyHistory, addSession, clearPracticed, streak, weakWords, bestScore, today, dayKey } from '../src/lib/reciteHistory.js'

// shaped exactly like QUL exports (lib/exporter/export_ayah_recitation.rb, export_surah_recitation.rb)
const AYAH_JSON = {
  '1:1': { surah_number: 1, ayah_number: 1, audio_url: 'https://cdn.example/001001.mp3', duration: 6, segments: [[1, 0, 900], [2, 900, 1800], [3, 1800, 3500], [4, 3500, 6000]] },
  '1:2': { surah_number: 1, ayah_number: 2, audio_url: 'https://cdn.example/001002.mp3', duration: 5, segments: [[2, 1200, 2000], [1, 0, 1200], [3, 2000, 3000], [4, 3000, 5000], [5, 0, 0]] },
}
const SURAH_JSON = { 108: { surah_number: 108, audio_url: 'https://cdn.example/108.mp3', duration: 20 } }
const SEGMENTS_JSON = {
  '108:1': { segments: [[1, 500, 1200], [2, 1200, 2500], [3, 2500, 4000]], timestamp_from: 400, timestamp_to: 4200, duration_ms: 3800 },
  '108:2': { segments: [[1, 4300, 5000], [2, 5000, 6200], [3, 6200, 7400]], timestamp_from: 4200, timestamp_to: 7600, duration_ms: 3400 },
}

describe('reading QUL recitations', () => {
  it('cleans word timings: sorted, numbers, no empty placeholders', () => {
    expect(cleanSegments([[2, 1200, 2000], [1, 0, 1200], [5, 0, 0], ['x'], null])).toEqual([[1, 0, 1200], [2, 1200, 2000]])
  })
  it('reads ayah-by-ayah packages', () => {
    const f = fromAyahJson(AYAH_JSON)[1]
    expect(f.kind).toBe('ayah')
    expect(f.ayahs[2].audio).toBe('https://cdn.example/001002.mp3')
    expect(f.ayahs[2].words).toHaveLength(4)
  })
  it('reads surah-by-surah packages', () => {
    const f = fromSurahJson(SURAH_JSON, SEGMENTS_JSON)[108]
    expect(f).toMatchObject({ kind: 'surah', audio: 'https://cdn.example/108.mp3' })
    expect(f.ayahs[2]).toMatchObject({ from: 4200, to: 7600 })
  })
})

describe('following the reciter', () => {
  const surah = fromSurahJson(SURAH_JSON, SEGMENTS_JSON)[108]
  const ayah = fromAyahJson(AYAH_JSON)[1]
  it('finds the ayah and word at any moment of a surah file', () => {
    expect(activeAt(surah, 1300)).toEqual({ ayah: 1, word: 2 })
    expect(activeAt(surah, 6500)).toEqual({ ayah: 2, word: 3 })
    expect(activeAt(surah, 100)).toEqual({ ayah: null, word: 0 }) // before the first ayah
  })
  it('finds the word inside an ayah file', () => {
    expect(activeAt(ayah, 2000, 1)).toEqual({ ayah: 1, word: 3 })
    expect(activeAt(ayah, 9000, 1)).toEqual({ ayah: 1, word: 4 }) // after the last word it stays lit
    const gappy = { kind: 'ayah', ayahs: { 1: { words: [[1, 0, 600], [2, 700, 1300]] } } }
    expect(activeAt(gappy, 650, 1)).toEqual({ ayah: 1, word: 1 }) // no blink in the silence between words
  })
  it('knows where an ayah and a word are', () => {
    expect(ayahSpan(surah, 2)).toEqual([4200, 7600])
    expect(ayahSpan(ayah, 1)).toEqual([0, null])
    expect(wordSpan(surah, 1, 3)).toEqual([2500, 4000])
    expect(wordSpan(ayah, 2, 9)).toBeNull()
  })
  it('reports how well the timings fit the text', () => {
    expect(coverage(ayah, { 1: 4, 2: 5, 3: 3 })).toEqual({ full: 1, partial: [2], missing: [3] })
  })
})

describe('recitation history', () => {
  const words = [{ ar: 'إِنَّآ', a: 1, i: 0 }, { ar: 'أَعۡطَيۡنَٰكَ', a: 1, i: 1 }, { ar: 'ٱلۡكَوۡثَرَ', a: 1, i: 2 }, { ar: 'فَصَلِّ', a: 2, i: 0 }]
  const view = (state, mistakes = []) => ({ state, mistakes })
  const day = (d) => new Date(2026, 10, d, 9)
  it('records a session, its score and the mistaken words', () => {
    const h = addSession(emptyHistory(), { surah: 108, words, now: day(20), view: view(['ok', 'wrong', 'ok', 'pending'], [{ k: 1, type: 'wrong', heard: 'اعطيناه' }]) })
    expect(h.sessions[0]).toMatchObject({ surah: 108, words: 3, ok: 2, score: 67, mistakes: 1 })
    expect(h.mistakes['108:1:2']).toMatchObject({ count: 1, heard: 'اعطيناه' })
    expect(today(h, day(20))).toEqual({ words: 3, ayat: 1 })
    expect(bestScore(h, 108)).toBe(67)
  })
  it('ignores a session where nothing was recited', () => {
    const h0 = emptyHistory()
    expect(addSession(h0, { surah: 108, words, view: view(['pending', 'pending', 'pending', 'pending']) })).toBe(h0)
  })
  it('lists the words most often wrong, and practice clears them', () => {
    let h = emptyHistory()
    for (const d of [18, 19]) h = addSession(h, { surah: 108, words, now: day(d), view: view(['ok', 'wrong', 'skip', 'ok'], [{ k: 1, type: 'wrong' }, { k: 2, type: 'skip' }]) })
    expect(weakWords(h, 108).map((w) => [w.key, w.count]).sort()).toEqual([['108:1:2', 2], ['108:1:3', 2]])
    h = clearPracticed(h, { surah: 108, words, view: view(['ok', 'ok', 'ok', 'ok']) })
    h = clearPracticed(h, { surah: 108, words, view: view(['ok', 'ok', 'pending', 'pending']) })
    expect(Object.keys(h.mistakes)).toEqual(['108:1:3'])
  })
  it('counts the daily streak', () => {
    let h = emptyHistory()
    for (const d of [17, 18, 19]) h = addSession(h, { surah: 1, words, now: day(d), view: view(['ok', 'pending', 'pending', 'pending']) })
    expect(streak(h, day(19))).toBe(3)
    expect(streak(h, day(20))).toBe(3) // nothing yet today: yesterday still counts
    expect(streak(h, day(21))).toBe(0)
    expect(dayKey(day(19))).toBe('2026-11-19')
  })
})
