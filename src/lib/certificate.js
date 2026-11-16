/* Read a photographed halal certificate (OCR text) and say what it claims.
   This never "verifies" a certificate: it finds the certifying body, the expiry date and whether the
   restaurant's name is on it, so the user knows what to check. Pure, so it runs in Node tests. */

// Well-known halal certification bodies. `re` matches the name as OCR usually reads it (case-insensitive).
// `weak` names are short or common words: they count only when the text also says "halal".
export const CERTIFIERS = [
  { id: 'jakim', name: 'JAKIM', country: 'MY', re: /\bJAKIM\b|Jabatan\s+Kemajuan\s+Islam/i },
  { id: 'mui', name: 'MUI / BPJPH', country: 'ID', re: /\bLPPOM\b|\bBPJPH\b|Majelis\s+Ulama\s+Indonesia|\bMUI\b/i },
  { id: 'muis', name: 'MUIS', country: 'SG', re: /\bMUIS\b|Majlis\s+Ugama\s+Islam\s+Singapura/i },
  { id: 'hfa', name: 'Halal Food Authority', country: 'GB', re: /Halal\s+Food\s+Authority|\bHFA\b/i },
  { id: 'hmc', name: 'Halal Monitoring Committee', country: 'GB', re: /Halal\s+Monitoring\s+Committee|\bHMC\b/i },
  { id: 'hce', name: 'Halal Certification Europe', country: 'GB', re: /Halal\s+Certification\s+Europe/i },
  { id: 'ifanca', name: 'IFANCA', country: 'US', re: /\bIFANCA\b|Islamic\s+Food\s+and\s+Nutrition\s+Council/i },
  { id: 'isna', name: 'ISNA Halal', country: 'US', re: /\bISNA\b/i },
  { id: 'hfsaa', name: 'HFSAA', country: 'US', re: /\bHFSAA\b|Halal\s+Food\s+Standards\s+Alliance/i },
  { id: 'hma', name: 'Halal Monitoring Authority', country: 'CA', re: /Halal\s+Monitoring\s+Authority|\bHMA\b/i },
  { id: 'afic', name: 'AFIC', country: 'AU', re: /\bAFIC\b|Australian\s+Federation\s+of\s+Islamic\s+Councils/i },
  { id: 'iccv', name: 'ICCV', country: 'AU', re: /\bICCV\b|Islamic\s+Co-?ordinating\s+Council\s+of\s+Victoria/i },
  { id: 'sanha', name: 'SANHA', country: 'ZA', re: /\bSANHA\b|South\s+African\s+National\s+Hala+l\s+Authority/i },
  { id: 'mjc', name: 'MJC Halaal Trust', country: 'ZA', re: /\bMJC\b|Muslim\s+Judicial\s+Council/i },
  { id: 'niht', name: 'NIHT', country: 'ZA', re: /\bNIHT\b|National\s+Independent\s+Hala+l\s+Trust/i },
  { id: 'esma', name: 'MoIAT / ESMA', country: 'AE', re: /\bESMA\b|\bMoIAT\b|Emirates\s+Authority\s+for\s+Standardi[sz]ation|Ministry\s+of\s+Industry\s+and\s+Advanced\s+Technology/i },
  { id: 'sfda', name: 'SFDA', country: 'SA', re: /\bSFDA\b|Saudi\s+Food\s+(and|&)\s+Drug\s+Authority/i },
  { id: 'gac', name: 'GCC Accreditation Center', country: 'GCC', re: /\bGAC\b|GCC\s+Accreditation\s+Cent(er|re)/i },
  { id: 'cicot', name: 'CICOT', country: 'TH', re: /\bCICOT\b|Central\s+Islamic\s+Committee\s+of\s+Thailand/i },
  { id: 'kmf', name: 'Korea Muslim Federation', country: 'KR', re: /Korea\s+Muslim\s+Federation|\bKMF\b/i },
  { id: 'jha', name: 'Japan Halal Association', country: 'JP', re: /Japan\s+Halal\s+Association|\bJHA\b/i },
  { id: 'jma', name: 'Japan Muslim Association', country: 'JP', re: /Japan\s+Muslim\s+Association/i },
  { id: 'naha', name: 'Nippon Asia Halal Association', country: 'JP', re: /Nippon\s+Asia\s+Halal|\bNAHA\b/i },
  { id: 'avs', name: 'AVS', country: 'FR', re: /\bA\.?\s?V\.?\s?S\b|A\s+Votre\s+Service/i, weak: true },
  { id: 'achahada', name: 'Achahada', country: 'FR', re: /\bAchahada\b/i },
  { id: 'gmp', name: 'Grande Mosquée de Paris', country: 'FR', re: /Grande\s+Mosqu[ée]e\s+de\s+Paris|\bSFCVH\b/i },
  { id: 'argml', name: 'Mosquée de Lyon (ARGML)', country: 'FR', re: /\bARGML\b|Grande\s+Mosqu[ée]e\s+de\s+Lyon/i },
  { id: 'halalcontrol', name: 'Halal Control', country: 'DE', re: /Halal\s+Control\b/i },
  { id: 'hqc', name: 'Halal Quality Control', country: 'NL', re: /Halal\s+Quality\s+Control|\bHQC\b/i },
  { id: 'tqhcc', name: 'Total Quality Halal Correct', country: 'NL', re: /Halal\s+Correct|\bTQHCC\b/i },
  { id: 'instituto', name: 'Instituto Halal', country: 'ES', re: /Instituto\s+Halal/i },
  { id: 'gimdes', name: 'GİMDES', country: 'TR', re: /\bG[İI]MDES\b/i },
  { id: 'diyanet', name: 'Helal Akreditasyon / Diyanet', country: 'TR', re: /\bDiyanet\b|Helal\s+Akreditasyon|\bHAK\b/i, weak: true },
]

