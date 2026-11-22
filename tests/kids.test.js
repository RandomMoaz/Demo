import { describe, it, expect } from 'vitest'
import {
  fresh, normalise, rollDay, award, completeQuest, traceLetter, collectName, quizAnswer, finishQuiz, finishWudu,
  finishPrayerGame, readSurah, weekStars, dayKey, QUESTS, QUEST_STARS, STICKERS,
} from '../src/kids/progress.js'
import { BAND, letterForms, makeSum, coverage, precision, quizRound, shuffle, pickLang } from '../src/kids/lib.js'
import { KIDS_TEXT } from '../src/kids/text.js'
import letters from '../src/kids/content/letters.json'
import names from '../src/kids/content/names.json'
import quiz from '../src/kids/content/quiz.json'
import wudu from '../src/kids/content/wudu.json'
import surahs from '../src/kids/content/surahs.json'
import quran from '../src/assets/quran.json'

const day = (d, h = 10) => new Date(2026, 10, d, h, 0, 0) // November 2026

describe('stars and streak', () => {
  it('adds stars to today and starts a streak', () => {
    const s = award(fresh(), 2, day(16))
    expect(s).toMatchObject({ stars: 2, streak: 1, lastActive: '2026-11-16' })
    expect(s.starLog['2026-11-16']).toBe(2)
  })
  it('grows the streak once per day, and a missed day starts it again', () => {
    let s = award(fresh(), 1, day(16))
    s = award(s, 1, day(16, 18))
    expect(s.streak).toBe(1)
    s = award(s, 1, day(17))
    expect(s.streak).toBe(2)
    s = award(s, 1, day(19))
    expect(s.streak).toBe(1)
  })
  it('shows a broken streak as 0 the next morning, before any star', () => {
    const s = award(award(fresh(), 1, day(15)), 1, day(16))
    expect(rollDay(s, day(17)).streak).toBe(2)
    expect(rollDay(s, day(18)).streak).toBe(0)
  })
  it('counts the stars of the last 7 days', () => {
    let s = fresh()
    for (const d of [8, 10, 12, 16]) s = award(s, 3, day(d))
    expect(weekStars(s, day(16))).toBe(9) // the 10th, 12th and 16th; the 8th is too long ago
  })
  it('keeps only two weeks of daily counts', () => {
    let s = award(fresh(), 1, day(1))
    s = award(s, 1, day(16))
    expect(Object.keys(s.starLog)).toEqual(['2026-11-16'])
  })
})

describe('quests', () => {
  it('gives each quest’s stars once a day, and starts empty after midnight', () => {
    let s = completeQuest(fresh(), 'pray', day(16))
    s = completeQuest(s, 'pray', day(16, 20))
    expect(s.stars).toBe(QUEST_STARS.pray)
    s = rollDay(s, day(17, 0))
    expect(s.quests).toEqual({ date: '2026-11-17', done: {} })
    expect(completeQuest(s, 'pray', day(17)).stars).toBe(QUEST_STARS.pray * 2)
  })
  it('ticks itself when the activity is done', () => {
    let s = traceLetter(fresh(), 2, day(16))
    expect(s.quests.done.letter).toBe(true)
    expect(s.stars).toBe(1 + QUEST_STARS.letter)
    s = traceLetter(s, 2, day(16)) // the same letter again: no new star
    expect(s.stars).toBe(1 + QUEST_STARS.letter)
    expect(readSurah(fresh(), 112, day(16)).quests.done.surah).toBe(true)
    expect(finishWudu(fresh(), day(16)).quests.done.wudu).toBe(true)
  })
  it('gives every age group four quests that all have a star value', () => {
    for (const list of Object.values(QUESTS)) {
      expect(list).toHaveLength(4)
      for (const q of list) expect(QUEST_STARS[q]).toBeGreaterThan(0)
    }
  })
})

