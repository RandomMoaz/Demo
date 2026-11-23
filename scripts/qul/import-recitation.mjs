// Import a reciter downloaded from QUL (https://qul.tarteel.ai/resources/recitation) into the app.
//
//   ayah-by-ayah package:
//     node scripts/qul/import-recitation.mjs --name "Mishary Alafasy" --slug alafasy --ayah ./ayah_recitation.json --audio ./mp3s
//   surah-by-surah package (folder with surah.json and segments.json):
//     node scripts/qul/import-recitation.mjs --name "Abdul Basit" --slug abdulbasit --surah-dir ./surah_recitation --fetch-audio
//   options: --surahs 1,108,114   only these surahs (default: all in the package)
//            --audio <folder>     audio files you downloaded (matched by file name)
//            --fetch-audio        download each audio file once into the app (QUL asks apps not to stream from its CDN)
//
// Writes public/recitations/<slug>/<001>.json + audio/, and lists the reciter in public/recitations/index.json.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromAyahJson, fromSurahJson, coverage } from '../../src/lib/recitation.js'

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (!a.startsWith('--')) continue
  const next = process.argv[i + 1]
  args[a.slice(2)] = next && !next.startsWith('--') ? (i++, next) : true
}
const fail = (m) => { console.error(`IMPORT FAILED: ${m}`); process.exit(1) }
if (!args.name || !args.slug) fail('give --name "Reciter name" and --slug short-id')
if (!/^[a-z0-9-]+$/.test(args.slug)) fail('--slug may only use a-z, 0-9 and -')
if (!args.ayah && !args['surah-dir']) fail('give --ayah <file.json> or --surah-dir <folder>')
if (!args.audio && !args['fetch-audio']) fail('give --audio <folder> or --fetch-audio: the app plays its own copy, never Tarteel\'s CDN')

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
let files
if (args.ayah) files = fromAyahJson(readJson(args.ayah))
else files = fromSurahJson(readJson(path.join(args['surah-dir'], 'surah.json')), readJson(path.join(args['surah-dir'], 'segments.json')))
const only = args.surahs ? new Set(String(args.surahs).split(',').map(Number)) : null
const surahs = Object.keys(files).map(Number).filter((s) => !only || only.has(s)).sort((a, b) => a - b)
if (!surahs.length) fail('no surahs found in the package (or none of --surahs)')

const quran = readJson(path.join(app, 'src/assets/quran.json'))
const out = path.join(app, 'public/recitations', args.slug)
fs.mkdirSync(path.join(out, 'audio'), { recursive: true })
const pad = (n) => String(n).padStart(3, '0')

/** Put the audio file next to the app and return its path inside the reciter folder. */
async function localAudio(url, name) {
  const target = path.join(out, 'audio', name)
  if (fs.existsSync(target)) return `audio/${name}`
  if (args.audio) {
    const base = path.basename(new URL(url, 'https://x/').pathname)
    for (const cand of [base, name]) {
      const src = path.join(args.audio, cand)
      if (fs.existsSync(src)) { fs.copyFileSync(src, target); return `audio/${name}` }
    }
    if (!args['fetch-audio']) fail(`audio for ${name} not found in ${args.audio} (looked for ${base} and ${name})`)
  }
  const res = await fetch(url)
  if (!res.ok) fail(`could not download ${url} (${res.status})`)
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()))
  return `audio/${name}`
}

let words = 0
for (const s of surahs) {
  const f = files[s]
  if (!quran[s]) fail(`surah ${s} is not in the app's Qur'an text`)
  const perAyah = Object.fromEntries(quran[s].v.map(([a, text]) => [a, text.trim().split(/\s+/).length]))
  const report = coverage(f, perAyah)
  if (f.kind === 'surah') f.audio = await localAudio(f.audio, `${pad(s)}.mp3`)
  for (const [a, row] of Object.entries(f.ayahs)) {
    if (row.audio) row.audio = await localAudio(row.audio, `${pad(s)}${pad(a)}.mp3`)
    words += row.words.length
  }
  fs.writeFileSync(path.join(out, `${pad(s)}.json`), JSON.stringify(f))
  const note = report.partial.length || report.missing.length ? ` — check ayat ${[...report.partial, ...report.missing].join(', ')}` : ''
  console.log(`surah ${s}: ${report.full}/${Object.keys(perAyah).length} ayat with timings for every word${note}`)
}

const indexFile = path.join(app, 'public/recitations/index.json')
const index = fs.existsSync(indexFile) ? readJson(indexFile).filter((r) => r.slug !== args.slug) : []
index.push({ slug: args.slug, name: args.name, kind: files[surahs[0]].kind, surahs, source: 'QUL — qul.tarteel.ai' })
fs.writeFileSync(indexFile, JSON.stringify(index, null, 1))
console.log(`imported ${args.name}: ${surahs.length} surahs, ${words} timed words -> public/recitations/${args.slug}/`)
