// Rashed's tools: answers that use what the app already knows — live prayer times, the Qibla from the user's
// location, the ingredient checker — and buttons that open the right screen. Pure, no DOM.
import { norm } from './rashed'
import { prayerTimes, nextPrayer } from './prayerTimes'
import { analyze } from './data'

export const KAABA = { lat: 21.4225, lng: 39.8262 }
const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI

/** Bearing (0–360, clockwise from north) and distance in km from `from` to the Kaaba. */
export function qibla(from) {
  const p1 = rad(from.lat), p2 = rad(KAABA.lat), dl = rad(KAABA.lng - from.lng)
  const b = deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)))
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return { bearing: (b + 360) % 360, km: 2 * 6371 * Math.asin(Math.sqrt(h)) }
}
export const compass8 = (b) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(b / 45) % 8]

const has = (q, list) => list.some((w) => {
  const k = norm(w)
  return /^[a-z0-9 ]+$/.test(k) ? new RegExp(`(^| )${k}( |$)`).test(q) : q.includes(k)
})

const PRAYER_WORDS = {
  fajr: ['fajr', 'fajar', 'subh', 'dawn prayer', 'الفجر', 'فجر', 'الصبح', 'ファジュル'],
  dhuhr: ['dhuhr', 'zuhr', 'duhr', 'zohr', 'noon prayer', 'الظهر', 'ظهر', 'ズフル'],
  asr: ['asr', 'afternoon prayer', 'العصر', 'عصر', 'アスル'],
  maghrib: ['maghrib', 'magrib', 'sunset prayer', 'المغرب', 'مغرب', 'マグリブ'],
  isha: ['isha', 'esha', 'night prayer', 'العشاء', 'عشاء', 'イシャー'],
}
const TIME_WORDS = ['time', 'times', 'when', 'what time', 'schedule', 'timetable', 'وقت', 'مواقيت', 'متى', 'موعد', 'zeit', 'zeiten', 'wann', 'heure', 'horaire', 'horaires', 'quand', 'hora', 'horario', 'horarios', 'cuando', 'cuándo', '時間', '何時', 'いつ']
const QIBLA_WORDS = ['qibla', 'qiblah', 'kibla', 'kiblah', 'qibleh', 'direction of makkah', 'direction of mecca', 'which way to pray', 'القبله', 'قبله', 'اتجاه القبله', 'اتجاه الكعبه', 'gebetsrichtung', 'direction de la mecque', 'direction de la qibla', 'alquibla', 'dirección de la meca', 'キブラ', 'メッカの方向']
const PLACE_WORDS = ['mosque', 'masjid', 'halal restaurant', 'halal food', 'restaurant', 'halal shop', 'butcher', 'مسجد', 'جامع', 'مطعم', 'ملحمه', 'moschee', 'restaurant halal', 'mosquée', 'mezquita', 'restaurante', 'モスク', 'レストラン', 'ハラール']
const NEAR_WORDS = ['near', 'nearest', 'nearby', 'close', 'closest', 'around', 'where', 'find', 'قريب', 'اقرب', 'اين', 'حولي', 'nähe', 'nächste', 'wo', 'près', 'proche', 'où', 'cerca', 'dónde', 'donde', '近く', 'どこ']
const ALARM_WORDS = ['alarm', 'wake me', 'wake up', 'remind me', 'reminder', 'منبه', 'ايقظني', 'ذكرني', 'wecker', 'weck mich', 'erinnere', 'réveil', 'réveille', 'rappelle', 'despertador', 'despiértame', 'recuérdame', 'アラーム', '起こして', 'リマインド']
const QURAN_READ = ['read quran', 'read the quran', 'open quran', 'open the quran', 'recite quran', 'mushaf', 'read surah', 'اقرا القران', 'المصحف', 'مصحف', 'koran lesen', 'lire le coran', 'leer el corán', 'クルアーンを読む']
const INGREDIENT_WORDS = ['ingredient', 'ingredients', 'e number', 'e-number', 'additive', 'emulsifier', 'مكونات', 'المكونات', 'مضاف', 'zutaten', 'zusatzstoff', 'ingrédients', 'additif', 'ingredientes', 'aditivo', '原材料', '添加物']
const E_CODE = /\be ?\d{3}[a-z]?\b/i
// question words removed before checking ingredients: "halal" in a question is not a halal claim on a product
const ASKING = /\b(is|are|can|could|may|i|we|you|eat|drink|it|this|that|these|those|halal|haram|allowed|permissible|ok|okay|food|in|islam|muslims?)\b|حلال|حرام|هل|يجوز|اكل|أكل|شرب|\?|؟/gi

/**
 * What the app can do for this question. Returns { cards: [...], actions: [...] }:
 *   card  { type: 'times', focus } | { type: 'qibla' } | { type: 'ingredients', found, v } | { type: 'needLoc' }
 *   action 'map' | 'scanner' | 'mushaf' | 'alarms' | 'locate' | { alarm: prayerKey }
 * `where` is the user's location (or null), so the tools never guess a place.
 */
export function tools(query, { where = null, topic = null } = {}) {
  const q = norm(query)
  const cards = [], actions = []
  if (!q) return { cards, actions }
  const prayer = Object.keys(PRAYER_WORDS).find((k) => has(q, PRAYER_WORDS[k])) || null

  if (has(q, ALARM_WORDS)) actions.push({ alarm: prayer || 'fajr' }, 'alarms')
  else if (has(q, TIME_WORDS) && (prayer || has(q, ['prayer', 'prayers', 'salah', 'salat', 'صلاه', 'الصلاه', 'مواقيت الصلاه', 'gebet', 'prière', 'oración', '礼拝']))) {
    cards.push(where ? { type: 'times', focus: prayer } : { type: 'needLoc', for: 'times' })
    if (!where) actions.push('locate')
  }
  if (has(q, QIBLA_WORDS)) {
    cards.push(where ? { type: 'qibla' } : { type: 'needLoc', for: 'qibla' })
    if (!where) actions.push('locate')
  }
  if (has(q, PLACE_WORDS) && has(q, NEAR_WORDS)) actions.push('map')
  if (has(q, QURAN_READ) || topic === 'quran') actions.push('mushaf')

  // an ingredient or E-number in the question: run the app's own checker on it
  const looksLikeIngredients = E_CODE.test(query) || has(q, INGREDIENT_WORDS)
  const check = analyze(String(query).replace(ASKING, ' ').replace(/\s+/g, ' ').trim())
  if (check.found.length || looksLikeIngredients) {
    if (check.found.length) cards.push({ type: 'ingredients', v: check.v, found: check.found.map((f) => ({ id: f.id, s: f.s, n: f.n, w: f.w })) })
    actions.push('scanner')
  }
  return { cards, actions: [...new Set(actions.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))))].map((a) => (a.startsWith('{') ? JSON.parse(a) : a)) }
}

/** Today's times for a card (computed when shown, so a saved chat never shows yesterday's times). */
export function timesFor(where, now = new Date()) {
  const list = prayerTimes(where.lat, where.lng, now).filter((p) => p.date)
  return { list, next: nextPrayer(list, now) }
}
