// Kid progress: pure functions over a plain object, so they are easy to test.

export const QUESTS = {
  little: ['pray', 'letter', 'kind', 'wudu'],
  explorer: ['pray', 'letter', 'kind', 'surah'],
  young: ['pray', 'names', 'kind', 'surah'],
}
export const QUEST_STARS = { pray: 3, letter: 2, kind: 2, surah: 2, wudu: 2, names: 2 }
export const SELF_REPORT = ['pray', 'kind'] // the child ticks these; the others tick themselves

export const STICKERS = [
  { id: 'prayer', pic: '🧎', ok: (s) => s.prayerGames >= 1 },
  { id: 'wudu', pic: '💧', ok: (s) => s.wuduCompleted >= 1 },
  { id: 'quiz', pic: '🎯', ok: (s) => s.quizRounds >= 1 },
  { id: 'letters', pic: 'أ', ok: (s) => s.lettersDone.length >= 5 },
  { id: 'names', pic: '✨', ok: (s) => s.namesCollected.length >= 10 },
  { id: 'surah', pic: '📖', ok: (s) => s.surahsRead.length >= 1 },
  { id: 'streak', pic: '🔥', ok: (s) => s.streak >= 3 },
  { id: 'stars', pic: '🏆', ok: (s) => s.stars >= 50 },
]

const two = (n) => String(n).padStart(2, '0')
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export function fresh() {
  return {
    v: 1, stars: 0, streak: 0, lastActive: null, starLog: {},
    lettersDone: [], namesCollected: [], surahsRead: [],
    wuduCompleted: 0, quizRounds: 0, prayerGames: 0,
    stickers: [], quests: { date: null, done: {} },
  }
}

/** Fill in anything missing (older saves, hand-edited storage). */
export function normalise(raw) {
  const s = { ...fresh(), ...(raw && typeof raw === 'object' ? raw : {}) }
  for (const k of ['lettersDone', 'namesCollected', 'surahsRead', 'stickers']) if (!Array.isArray(s[k])) s[k] = []
  if (!s.starLog || typeof s.starLog !== 'object') s.starLog = {}
  if (!s.quests || typeof s.quests !== 'object') s.quests = { date: null, done: {} }
  return s
}

/** Today's quests start empty at local midnight; a missed day breaks the streak. */
export function rollDay(s, now = new Date()) {
  const today = dayKey(now)
  let out = s
  if (s.quests.date !== today) out = { ...out, quests: { date: today, done: {} } }
  if (s.lastActive && s.lastActive !== today && s.lastActive !== dayKey(addDays(now, -1)) && s.streak) out = { ...out, streak: 0 }
  return out
}

function withStickers(s) {
  const have = new Set(s.stickers)
  const gained = STICKERS.filter((x) => !have.has(x.id) && x.ok(s)).map((x) => x.id)
  return gained.length ? { ...s, stickers: [...s.stickers, ...gained] } : s
}

/** Add stars for today; the streak grows on the first star of a new day. */
export function award(s, n, now = new Date()) {
  if (!n) return withStickers(s)
  const today = dayKey(now)
  const streak = s.lastActive === today ? s.streak : s.lastActive === dayKey(addDays(now, -1)) ? s.streak + 1 : 1
  const keepFrom = dayKey(addDays(now, -13))
  const starLog = {}
  for (const [k, v] of Object.entries(s.starLog)) if (k >= keepFrom) starLog[k] = v
  starLog[today] = (starLog[today] || 0) + n
  return withStickers({ ...s, stars: s.stars + n, streak, lastActive: today, starLog })
}

export function completeQuest(s, id, now = new Date()) {
  const r = rollDay(s, now)
  if (r.quests.done[id] || !(id in QUEST_STARS)) return r
  return award({ ...r, quests: { ...r.quests, done: { ...r.quests.done, [id]: true } } }, QUEST_STARS[id], now)
}

const addOnce = (list, id) => (list.includes(id) ? list : [...list, id])

/** A letter traced: +1 star the first time, and today's letter quest. */
export function traceLetter(s, id, now = new Date()) {
  const first = !s.lettersDone.includes(id)
  let out = first ? award({ ...s, lettersDone: addOnce(s.lettersDone, id) }, 1, now) : s
  return completeQuest(out, 'letter', now)
}

export function collectName(s, id, now = new Date()) {
  if (s.namesCollected.includes(id)) return s
  const out = award({ ...s, namesCollected: [...s.namesCollected, id] }, 1, now)
  return completeQuest(out, 'names', now)
}

export const quizAnswer = (s, right, now = new Date()) => (right ? award(s, 1, now) : s)
export const finishQuiz = (s, now = new Date()) => award({ ...s, quizRounds: s.quizRounds + 1 }, 0, now)
export const finishPrayerGame = (s, now = new Date()) => award({ ...s, prayerGames: s.prayerGames + 1 }, 2, now)
export const finishWudu = (s, now = new Date()) => completeQuest(award({ ...s, wuduCompleted: s.wuduCompleted + 1 }, 2, now), 'wudu', now)
export function readSurah(s, n, now = new Date()) {
  const out = award({ ...s, surahsRead: addOnce(s.surahsRead, n) }, s.surahsRead.includes(n) ? 0 : 2, now)
  return completeQuest(out, 'surah', now)
}

/** Stars in the last 7 days, today included. */
export function weekStars(s, now = new Date()) {
  let n = 0
  for (let i = 0; i < 7; i++) n += s.starLog[dayKey(addDays(now, -i))] || 0
  return n
}
