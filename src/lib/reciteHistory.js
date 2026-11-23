// Recitation history on this device: finished sessions, the words a user keeps getting wrong, and a daily streak.
// Pure functions over a plain object, plus small load/save helpers.

const KEY = 'mc_recite_history_v1'
const two = (n) => String(n).padStart(2, '0')
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export const emptyHistory = () => ({ v: 1, sessions: [], mistakes: {}, days: {} })

/**
 * Add a finished (or stopped) session. view is the Tracker view; words are the surah's words ({ ar, a, i }).
 * Keeps the last 100 sessions; counts each mistaken word by "surah:ayah:word".
 */
export function addSession(h, { surah, view, words, now = new Date() }) {
  const done = view.state.filter((s) => s !== 'pending').length
  if (!done) return h
  const ok = view.state.filter((s) => s === 'ok').length
  const mistakes = { ...h.mistakes }
  for (const m of view.mistakes) {
    const w = words[m.k]
    const key = `${surah}:${w.a}:${w.i + 1}`
    const prev = mistakes[key] || { count: 0, ar: w.ar, type: m.type }
    mistakes[key] = { ...prev, count: prev.count + 1, last: now.getTime(), type: m.type, heard: m.heard || prev.heard || '' }
  }
  const ayat = new Set(words.filter((_, k) => view.state[k] !== 'pending').map((w) => w.a)).size
  const today = dayKey(now)
  const day = h.days[today] || { words: 0, ayat: 0 }
  return {
    ...h,
    sessions: [...h.sessions, { surah, at: now.getTime(), words: done, ok, score: Math.round((ok / done) * 100), mistakes: view.mistakes.length }].slice(-100),
    mistakes,
    days: { ...h.days, [today]: { words: day.words + done, ayat: day.ayat + ayat } },
  }
}

/** A word recited correctly later counts down its mistakes, so practice clears it from the list. */
export function clearPracticed(h, { surah, view, words }) {
  const mistakes = { ...h.mistakes }
  view.state.forEach((s, k) => {
    if (s !== 'ok') return
    const key = `${surah}:${words[k].a}:${words[k].i + 1}`
    if (!mistakes[key]) return
    const count = mistakes[key].count - 1
    if (count <= 0) delete mistakes[key]
    else mistakes[key] = { ...mistakes[key], count }
  })
  return { ...h, mistakes }
}

/** Days in a row with any recitation, counting today, or up to yesterday if nothing yet today. */
export function streak(h, now = new Date()) {
  let d = h.days[dayKey(now)] ? now : addDays(now, -1)
  let n = 0
  while (h.days[dayKey(d)]) { n++; d = addDays(d, -1) }
  return n
}

/** The words a user most often gets wrong in a surah, most frequent first. */
export function weakWords(h, surah, limit = 5) {
  return Object.entries(h.mistakes)
    .filter(([k]) => k.startsWith(`${surah}:`))
    .map(([k, m]) => ({ key: k, a: +k.split(':')[1], ...m }))
    .sort((x, y) => y.count - x.count || y.last - x.last)
    .slice(0, limit)
}

export const bestScore = (h, surah) => h.sessions.filter((s) => s.surah === surah).reduce((b, s) => Math.max(b, s.score), 0)
export const today = (h, now = new Date()) => h.days[dayKey(now)] || { words: 0, ayat: 0 }

export function loadHistory() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.v === 1 ? { ...emptyHistory(), ...v } : emptyHistory() } catch { return emptyHistory() }
}
export function saveHistory(h) {
  try { localStorage.setItem(KEY, JSON.stringify(h)) } catch { /* storage blocked */ }
}
