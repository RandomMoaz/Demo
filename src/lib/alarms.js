// Prayer alarms: ring at a prayer (its time follows the user's location daily) or a fixed time.
// Saved on the device; optionally a task must be solved to stop the alarm.
import { useSyncExternalStore } from 'react'
import { prayerTimes } from './prayerTimes'

const KEY = 'mc_alarms_v1'
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
export const TASKS = ['math', 'scramble', 'sort', 'path']
export const LEVELS = ['easy', 'medium', 'hard']
export const MAKKAH = { lat: 21.3891, lng: 39.8579 }
export const NAMES = {
  fajr: { en: 'Fajr', ar: 'الفجر', ja: 'ファジュル' }, dhuhr: { en: 'Dhuhr', ar: 'الظهر', ja: 'ズフル' },
  asr: { en: 'Asr', ar: 'العصر', ja: 'アスル' }, maghrib: { en: 'Maghrib', ar: 'المغرب', ja: 'マグリブ' },
  isha: { en: 'Isha', ar: 'العشاء', ja: 'イシャー' },
}
export const prayerName = (k, lang) => NAMES[k][lang] || NAMES[k].en
const LOCALES = { en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', ja: 'ja-JP', ar: 'ar-EG' }
export const localeOf = (lang) => LOCALES[lang] || LOCALES.en

/* ---------- store (shared by the Alarm screen and the ringer) ---------- */
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}
let state = { alarms: load(), ringing: null }
const subs = new Set()

function set(patch) { state = { ...state, ...patch }; subs.forEach((f) => f()) }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state.alarms)) } catch { /* ignore */ }
}
const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }
const snapshot = () => state
export const useAlarms = () => useSyncExternalStore(subscribe, snapshot, snapshot)   // 3rd arg: server rendering (tests)

export function addAlarm(a) {
  set({ alarms: [...state.alarms, { ...a, id: Date.now(), last: null }] })
  save()
}
export function removeAlarm(id) {
  set({ alarms: state.alarms.filter((a) => a.id !== id) })
  save()
}
export const ring = (alarm) => set({ ringing: alarm })
export function stopRinging() {
  const a = state.ringing
  if (a && a.repeat === 'once' && !a.test) removeAlarm(a.id)   // one-off alarms are done once they ring
  set({ ringing: null })
}

