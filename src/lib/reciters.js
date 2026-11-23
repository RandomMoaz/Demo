// Reciters installed with scripts/qul/import-recitation.mjs (public/recitations). None installed = no Listen mode.
const BASE = `${import.meta.env?.BASE_URL || '/'}recitations/`
let list = null
const cache = new Map()

/** The installed reciters: [{ slug, name, kind, surahs }], [] when there are none. */
export async function loadReciters() {
  if (list) return list
  try {
    const res = await fetch(`${BASE}index.json`)
    const data = res.ok ? await res.json() : []
    list = Array.isArray(data) ? data.filter((r) => r && r.slug && Array.isArray(r.surahs)) : []
  } catch { list = [] }
  return list
}

/** One surah of a reciter, with audio paths made absolute. null if that reciter does not have it. */
export async function loadRecitation(slug, surah) {
  const key = `${slug}/${surah}`
  if (cache.has(key)) return cache.get(key)
  const dir = `${BASE}${slug}/`
  let file = null
  try {
    const res = await fetch(`${dir}${String(surah).padStart(3, '0')}.json`)
    if (res.ok) {
      file = await res.json()
      if (file.audio) file.audio = dir + file.audio
      for (const row of Object.values(file.ayahs || {})) if (row.audio) row.audio = dir + row.audio
    }
  } catch { file = null }
  cache.set(key, file)
  return file
}
