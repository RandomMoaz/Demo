// Recitation tracking: follow a reciter through a surah from speech-to-text output, word by word, and find
// skipped, wrong and extra words. Works with any speech engine that gives Arabic text. Pure, no DOM.
import { normalizeArabic } from './quranNlp.js'

/** A spelling-proof form for comparing Qur'anic (Uthmani) text with ordinary written Arabic from speech engines. */
export function skeleton(word) {
  return normalizeArabic(word)
    .replace(/[ؤ]/g, 'و') // ؤ -> و
    .replace(/[ئ]/g, 'ي') // ئ -> ي
    .replace(/[^ب-ي]/g, '') // drop alef, hamza and anything that is not a letter
}

/** Levenshtein distance between two strings. */
function lev(a, b) {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

/** 0–1: how alike two words are once spelling differences are set aside. */
export function similarity(a, b) {
  const x = skeleton(a), y = skeleton(b)
  if (!x && !y) return normalizeArabic(a) === normalizeArabic(b) ? 1 : 0
  if (!x || !y) return 0
  return 1 - lev(x, y) / Math.max(x.length, y.length)
}

/** Same word? Short words must be spelled the same; longer ones may differ by a letter (speech engines slip). */
export function sameWord(a, b) {
  const s = similarity(a, b)
  return Math.min(skeleton(a).length, skeleton(b).length) <= 2 ? s === 1 : s >= 0.75
}

export const tokens = (text) => normalizeArabic(text).split(' ').filter((w) => /[ء-ي]/.test(w))

// said around a recitation but not part of the surah's text
const OPENERS = [tokens('أعوذ بالله من الشيطان الرجيم'), tokens('بسم الله الرحمن الرحيم')]
const CLOSER = tokens('صدق الله العظيم')

/** Remove the isti'adha / basmala at the start (unless the basmala is the text itself) and "sadaqa Allahu al-'azim". */
export function trimExtras(heard, { keepBasmala = false } = {}) {
  let h = heard.slice()
  let changed = true
  while (changed) {
    changed = false
    for (const [k, op] of OPENERS.entries()) {
      if (k === 1 && keepBasmala) continue
      if (h.length >= op.length && op.every((w, i) => sameWord(h[i], w))) { h = h.slice(op.length); changed = true }
    }
  }
  if (h.length >= CLOSER.length && CLOSER.every((w, i) => sameWord(h[h.length - CLOSER.length + i], w))) h = h.slice(0, -CLOSER.length)
  return h
}

const COST = { sub: 1, skip: 1, extra: 0.7 } // an extra word is the cheapest guess for noise

/**
 * Align what was heard with the expected words, starting at the first expected word. The end of `expected` is free
 * (the reciter has not got there yet). Returns steps in order: { op: 'ok'|'wrong'|'skip'|'extra', e?, h? } where e
 * and h are indexes into expected and heard.
 */
export function align(expected, heard) {
  const m = expected.length, n = heard.length
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  const B = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)) // 1 diag, 2 extra (up), 3 skip (left)
  for (let j = 1; j <= m; j++) { D[0][j] = j * COST.skip; B[0][j] = 3 }
  for (let i = 1; i <= n; i++) { D[i][0] = i * COST.extra; B[i][0] = 2 }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = D[i - 1][j - 1] + (sameWord(heard[i - 1], expected[j - 1]) ? 0 : COST.sub)
      const up = D[i - 1][j] + COST.extra
      const left = D[i][j - 1] + COST.skip
      if (diag <= up && diag <= left) { D[i][j] = diag; B[i][j] = 1 } else if (up <= left) { D[i][j] = up; B[i][j] = 2 } else { D[i][j] = left; B[i][j] = 3 }
    }
  }
  let j = 0
  for (let k = 1; k <= m; k++) if (D[n][k] < D[n][j]) j = k // the furthest point reached at the lowest cost
  const steps = []
  let i = n
  while (i > 0 || j > 0) {
    const b = i && j ? B[i][j] : i ? 2 : 3
    if (b === 1) { steps.push({ op: sameWord(heard[i - 1], expected[j - 1]) ? 'ok' : 'wrong', e: j - 1, h: i - 1 }); i--; j-- }
    else if (b === 2) { steps.push({ op: 'extra', h: i - 1 }); i-- }
    else { steps.push({ op: 'skip', e: j - 1 }); j-- }
  }
  return steps.reverse()
}

/** Where in `expected` the heard words most likely start (for a reciter who begins mid-surah). -1 if unclear. */
export function locate(expected, heard, from = 0) {
  const k = Math.min(4, heard.length)
  if (k < 2) return -1
  let best = -1, bestScore = 0
  for (let p = from; p <= expected.length - k; p++) {
    let s = 0
    for (let t = 0; t < k; t++) s += sameWord(heard[t], expected[p + t]) ? 1 : 0
    if (s > bestScore) { best = p; bestScore = s }
  }
  return bestScore >= Math.max(2, k - 1) ? best : -1
}

