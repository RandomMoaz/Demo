const DAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] // Date#getDay order
const WEEK = 7 * 1440
const TOO_HARD = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|week|sunrise|sunset|dawn|dusk|\|\||\+|"|\[|\b\d{4}\b/i

const D = '(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)'
const DAYSPEC = `${D}(?:\\s*-\\s*${D})?`
const DAYS = `${DAYSPEC}(?:\\s*,\\s*${DAYSPEC})*`
const SPAN = '\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2}'
const SPANS = `${SPAN}(?:\\s*,\\s*${SPAN})*`
const RULE = new RegExp(`^(${DAYS})?\\s*(${SPANS})?\\s*(off|closed|open)?\\s*(?:,\\s*|$)`, 'i')

const minutes = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }

function daysOf(sel) {
  const out = new Set()
  for (const part of sel.split(',')) {
    const [a, b] = part.split('-').map((x) => x.trim())
    if (a === 'PH' || a === 'SH') continue
    const from = DAY.indexOf(a), to = b ? DAY.indexOf(b) : from
    if (from < 0 || to < 0) return null
    for (let d = from; ; d = (d + 1) % 7) { out.add(d); if (d === to) break }
  }
  return out
}

export function parseHours(raw) {
  const text = String(raw || '').trim()
  if (!text || TOO_HARD.test(text)) return null
  if (/^24\/7$/.test(text)) return { always: true }
  const week = Array.from({ length: 7 }, () => [])
  let any = false
  for (const chunk of text.split(';')) {
    let rest = chunk.trim(), first = true
    if (!rest) continue
    while (rest) {
      const m = rest.match(RULE)
      if (!m || m[0] === '' || (!m[1] && !m[2] && !m[3])) return null
      rest = rest.slice(m[0].length).trim()
      const [, sel, spans, state] = m
      const days = sel ? daysOf(sel) : new Set([0, 1, 2, 3, 4, 5, 6])
      if (!days) return null
      const off = /off|closed/i.test(state || '')
      let ivs = []
      if (!off) {
        if (spans) {
          for (const sp of spans.split(',')) {
            const [a, b] = sp.split('-').map((x) => minutes(x.trim()))
            if (a > 1440 || b > 1440) return null
            ivs.push([a, b <= a ? b + 1440 : b]) // 18:00-02:00 runs into the next morning
          }
        } else ivs = [[0, 1440]] // "Mo-Fr" alone: open all day
      }
      for (const d of days) week[d] = first || off ? ivs.slice() : week[d].concat(ivs)
      any = true
      first = false
    }
  }
  return any ? { week } : null
}

export function openState(raw, now = new Date()) {
  const h = typeof raw === 'string' ? parseHours(raw) : raw
  if (!h) return null
  if (h.always) return { open: true, change: null }
  const ivs = []
  h.week.forEach((list, d) => list.forEach(([a, b]) => {
    for (const k of [-1, 0, 1]) ivs.push([d * 1440 + a + k * WEEK, d * 1440 + b + k * WEEK])
  }))
  ivs.sort((x, y) => x[0] - y[0])
  const merged = []
  for (const iv of ivs) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else merged.push(iv.slice())
  }
  const t = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes()
  const at = (m) => new Date(now.getTime() + (m - t) * 60000 - now.getSeconds() * 1000 - now.getMilliseconds())
  const cur = merged.find(([a, b]) => a <= t && t < b)
  if (cur) return { open: true, change: cur[1] - t >= WEEK ? null : at(cur[1]) }
  const next = merged.find(([a]) => a > t)
  return { open: false, change: next && next[0] - t <= WEEK ? at(next[0]) : null }
}