// "halal" as it appears on certificates around the world (and as OCR tends to misspell it)
const HALAL_WORD = /\bh[ae]la+l\b|حلال|ハラール|할랄|清真/i

// words that come right before the expiry date
const EXPIRY_CUE = /(expir\w*|valid\s+(until|till|thru|through|to)|validity|until|exp\.?\s*date|date\s+of\s+expiry|صالح[ةه]?\s+(حتى|لغاية)|تنتهي|(تاريخ\s+)?الانتهاء|gültig\s+bis|valable\s+jusqu|expire\s+le|válido\s+hasta|vence|berlaku\s+(hingga|sampai)|tarikh\s+tamat|geçerlilik|有効期限)/giu

const MONTHS = {
  jan: 1, january: 1, janvier: 1, januar: 1, enero: 1, januari: 1,
  feb: 2, february: 2, fevrier: 2, février: 2, februar: 2, febrero: 2, februari: 2,
  mar: 3, march: 3, mars: 3, märz: 3, marz: 3, marzo: 3, maret: 3, mac: 3,
  apr: 4, april: 4, avril: 4, abril: 4,
  may: 5, mai: 5, mayo: 5, mei: 5,
  jun: 6, june: 6, juin: 6, juni: 6, junio: 6,
  jul: 7, july: 7, juillet: 7, juli: 7, julio: 7, julai: 7,
  aug: 8, august: 8, aout: 8, août: 8, agosto: 8, agustus: 8, ogos: 8,
  sep: 9, sept: 9, september: 9, septembre: 9, septiembre: 9,
  oct: 10, october: 10, octobre: 10, oktober: 10, octubre: 10,
  nov: 11, november: 11, novembre: 11, noviembre: 11,
  dec: 12, december: 12, decembre: 12, décembre: 12, dezember: 12, diciembre: 12, disember: 12, desember: 12,
}
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')