/* ---------- times ---------- */
const two = (n) => String(n).padStart(2, '0')
export const hm = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`
export function hmToDate(s) {
  const [h, m] = s.split(':').map(Number)
  const d = new Date(); d.setHours(h, m, 0, 0); return d
}

/** today's prayer times as "HH:MM", e.g. { fajr: '04:52', … } */
export function todaysTimes(loc, date = new Date()) {
  const c = loc || MAKKAH
  const out = {}
  for (const p of prayerTimes(c.lat, c.lng, date)) if (p.date && !p.info) out[p.key] = hm(p.date)
  return out
}
export const alarmTime = (a, times) => (a.prayer ? times[a.prayer] : a.time)

/** which prayer's period we are in now (before Fajr counts as Isha) */
export function currentPeriod(times, now = new Date()) {
  const cur = hm(now)
  let p = 'isha'
  for (const k of PRAYERS) if (times[k] && times[k] <= cur) p = k
  return p
}

/** call once a second: rings the first alarm that is due this minute */
export function checkAlarms(now, loc) {
  const times = todaysTimes(loc, now)
  const cur = hm(now)
  const stamp = `${now.toDateString()} ${cur}`
  const due = state.alarms.filter((a) =>
    a.last !== stamp && alarmTime(a, times) === cur &&
    (a.repeat !== 'days' || a.days.includes(now.getDay())))
  if (!due.length) return null
  // mark them so each alarm rings only once per minute, even after a reload;
  // one-off alarms that can't ring (another one already is) are done too
  const ids = new Set(due.map((a) => a.id))
  const first = state.ringing ? null : due[0]
  set({
    alarms: state.alarms
      .filter((a) => !(ids.has(a.id) && a.repeat === 'once' && a.id !== first?.id))
      .map((a) => (ids.has(a.id) ? { ...a, last: stamp } : a)),
  })
  save()
  if (first) ring({ ...first, at: cur })
  return due[0]
}

/* ---------- sound (Web Audio beeps, no file needed) ---------- */
let ctx = null, beeper = null
/** browsers only allow sound after a tap, so call this from a click */
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* no audio */ }
}
function beep() {
  if (!ctx) return
  const osc = ctx.createOscillator(), gain = ctx.createGain()
  osc.type = 'sine'; osc.frequency.value = 750; gain.gain.value = 0.15
  osc.connect(gain); gain.connect(ctx.destination)
  osc.start(); osc.stop(ctx.currentTime + 0.2)
}
export function startSound() {
  stopSound(); unlockAudio(); beep()
  beeper = setInterval(beep, 600)
  if (navigator.vibrate) navigator.vibrate([400, 200, 400])
}
export function stopSound() { clearInterval(beeper); beeper = null }

/* ---------- wake-up tasks ---------- */
const rand = (n) => Math.floor(Math.random() * n)
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const WORDS = {
  ar: { easy: ['شمس', 'قمر', 'بيت', 'قلم'], medium: ['شجرة', 'مدرسة', 'سيارة', 'حديقة'], hard: ['تكنولوجيا', 'استراتيجية', 'مسؤولية'] },
  en: { easy: ['sun', 'moon', 'home', 'pen'], medium: ['prayer', 'garden', 'school', 'mosque'], hard: ['gratitude', 'patience', 'knowledge'] },
  de: { easy: ['Sonne', 'Mond', 'Haus', 'Stift'], medium: ['Garten', 'Schule', 'Gebet', 'Moschee'], hard: ['Dankbarkeit', 'Geduldig', 'Wissenschaft'] },
  fr: { easy: ['lune', 'pain', 'ciel', 'stylo'], medium: ['prière', 'jardin', 'école', 'mosquée'], hard: ['gratitude', 'patience', 'connaissance'] },
  es: { easy: ['sol', 'luna', 'casa', 'pan'], medium: ['oración', 'jardín', 'escuela', 'mezquita'], hard: ['gratitud', 'paciencia', 'conocimiento'] },
  ja: { easy: ['つき', 'はな', 'そら', 'やま'], medium: ['さくら', 'ともだち', 'あさひ', 'みずうみ'], hard: ['ありがとう', 'おもいやり', 'がんばります'] },
}
const pick = (list) => list[rand(list.length)]
const size = (level, [e, m, h]) => (level === 'easy' ? e : level === 'hard' ? h : m)

export function makeTask(type, level, lang) {
  if (type === 'math') {
    const max = size(level, [10, 30, 100])
    const a = rand(max) + 1, b = rand(max) + 1
    return { type, a, b, answer: a + b }
  }
  if (type === 'scramble') {
    const word = pick((WORDS[lang] || WORDS.en)[level])
    let tiles
    do tiles = shuffle([...word]); while (tiles.join('') === word)
    return { type, word, tiles }
  }
  if (type === 'sort') {
    const count = size(level, [4, 5, 6])
    const nums = new Set()
    while (nums.size < count) nums.add(rand(90) + 10)
    const asc = Math.random() > 0.5
    const answer = [...nums].sort((x, y) => (asc ? x - y : y - x))
    let tiles
    do tiles = shuffle(answer); while (tiles.join() === answer.join())
    return { type, asc, tiles, answer }
  }
  if (type === 'path') {
    const seq = []
    while (seq.length < size(level, [3, 4, 5])) {
      const n = rand(9)
      if (n !== seq[seq.length - 1]) seq.push(n)   // no repeats in a row, so every step is visible
    }
    return { type, seq }
  }
  return null
}

/* ---------- a hadith after the alarm stops ---------- */
export const HADITHS = {
  fajr: [
    { ar: 'قال رسول الله ﷺ: «مَن صَلَّى الصُّبْحَ فَهُوَ فِي ذِمَّةِ اللهِ».', en: 'Whoever prays the dawn prayer is under the protection of Allah.', src: 'Muslim' },
    { ar: 'قال رسول الله ﷺ: «رَكْعَتَا الْفَجْرِ خَيْرٌ مِنَ الدُّنْيَا وَمَا فِيهَا».', en: 'The two rak‘ahs of Fajr are better than this world and all it contains.', src: 'Muslim' },
  ],
  dhuhr: [
    { ar: 'قال رسول الله ﷺ: «إنَّها ساعَةٌ تُفْتَحُ فيها أَبْوابُ السَّماءِ، وأُحِبُّ أنْ يَصْعَدَ لي فيها عَمَلٌ صالِحٌ».', en: 'It is an hour in which the gates of heaven are opened, and I love that a good deed of mine rises up in it.', src: 'Tirmidhi' },
  ],
  asr: [
    { ar: 'قال رسول الله ﷺ: «مَن تَرَكَ صَلاةَ العَصْرِ حَبِطَ عَمَلُهُ».', en: 'Whoever abandons the Asr prayer, his deeds are lost.', src: 'Bukhari' },
    { ar: 'قال رسول الله ﷺ: «الَّذِي تَفُوتُهُ صَلَاةُ العَصْرِ، كَأَنَّمَا وُتِرَ أَهْلَهُ وَمَالَهُ».', en: 'Whoever misses the Asr prayer is like one who has lost his family and wealth.', src: 'Bukhari, Muslim' },
  ],
  maghrib: [
    { ar: 'قال رسول الله ﷺ: «لا تَزَالُ أُمَّتِي بِخَيْرٍ مَا لَمْ يُؤَخِّرُوا المَغْرِبَ حَتَّى تَشْتَبِكَ النُّجُومُ».', en: 'My nation will remain upon good as long as they do not delay Maghrib until the stars crowd the sky.', src: 'Abu Dawud' },
  ],
  isha: [
    { ar: 'قال رسول الله ﷺ: «مَن صَلَّى العِشاءَ في جَماعَةٍ فَكأنَّما قامَ نِصْفَ اللَّيْلِ، ومَن صَلَّى الصُّبْحَ في جَماعَةٍ فَكأنَّما صَلَّى اللَّيْلَ كُلَّهُ».', en: 'Whoever prays Isha in congregation, it is as if he prayed half the night; and whoever prays Fajr in congregation, it is as if he prayed the whole night.', src: 'Muslim' },
  ],
  custom: [
    { ar: 'قال رسول الله ﷺ: «إنَّ أَوَّلَ ما يُحاسَبُ به العَبْدُ يَوْمَ القِيامَةِ مِنْ عَمَلِهِ صَلاتُهُ، فَإِنْ صَلُحَتْ فَقَدْ أَفْلَحَ وَأَنْجَحَ».', en: 'The first of his deeds a servant will be asked about on the Day of Judgement is his prayer; if it is sound, he has succeeded and prospered.', src: 'Tirmidhi' },
    { ar: 'سُئِلَ النبيُّ ﷺ: أيُّ العَمَلِ أحَبُّ إلى اللَّهِ؟ قالَ: «الصَّلاةُ على وقْتِها».', en: 'The Prophet ﷺ was asked which deed is most beloved to Allah. He said: “Prayer at its proper time.”', src: 'Bukhari' },
  ],
}
export const hadithFor = (prayer) => pick(HADITHS[prayer] || HADITHS.custom)
