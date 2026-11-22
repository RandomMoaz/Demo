// Small pure helpers for the kids section, plus read-aloud.

// What changes with age. Little = 4–6, explorer = 7–10, young = 11–15.
export const BAND = {
  little: { options: 3, traceNeed: 0.5, onLetter: 0.4, brush: 30, readAloud: true, short: true, translation: false, quizLen: 5 },
  explorer: { options: 4, traceNeed: 0.62, onLetter: 0.5, brush: 22, readAloud: false, short: false, translation: true, quizLen: 5 },
  young: { options: 4, traceNeed: 0.7, onLetter: 0.55, brush: 18, readAloud: false, short: false, translation: true, quizLen: 8 },
}

const TATWEEL = 'ـ'
/** The four shapes of a letter. Letters that never join look the same at the start as alone. */
export function letterForms(l) {
  if (!l.joins) return { alone: l.ar, start: l.ar, middle: TATWEEL + l.ar, end: TATWEEL + l.ar }
  return { alone: l.ar, start: l.ar + TATWEEL, middle: TATWEEL + l.ar + TATWEEL, end: TATWEEL + l.ar }
}

/** A grown-up check: a two-digit sum most young children cannot do in their head. */
export function makeSum(rand = Math.random) {
  const a = 6 + Math.floor(rand() * 4) // 6–9
  const b = 12 + Math.floor(rand() * 8) // 12–19
  return { a, b, answer: a * b }
}

/**
 * How much of the letter has been traced: the share of `targets` (points inside the letter) that lie within
 * `radius` of some point of the child's strokes (each stroke an array of {x, y}).
 */
export function coverage(targets, strokes, radius) {
  if (!targets.length) return 0
  const pts = densify(strokes, radius)
  const r2 = radius * radius
  let hit = 0
  for (const tp of targets) if (pts.some((p) => (p.x - tp.x) ** 2 + (p.y - tp.y) ** 2 <= r2)) hit++
  return hit / targets.length
}

/** How much of the drawing is on the letter: scribbling over the whole pad does not count as tracing. */
export function precision(targets, strokes, radius) {
  const pts = densify(strokes, radius)
  if (!pts.length || !targets.length) return 0
  const r2 = radius * radius
  let on = 0
  for (const p of pts) if (targets.some((tp) => (p.x - tp.x) ** 2 + (p.y - tp.y) ** 2 <= r2)) on++
  return on / pts.length
}

// the points of each stroke, with extra points filled in so no gap is wider than radius / 2
function densify(strokes, radius) {
  const pts = []
  for (const st of strokes) {
    for (let i = 0; i < st.length; i++) {
      pts.push(st[i])
      const n = st[i + 1]
      if (!n) continue
      const d = Math.hypot(n.x - st[i].x, n.y - st[i].y)
      for (let k = 1; k * (radius / 2) < d; k++) {
        const t = (k * radius) / 2 / d
        pts.push({ x: st[i].x + (n.x - st[i].x) * t, y: st[i].y + (n.y - st[i].y) * t })
      }
    }
  }
  return pts
}

/** Points inside the letter, read from how the browser draws it (no hand-made paths needed). */
export function letterTargets(char, w, h, step = 8) {
  if (typeof document === 'undefined') return []
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  if (!g) return []
  g.font = `${Math.round(h * 0.62)}px "Baloo Bhaijaan 2", "Noto Naskh Arabic", serif`
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(char, w / 2, h * 0.5)
  const data = g.getImageData(0, 0, w, h).data
  const out = []
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) if (data[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] > 128) out.push({ x, y })
  }
  return out
}

export function shuffle(list, rand = Math.random) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** A quiz round: `len` questions, each with `options` answers (the right one always kept), shuffled. */
export function quizRound(pool, { len = 5, options = 4, rand = Math.random } = {}) {
  return shuffle(pool, rand).slice(0, len).map((q) => {
    const right = q.a[q.ok]
    const others = shuffle(q.a.filter((_, i) => i !== q.ok), rand).slice(0, options - 1)
    const a = shuffle([right, ...others], rand)
    return { ...q, a, ok: a.indexOf(right) }
  })
}

/** Content text in the user's language: Arabic or English (other languages read the English). */
export const pickLang = (obj, lang) => (obj ? (lang === 'ar' ? obj.ar : obj.en) ?? obj.en : '')

const SPEECH = { en: 'en-US', ar: 'ar-SA', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', ja: 'ja-JP' }
/** Read a short text aloud (prompts, letter and name pronunciations until recorded audio is added). Never Qur'an. */
export function say(text, lang = 'en') {
  try {
    const s = window.speechSynthesis
    if (!s || !text) return false
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = SPEECH[lang] || lang
    u.rate = 0.9
    s.speak(u)
    return true
  } catch { return false }
}
export const hush = () => { try { window.speechSynthesis?.cancel() } catch { /* ignore */ } }