const okYear = (y) => y >= 2000 && y <= 2100 // Hijri years (14xx) and OCR noise are ignored
const ymd = (y, m, d) => {
  if (!okYear(y) || m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCMonth() === m - 1 ? dt : null // rejects 31 Feb
}
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/**
 * Every Gregorian date in the text, with its position. A numeric date that could be day/month or
 * month/day (03/04/2026) keeps both readings, so the caller can tell when the answer depends on it.
 */
export function findDates(text) {
  const s = String(text || '')
  const out = []
  const add = (m, options) => {
    const o = options.filter(Boolean)
    if (o.length) out.push({ index: m.index, end: m.index + m[0].length, options: o })
  }
  const covered = (i) => out.some((d) => i >= d.index && i < d.end)
  let m
  // 2026-12-31, 2026/12/31
  const iso = /\b(20\d\d)[-/.](\d{1,2})[-/.](\d{1,2})\b/g
  while ((m = iso.exec(s))) add(m, [ymd(+m[1], +m[2], +m[3])])
  // 31/12/2026, 12-31-2026, 31.12.26 — a two-digit year only with / or . and from 2015 to 2045,
  // so phone numbers (12-34-56) are not read as dates
  const num = /\b(\d{1,2})([-/.])(\d{1,2})\2(\d{4}|\d{2})\b/g
  while ((m = num.exec(s))) {
    if (covered(m.index)) continue
    if (m[4].length === 2 && (m[2] === '-' || +m[4] < 15 || +m[4] > 45)) continue
    const y = m[4].length === 2 ? 2000 + +m[4] : +m[4]
    const a = +m[1], b = +m[3]
    const dm = ymd(y, b, a), md = ymd(y, a, b)
    add(m, a === b || !md ? [dm] : !dm ? [md] : [dm, md])
  }
  // 31 December 2026, 31st Dec. 2026, 31 de diciembre de 2026
  const dMy = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th|er)?\\.?\\s*(?:de\\s+)?(${MONTH_RE})\\.?,?\\s*(?:de\\s+)?(20\\d\\d)\\b`, 'giu')
  while ((m = dMy.exec(s))) add(m, [ymd(+m[3], MONTHS[m[2].toLowerCase()], +m[1])])
  // December 31, 2026
  const Mdy = new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d\\d)\\b`, 'giu')
  while ((m = Mdy.exec(s))) if (!covered(m.index)) add(m, [ymd(+m[3], MONTHS[m[1].toLowerCase()], +m[2])])
  // December 2026 (valid to the end of that month), only when it is not part of a full date
  const My = new RegExp(`\\b(${MONTH_RE})\\.?\\s+(20\\d\\d)\\b`, 'giu')
  while ((m = My.exec(s))) {
    if (covered(m.index)) continue
    const mo = MONTHS[m[1].toLowerCase()], y = +m[2]
    add(m, [ymd(y, mo, lastDay(y, mo))])
  }
  return out.sort((x, y) => x.index - y.index)
}

/** The expiry date: the first date after an expiry cue, else the latest date (issue dates come first). */
export function findExpiry(text) {
  const s = String(text || '')
  const dates = findDates(s)
  if (!dates.length) return null
  EXPIRY_CUE.lastIndex = 0
  let cue
  while ((cue = EXPIRY_CUE.exec(s))) {
    const end = cue.index + cue[0].length
    const d = dates.find((x) => x.index >= end && x.index - end <= 40)
    if (d) return { options: d.options, cued: true }
  }
  const latest = (d) => Math.max(...d.options.map(Number))
  const best = dates.reduce((a, b) => (latest(b) > latest(a) ? b : a))
  return { options: best.options, cued: false }
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
const GENERIC = new Set(['restaurant', 'restaurante', 'cafe', 'kitchen', 'grill', 'house', 'the', 'and', 'halal', 'food', 'ltd', 'limited', 'mosque', 'masjid', 'centre', 'center', 'de', 'la', 'le', 'al', 'el'])

/** Does the certificate name this place? Compares the distinctive words of the name (OCR-tolerant). */
export function namesPlace(text, placeName) {
  const words = norm(placeName).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !GENERIC.has(w))
  if (!words.length) return null // nothing distinctive to look for
  const hay = norm(text).replace(/[^\p{L}\p{N}]+/gu, ' ')
  const hit = words.filter((w) => hay.includes(w)).length
  return hit / words.length >= 0.5
}

/**
 * Text read from a certificate -> what it says.
 *   status: 'valid' | 'expired' | 'checkDate' (depends on day/month order) | 'noDate' | 'notCert'
 */
export function readCertificate(text, { placeName = '', today = new Date() } = {}) {
  const s = String(text || '')
  const halal = HALAL_WORD.test(s)
  const bodies = CERTIFIERS.filter((c) => c.re.test(s) && (halal || !c.weak)).map(({ id, name, country }) => ({ id, name, country }))
  if (!halal && !bodies.length) return { status: 'notCert', bodies, halal, expiry: null, names: null }

  const exp = findExpiry(s)
  const names = placeName ? namesPlace(s, placeName) : null
  if (!exp) return { status: 'noDate', bodies, halal, expiry: null, names }

  const day = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const live = exp.options.map((d) => +d >= day)
  const status = live.every(Boolean) ? 'valid' : live.some(Boolean) ? 'checkDate' : 'expired'
  const expiry = exp.options.reduce((a, b) => (b > a ? b : a))
  const daysLeft = Math.round((+expiry - day) / 86400000)
  return { status, bodies, halal, expiry, options: exp.options, daysLeft, cued: exp.cued, names }
}
