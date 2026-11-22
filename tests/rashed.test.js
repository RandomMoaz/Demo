import { describe, it, expect } from 'vitest'
import { answer, match, rank, stem, editDistance, smallTalk, TOPICS, starters } from '../src/lib/rashed.js'
import { tools, qibla, compass8, timesFor } from '../src/lib/rashedTools.js'
import { RASHED_TEXT } from '../src/lib/rashedText.js'

const topic = (q) => match(q)?.topic.id ?? null
const LONDON = { lat: 51.5074, lng: -0.1278 }

describe('understanding the question', () => {
  it('knows word forms', () => {
    expect(stem('praying')).toBe('pray')
    expect(stem('prayers')).toBe('pray')
    expect(stem('ablutions')).toBe('ablution')
    expect(stem('fasting')).toBe('fast')
    expect(stem('class')).toBe('class')
    for (const q of ['praying', 'prayers', 'how do i pray']) expect(topic(q)).toBe('salah')
    expect(topic('ablutions')).toBe('wudu')
  })
  it('forgives typos on longer words, not on short ones', () => {
    expect(editDistance('ramadhan', 'ramadan')).toBe(1)
    expect(editDistance('wudu', 'wduu')).toBe(1) // swapped letters
    expect(topic('wudoo')).toBe('wudu')
    expect(topic('wodu steps')).toBe('wudu')
    expect(topic('zakaat')).toBe('zakat')
    expect(topic('can i play football')).toBeNull() // "play" is not "pray"
  })
  it('understands questions in all six languages', () => {
    expect(topic('Wie bete ich?')).toBe('salah')
    expect(topic('comment faire la prière')).toBe('salah')
    expect(topic('cómo rezar')).toBe('salah')
    expect(topic('お祈りの仕方')).toBe('salah')
    expect(topic('كيف اصلي')).toBe('salah')
    expect(topic('Was ist Zakat?')).toBe('zakat')
  })
  it('keeps the other topic a question touches', () => {
    const a = answer('wudu and ghusl difference')
    expect([a.id, ...a.also.map((q) => TOPICS.find((t) => t.q.en === q).id)].sort()).toEqual(['ghusl', 'wudu'])
  })
  it('answers in English, saying so, where there is no written answer in the user’s language', () => {
    expect(answer('Wie bete ich?', 'de')).toMatchObject({ matched: true, english: true })
    expect(answer('كيف اصلي', 'ar')).toMatchObject({ matched: true, english: false })
  })
  it('suggests near topics when nothing fits', () => {
    const a = answer('is music haram')
    expect(a.matched).toBe(false)
    expect(a.sources.length).toBeGreaterThan(0)
  })
})

describe('small talk', () => {
  it('greets, thanks, introduces itself and says goodbye in any language', () => {
    expect(smallTalk('assalamu alaikum')).toBe('greet')
    expect(answer('salam').small).toBe('greet') // not "salah" with a typo
    expect(answer('السلام عليكم').small).toBe('greet')
    expect(answer('thanks').small).toBe('thanks')
    expect(answer('jazakallah khair').small).toBe('thanks')
    expect(answer('who are you').small).toBe('who')
    expect(answer('was kannst du').small).toBe('help')
    expect(answer('bye').small).toBe('bye')
  })
  it('never lets small talk hide a real question', () => {
    expect(answer('salam, how do i pray?').id).toBe('salah')
    expect(answer('thanks, and how do i make wudu').id).toBe('wudu')
  })
})

describe('tools', () => {
  it('shows today’s prayer times, focused on the prayer asked about', () => {
    expect(tools('what time is asr', { where: LONDON }).cards).toEqual([{ type: 'times', focus: 'asr' }])
    expect(tools('متى اذان المغرب', { where: LONDON }).cards).toEqual([{ type: 'times', focus: 'maghrib' }])
    expect(tools('Wann ist Asr?', { where: LONDON }).cards[0].focus).toBe('asr')
    const day = new Date(2026, 10, 22, 12, 0)
    const dhuhr = timesFor(LONDON, day).list.find((p) => p.key === 'dhuhr').date
    const { list, next } = timesFor(LONDON, new Date(dhuhr.getTime() + 60000)) // just after Dhuhr, whatever the clock's zone
    expect(list.map((p) => p.key)).toEqual(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'])
    expect(next.key).toBe('asr')
  })
  it('asks for a location instead of guessing one', () => {
    expect(tools('prayer times today')).toEqual({ cards: [{ type: 'needLoc', for: 'times' }], actions: ['locate'] })
    expect(tools('qibla')).toEqual({ cards: [{ type: 'needLoc', for: 'qibla' }], actions: ['locate'] })
  })
  it('works out the Qibla', () => {
    const london = qibla(LONDON)
    expect(london.bearing).toBeGreaterThan(117); expect(london.bearing).toBeLessThan(121) // published: about 119°
    expect(compass8(london.bearing)).toBe('SE')
    expect(Math.round(qibla({ lat: 40.7128, lng: -74.006 }).bearing)).toBe(58) // New York: about 58°
    expect(tools('اتجاه القبله', { where: LONDON }).cards).toEqual([{ type: 'qibla' }])
  })
  it('checks ingredients with the app’s checker, without reading "halal" in the question as a claim', () => {
    const gel = tools('is gelatin halal').cards[0]
    expect(gel).toMatchObject({ type: 'ingredients', v: 'warn' })
    expect(gel.found.map((f) => f.id)).toEqual(['gelatin'])
    expect(tools('هل الجيلاتين حلال').cards[0].found[0].id).toBe('gelatin')
    expect(tools('ingredients: sugar, pork gelatin').cards[0].v).toBe('bad')
    expect(tools('is E471 halal').actions).toContain('scanner')
    expect(tools('is water halal').cards).toEqual([])
  })
  it('offers the right screen', () => {
    expect(tools('where is the nearest mosque').actions).toEqual(['map'])
    expect(tools('halal restaurant near me').actions).toEqual(['map'])
    expect(tools('wake me up for fajr').actions).toEqual([{ alarm: 'fajr' }, 'alarms'])
    expect(tools('set an alarm for isha').actions[0]).toEqual({ alarm: 'isha' })
    expect(tools('what is the quran', { topic: 'quran' }).actions).toEqual(['mushaf'])
    expect(tools('how do i pray').actions).toEqual([])
  })
})

describe('texts', () => {
  const shape = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? shape(v, `${p}${k}.`) : [[`${p}${k}`, typeof v]]))
  const want = shape(RASHED_TEXT.en)
  for (const [lang, t] of Object.entries(RASHED_TEXT)) {
    it(`${lang} has every reply`, () => {
      const have = Object.fromEntries(shape(t))
      for (const [k, type] of want) expect(have[k], `${lang}: ${k}`).toBe(type)
    })
  }
  it('still opens with four starters, and every topic still answers its own question', () => {
    expect(starters('en')).toHaveLength(4)
    for (const tp of TOPICS) {
      expect(rank(tp.q.en)[0].topic.id).toBe(tp.id)
      expect(rank(tp.q.ar)[0].topic.id).toBe(tp.id)
    }
  })
})