/**
 * Follows one surah. `words` are the surah's words in order ({ ar, a (ayah), i (index in ayah) }).
 * Feed it the speech engine's running text with hear(text, final); call endSession() when the engine restarts.
 * state[k] is 'pending' | 'ok' | 'wrong' | 'skip'; heard[k] holds what was heard for a wrong word.
 */
export class Tracker {
  constructor(words, { basmalaIsText = false } = {}) {
    this.words = words
    this.expected = words.map((w) => w.ar)
    this.basmalaIsText = basmalaIsText
    this.reset()
  }

  reset() {
    this.state = this.words.map(() => 'pending')
    this.heard = this.words.map(() => '')
    this.extras = 0
    this.pos = 0 // the next word the reciter should say
    this.sessionStart = 0
    this.sessionLocated = false
    this.live = { pos: 0, state: null }
    return this
  }

  /** Start following from word k (e.g. the user tapped an ayah). */
  startAt(k) { this.pos = this.sessionStart = Math.max(0, Math.min(k, this.words.length)); this.sessionLocated = true; this.live = { pos: this.pos, state: null } }

  /**
   * The running text of the current listening session. Interim text only moves the reading position on;
   * mistakes are decided when the text is final, so they do not flicker while the engine is still unsure.
   */
  hear(text, final = false) {
    let heard = tokens(text)
    if (this.sessionStart === 0 || !this.sessionLocated) heard = trimExtras(heard, { keepBasmala: this.basmalaIsText && this.sessionStart === 0 })
    if (!heard.length) return this.view()
    if (!this.sessionLocated && heard.length >= 3) {
      // the reciter may have started somewhere else: follow them if the start does not fit where we are
      const here = locate(this.expected, heard, this.sessionStart)
      if (here > this.sessionStart) { this.sessionStart = this.pos = here }
      this.sessionLocated = true
    }
    const window = this.expected.slice(this.sessionStart, this.sessionStart + heard.length * 2 + 12)
    const steps = align(window, heard)
    const state = this.state.slice(), got = this.heard.slice()
    let pos = this.sessionStart, extras = 0, lastOk = -1
    steps.forEach((s, idx) => { if (s.op === 'ok') lastOk = idx })
    steps.forEach((s, idx) => {
      if (s.op === 'extra') { if (final) extras++; return }
      const k = this.sessionStart + s.e
      if (s.op === 'ok') { state[k] = 'ok'; got[k] = ''; pos = k + 1; return }
      // a wrong or skipped word only counts once the reciter has gone past it (or the text is final)
      if (idx > lastOk && !final) return
      if (s.op === 'wrong') { state[k] = 'wrong'; got[k] = heard[s.h]; pos = k + 1 }
      else if (idx < lastOk) state[k] = 'skip'
    })
    // the last words said, with nothing after them to show what they were meant to be: once final, a word that
    // looks a little like the next expected word is a wrong attempt at it (unrelated chatter stays "extra")
    if (final) {
      let t = steps.length
      while (t > 0 && steps[t - 1].op === 'extra') t--
      for (; t < steps.length && pos < this.words.length; t++) {
        const said = heard[steps[t].h]
        if (similarity(said, this.expected[pos]) < 0.34) break
        state[pos] = 'wrong'; got[pos] = said; pos++; extras--
      }
    }
    if (final) { this.state = state; this.heard = got; this.extras += extras; this.pos = pos; this.live = { pos, state: null } }
    else this.live = { pos, state }
    return this.view()
  }

  /** The engine stopped and will start a fresh session: the next text continues from where we are. */
  endSession() { this.live = { pos: this.pos, state: null }; this.sessionStart = this.pos; this.sessionLocated = true }

  view() {
    const state = this.live.state || this.state
    const done = state.filter((s) => s !== 'pending').length
    const mistakes = []
    state.forEach((s, k) => { if (s === 'wrong' || s === 'skip') mistakes.push({ k, type: s, expected: this.words[k].ar, heard: this.heard[k], a: this.words[k].a }) })
    return { state, heard: this.heard, pos: this.live.pos ?? this.pos, done, total: this.words.length, mistakes, extras: this.extras, finished: done === this.words.length }
  }
}

/** Accuracy for a finished (or stopped) recitation: share of recited words that were right. */
export function score(view) {
  const ok = view.state.filter((s) => s === 'ok').length
  const tried = view.state.filter((s) => s !== 'pending').length
  return tried ? Math.round((ok / tried) * 100) : 0
}
