// Prayer alarms: ring at a prayer (its time follows the user's location daily) or a fixed time.
// Saved on the device; optionally a task must be solved to stop the alarm.
import { useSyncExternalStore } from 'react'
import { prayerTimes } from './prayerTimes'
import { savedLocation } from './location'

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
const SNOOZE_KEY = 'mc_alarm_snooze_v1'
function loadSnooze() {
  try { const v = JSON.parse(localStorage.getItem(SNOOZE_KEY)); return v && v.until && v.alarm ? v : null } catch { return null }
}
let state = { alarms: load(), ringing: null, snoozed: loadSnooze() }
const subs = new Set()

function set(patch) { state = { ...state, ...patch }; subs.forEach((f) => f()) }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state.alarms)) } catch { /* ignore */ }
}
const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }
const snapshot = () => state
export const useAlarms = () => useSyncExternalStore(subscribe, snapshot, snapshot)   // 3rd arg: server rendering (tests)
export const alarmState = snapshot

export function addAlarm(a) {
  const alarm = { offset: 0, on: true, ...a, id: Date.now(), last: null }
  set({ alarms: [...state.alarms, alarm] })
  save()
  return alarm
}
export function updateAlarm(id, patch) {
  set({ alarms: state.alarms.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  save()
}
/** One alarm per prayer: change the prayer's alarm if it has one, otherwise add it. */
export function savePrayerAlarm(prayer, patch) {
  const found = state.alarms.find((a) => a.prayer === prayer)
  if (found) { updateAlarm(found.id, { on: true, ...patch }); return { ...found, on: true, ...patch } }
  return addAlarm({ prayer, time: null, repeat: 'daily', days: [], task: null, level: 'medium', ...patch })
}
export function removeAlarm(id) {
  const gone = state.alarms.find((a) => a.id === id)
  set({ alarms: state.alarms.filter((a) => a.id !== id) })
  save()
  return gone
}
/** Put back an alarm that was just deleted (Undo). */
export function restoreAlarm(a) {
  if (!a || state.alarms.some((x) => x.id === a.id)) return
  set({ alarms: [...state.alarms, a] })
  save()
}
export const ring = (alarm) => set({ ringing: alarm })
export function stopRinging() {
  const a = state.ringing
  if (a && a.repeat === 'once' && !a.test) removeAlarm(a.id)   // one-off alarms are done once they ring
  set({ ringing: null })
}
function saveSnooze() {
  try { state.snoozed ? localStorage.setItem(SNOOZE_KEY, JSON.stringify(state.snoozed)) : localStorage.removeItem(SNOOZE_KEY) } catch { /* ignore */ }
}
/** Ring the same alarm again in `minutes`. Returns when it will ring (null for a test alarm). */
export function snooze(minutes = 5, now = new Date()) {
  const a = state.ringing
  if (!a) return null
  if (a.test) { set({ ringing: null }); return null }
  const until = now.getTime() + minutes * 60000
  set({ ringing: null, snoozed: { alarm: a, until } })
  saveSnooze()
  return new Date(until)
}
export function cancelSnooze() { set({ snoozed: null }); saveSnooze() }

/* ---------- times ---------- */
const two = (n) => String(n).padStart(2, '0')
export const hm = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`
export function hmToDate(s) {
  const [h, m] = s.split(':').map(Number)
  const d = new Date(); d.setHours(h, m, 0, 0); return d
}

/** Where prayer times come from: the user's location, else the one saved on this device (null = none). */
export const whereFor = (loc) => loc || savedLocation() || null

/** today's prayer times as "HH:MM", e.g. { fajr: '04:52', … } */
export function todaysTimes(loc, date = new Date()) {
  const c = whereFor(loc) || MAKKAH
  const out = {}
  for (const p of prayerTimes(c.lat, c.lng, date)) if (p.date && !p.info) out[p.key] = hm(p.date)
  return out
}
/** "HH:MM" moved by `minutes`, wrapping round midnight. */
export function shiftHM(hhmm, minutes = 0) {
  if (!hhmm) return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440
  return `${two(Math.floor(t / 60))}:${two(t % 60)}`
}
/** When an alarm rings today: its prayer's time (moved by its offset) or its own time. */
export const alarmTime = (a, times) => (a.prayer ? shiftHM(times[a.prayer], a.offset || 0) : a.time)

/** The next moment this alarm will ring, looking up to a week ahead (prayer times change daily). */
export function nextRing(a, loc, now = new Date()) {
  if (!a || a.on === false) return null
  for (let d = 0; d < 8; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d)
    if (a.repeat === 'days' && !a.days.includes(day.getDay())) continue
    const at = alarmTime(a, todaysTimes(loc, day))
    if (!at) continue
    const [h, m] = at.split(':').map(Number)
    const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
    if (when > now) return when
  }
  return null
}

/** What comes after a prayer: sunrise ends Fajr; otherwise the next prayer (none after Isha). */
export function afterPrayer(prayer, loc, now = new Date()) {
  const c = whereFor(loc) || MAKKAH
  const by = Object.fromEntries(prayerTimes(c.lat, c.lng, now).map((p) => [p.key, p.date]))
  if (prayer === 'fajr') return { key: 'sunrise', date: by.sunrise }
  const i = PRAYERS.indexOf(prayer)
  if (i < 0 || i === PRAYERS.length - 1) return null
  return { key: PRAYERS[i + 1], date: by[PRAYERS[i + 1]] }
}

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
  // a snoozed alarm comes back first
  if (state.snoozed && now.getTime() >= state.snoozed.until && !state.ringing) {
    const a = state.snoozed.alarm
    set({ snoozed: null }); saveSnooze()
    ring({ ...a, at: cur })
    return a
  }
  const due = state.alarms.filter((a) =>
    a.on !== false && a.last !== stamp && alarmTime(a, times) === cur &&
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
let ctx = null, beeper = null, started = 0
/** browsers only allow sound after a tap, so call this from a click */
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* no audio */ }
}
/** How loud the alarm is `ms` after it started: soft for the first seconds, full after half a minute. */
export const volumeAt = (ms) => 0.04 + Math.min(1, Math.max(0, ms) / 30000) * 0.26

// a soft two-note chime that fades out, instead of a hard beep
function chime() {
  if (!ctx) return
  const peak = volumeAt(Date.now() - started)
  for (const [freq, delay] of [[659.25, 0], [880, 0.28]]) {
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    const t = ctx.currentTime + delay
    osc.type = 'sine'; osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(t); osc.stop(t + 0.95)
  }
}
export function startSound() {
  stopSound(); unlockAudio(); started = Date.now(); chime()
  beeper = setInterval(chime, 1500)
  if (navigator.vibrate) navigator.vibrate([400, 200, 400])
}
export function stopSound() {
  clearInterval(beeper); beeper = null
  try { navigator.vibrate?.(0) } catch { /* ignore */ }
}

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