describe('collecting and stickers', () => {
  it('collects a Name once', () => {
    let s = collectName(fresh(), 1, day(16))
    s = collectName(s, 1, day(16))
    expect(s.namesCollected).toEqual([1])
  })
  it('never takes stars away for a missed answer', () => {
    const s = award(fresh(), 5, day(16))
    expect(quizAnswer(s, false, day(16)).stars).toBe(5)
    expect(quizAnswer(s, true, day(16)).stars).toBe(6)
  })
  it('earns stickers by finishing activities', () => {
    let s = finishQuiz(fresh(), day(16))
    expect(s.stickers).toContain('quiz')
    s = finishPrayerGame(s, day(16))
    expect(s.stickers).toContain('prayer')
    for (let i = 1; i <= 5; i++) s = traceLetter(s, i, day(16))
    expect(s.stickers).toContain('letters')
    expect(new Set(s.stickers).size).toBe(s.stickers.length)
  })
  it('repairs a damaged save', () => {
    const s = normalise({ stars: 4, lettersDone: 'x', quests: null })
    expect(s.stars).toBe(4)
    expect(s.lettersDone).toEqual([])
    expect(s.quests).toEqual({ date: null, done: {} })
    expect(STICKERS.every((x) => typeof x.ok(s) === 'boolean')).toBe(true)
  })
  it('uses the local date', () => expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05'))
})

describe('helpers', () => {
  it('builds the four letter forms, and non-joining letters never join forward', () => {
    expect(letterForms({ ar: 'ب', joins: true })).toEqual({ alone: 'ب', start: 'بـ', middle: 'ـبـ', end: 'ـب' })
    expect(letterForms({ ar: 'د', joins: false })).toEqual({ alone: 'د', start: 'د', middle: 'ـد', end: 'ـد' })
  })
  it('makes grown-up sums', () => {
    for (const r of [0, 0.5, 0.999]) {
      const s = makeSum(() => r)
      expect(s.answer).toBe(s.a * s.b)
      expect(s.answer).toBeGreaterThanOrEqual(72)
    }
  })
  it('measures how much of the letter was traced', () => {
    const targets = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]
    expect(coverage(targets, [[{ x: 0, y: 0 }, { x: 100, y: 0 }]], 8)).toBe(0.75) // the line fills the gaps between points
    expect(coverage(targets, [], 8)).toBe(0)
    expect(coverage([], [[{ x: 0, y: 0 }]], 8)).toBe(0)
  })
  it('does not count scribbling over the whole pad as tracing', () => {
    const letter = Array.from({ length: 11 }, (_, i) => ({ x: 100, y: 20 + i * 8 })) // a vertical stroke, like alif
    const follow = [[{ x: 100, y: 20 }, { x: 100, y: 100 }]]
    const scribble = Array.from({ length: 12 }, (_, i) => [{ x: 0, y: i * 10 }, { x: 200, y: i * 10 }])
    expect(coverage(letter, follow, 10)).toBe(1)
    expect(precision(letter, follow, 12)).toBe(1)
    expect(coverage(letter, scribble, 10)).toBeGreaterThan(0.9)
    expect(precision(letter, scribble, 12)).toBeLessThan(0.2)
  })
  it('builds quiz rounds that keep the right answer', () => {
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (const band of ['little', 'explorer', 'young']) {
      const round = quizRound(quiz[band], { len: BAND[band].quizLen, options: BAND[band].options, rand })
      expect(round).toHaveLength(BAND[band].quizLen)
      for (const q of round) {
        expect(q.a).toHaveLength(BAND[band].options)
        const original = quiz[band].find((x) => x.id === q.id)
        expect(q.a[q.ok]).toBe(original.a[original.ok])
      }
    }
    expect(shuffle([1, 2, 3], rand).sort()).toEqual([1, 2, 3])
  })
  it('falls back to English content for languages without their own', () => {
    expect(pickLang({ en: 'Hi', ar: 'أهلًا' }, 'ar')).toBe('أهلًا')
    expect(pickLang({ en: 'Hi', ar: 'أهلًا' }, 'de')).toBe('Hi')
  })
})

describe('content files', () => {
  it('has the 28 letters, in order, each with a name and a picture word', () => {
    expect(letters.letters).toHaveLength(28)
    expect(letters.letters.map((l) => l.id)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1))
    for (const l of letters.letters) expect(l.ar && l.name && l.tr && l.word && l.pic && typeof l.joins === 'boolean').toBeTruthy()
    expect(letters.letters.filter((l) => !l.joins).map((l) => l.ar).join('')).toBe('ادذرزو')
  })
  it('has 99 different Names, each with a meaning in English and Arabic', () => {
    expect(names.names).toHaveLength(99)
    expect(new Set(names.names.map((n) => n.ar)).size).toBe(99)
    expect(names.names.map((n) => n.id)).toEqual(Array.from({ length: 99 }, (_, i) => i + 1))
    for (const n of names.names) expect(n.ar && n.tr && n.en && n.mean).toBeTruthy()
  })
  it('has valid quiz questions, enough for a round in every age group', () => {
    for (const band of ['little', 'explorer', 'young']) {
      const pool = quiz[band]
      expect(pool.length).toBeGreaterThanOrEqual(BAND[band].quizLen + 4)
      expect(new Set(pool.map((q) => q.id)).size).toBe(pool.length)
      for (const q of pool) {
        expect(q.a.length).toBeGreaterThanOrEqual(BAND[band].options)
        expect(q.a[q.ok]).toBeTruthy()
        for (const x of [q.q, q.why, ...q.a]) expect(x.en && x.ar).toBeTruthy()
        if (band === 'little') for (const a of q.a) expect(a.pic).toBeTruthy()
      }
    }
  })
  it('has the 8 wudu steps in order', () => {
    expect(wudu.steps.map((s) => s.id)).toEqual(['bismillah', 'hands', 'mouth', 'nose', 'face', 'arms', 'head', 'feet'])
    for (const s of wudu.steps) for (const k of ['title', 'text', 'short']) expect(s[k].en && s[k].ar).toBeTruthy()
  })
  it('copies every short surah word for word from the app’s Qur’an data', () => {
    for (const s of surahs.surahs) {
      const src = quran[s.n]
      expect(s.ayat.map((a) => a.ar)).toEqual(src.v.map((v) => v[1]))
      expect(s.ayat.map((a) => a.en)).toEqual(src.v.map((v) => v[2]))
    }
    for (const list of Object.values(surahs.bands)) for (const n of list) expect(surahs.surahs.some((s) => s.n === n)).toBe(true)
  })
})

describe('interface text', () => {
  // every key the English text has, in every language, as the same kind of value
  const shape = (o, path = '') => Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? shape(v, `${path}${k}.`) : [[`${path}${k}`, Array.isArray(v) ? 'array' : typeof v]])
  const want = shape(KIDS_TEXT.en)
  for (const [lang, t] of Object.entries(KIDS_TEXT)) {
    it(`${lang} has every string`, () => {
      const have = Object.fromEntries(shape(t))
      for (const [key, type] of want) expect(have[key], `${lang}: ${key}`).toBe(type)
    })
  }
  it('never tells a child they are wrong', () => {
    for (const t of Object.values(KIDS_TEXT)) expect(JSON.stringify(t.quiz)).not.toMatch(/wrong|falsch|faux|incorrect|間違/i)
  })
})
