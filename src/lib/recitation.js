// Reciter audio with word timings, from QUL (Quranic Universal Library, qul.tarteel.ai) downloads.
// QUL formats:
//   ayah-by-ayah JSON:  { "1:1": { surah_number, ayah_number, audio_url, duration, segments: [[word, fromMs, toMs], …] }, … }
//   surah-by-surah:     surah.json { "1": { surah_number, audio_url, … } } + segments.json
//                       { "1:1": { segments: [[word, fromMs, toMs], …], timestamp_from, timestamp_to, … }, … }
// App format, one file per surah (made by scripts/qul/import-recitation.mjs):
//   { surah, kind: 'ayah' | 'surah', audio?, ayahs: { "1": { audio?, from?, to?, words: [[word, fromMs, toMs], …] } } }
// Pure, no DOM.

/** QUL word segments, cleaned: [[position, from, to]], sorted, without placeholders that carry no time. */
export function cleanSegments(list) {
  return (Array.isArray(list) ? list : [])
    .filter((s) => Array.isArray(s) && s.length >= 3 && Number.isFinite(+s[0]) && !(+s[1] === 0 && +s[2] === 0))
    .map((s) => [Math.trunc(+s[0]), Math.round(+s[1]), Math.round(+s[2])])
    .sort((a, b) => a[1] - b[1])
}

const keyParts = (key, row) => {
  const [s, a] = String(key).split(':').map(Number)
  return [row?.surah_number ?? s, row?.ayah_number ?? a]
}

/** QUL ayah-by-ayah JSON -> { [surah]: app surah file }. */
export function fromAyahJson(json) {
  const out = {}
  for (const [key, row] of Object.entries(json || {})) {
    const [s, a] = keyParts(key, row)
    if (!s || !a || !row?.audio_url) continue
    out[s] ||= { surah: s, kind: 'ayah', ayahs: {} }
    out[s].ayahs[a] = { audio: row.audio_url, words: cleanSegments(row.segments) }
  }
  return out
}

/** QUL surah-by-surah surah.json + segments.json -> { [surah]: app surah file }. */
export function fromSurahJson(surahJson, segmentsJson) {
  const out = {}
  for (const [k, row] of Object.entries(surahJson || {})) {
    const s = +(row?.surah_number ?? k)
    if (s && row?.audio_url) out[s] = { surah: s, kind: 'surah', audio: row.audio_url, ayahs: {} }
  }
  for (const [key, row] of Object.entries(segmentsJson || {})) {
    const [s, a] = keyParts(key, row)
    if (!out[s] || !a) continue
    out[s].ayahs[a] = { from: Math.round(+row.timestamp_from || 0), to: Math.round(+row.timestamp_to || 0), words: cleanSegments(row.segments) }
  }
  return out
}

/**
 * Which ayah and word are being recited at `ms`. For 'surah' files ms is the position in the whole surah's audio;
 * for 'ayah' files it is the position in that ayah's audio and `ayah` says which one is playing.
 * Returns { ayah, word } (word 0 between words).
 */
export function activeAt(file, ms, ayah = null) {
  if (!file) return { ayah: null, word: 0 }
  let a = ayah
  if (file.kind === 'surah') {
    a = null
    for (const [n, row] of Object.entries(file.ayahs)) if (ms >= row.from && ms < row.to) { a = +n; break }
  }
  const words = a ? file.ayahs[a]?.words || [] : []
  // the last word that has started stays lit through the short silence before the next one
  let hit = null
  for (const w of words) if (ms >= w[1]) hit = w
  return { ayah: a, word: hit ? hit[0] : 0 }
}

/** Where to start and stop to play one ayah: [fromMs, toMs] in its audio (to = null: until the file ends). */
export function ayahSpan(file, ayah) {
  const row = file?.ayahs?.[ayah]
  if (!row) return null
  return file.kind === 'surah' ? [row.from, row.to] : [0, null]
}

/** Where one word is in its audio: [fromMs, toMs], or null when that word has no timing. */
export function wordSpan(file, ayah, word) {
  const hit = file?.ayahs?.[ayah]?.words?.find((w) => w[0] === word)
  return hit ? [hit[1], hit[2]] : null
}

/** How well the timings fit the app's text: ayahs with timings for every word, and those that do not. */
export function coverage(file, wordsPerAyah) {
  const report = { full: 0, partial: [], missing: [] }
  for (const [a, count] of Object.entries(wordsPerAyah)) {
    const row = file.ayahs[a]
    if (!row) { report.missing.push(+a); continue }
    const have = new Set(row.words.map((w) => w[0]))
    let n = 0
    for (let i = 1; i <= count; i++) if (have.has(i)) n++
    if (n === count) report.full++
    else report.partial.push(+a)
  }
  return report
}
