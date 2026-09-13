// Prayer times from lat/lng — Muslim World League (Fajr 18°, Isha 17°).

const DEG = Math.PI / 180
const sin = (d) => Math.sin(d * DEG)
const cos = (d) => Math.cos(d * DEG)
const tan = (d) => Math.tan(d * DEG)
const arcsin = (x) => Math.asin(x) / DEG
const arccos = (x) => Math.acos(x) / DEG
const arccot = (x) => Math.atan(1 / x) / DEG
const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a }
const fixAngle = (a) => fix(a, 360)
const fixHour = (a) => fix(a, 24)

// Julian date
function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12 }
  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5
}

// sun position: returns { declination, equationOfTime }
function sunPosition(jd) {
  const D = jd - 2451545.0
  const g = fixAngle(357.529 + 0.98560028 * D)
  const q = fixAngle(280.459 + 0.98564736 * D)
  const L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g))
  const e = 23.439 - 0.00000036 * D
  const RA = fixHour(Math.atan2(cos(e) * sin(L), cos(L)) / DEG / 15)
  return { decl: arcsin(sin(e) * sin(L)), eqt: q / 15 - RA }
}

// hour angle for a given sun altitude
function sunAngleTime(angle, lat, decl, noon, dir) {
  const t = (1 / 15) * arccos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat)))
  return noon + (dir === 'ccw' ? -t : t)
}

// asr: shadow factor 1 (Shafi/Maliki/Hanbali), 2 (Hanafi)
function asrTime(factor, lat, decl, noon) {
  const angle = -arccot(factor + tan(Math.abs(lat - decl)))
  return sunAngleTime(angle, lat, decl, noon)
}

/** today's prayer times -> [{ key, ar, en, date }] in order Fajr…Isha */
export function prayerTimes(lat, lng, date = new Date(), method = { fajr: 18, isha: 17 }, asrFactor = 1) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate()
  const jd = julian(y, m, d) - lng / (15 * 24)
  const { decl, eqt } = sunPosition(jd)
  const noon = fixHour(12 - eqt - lng / 15)          // solar noon, UTC hours

  const times = {
    fajr: sunAngleTime(method.fajr, lat, decl, noon, 'ccw'),
    sunrise: sunAngleTime(0.833, lat, decl, noon, 'ccw'),
    dhuhr: noon + 1 / 60,
    asr: asrTime(asrFactor, lat, decl, noon),
    maghrib: sunAngleTime(0.833, lat, decl, noon),
    isha: sunAngleTime(method.isha, lat, decl, noon),
  }

  // UTC decimal hours -> local Date objects, in the device timezone
  const toDate = (h) => {
    if (!isFinite(h)) return null
    // build the moment in UTC, then let Date render it in local time
    const base = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
    return new Date(base + h * 3600000)
  }

  return [
    { key: 'fajr', ar: 'الفجر', en: 'Fajr', date: toDate(times.fajr) },
    { key: 'sunrise', ar: 'الشروق', en: 'Sunrise', date: toDate(times.sunrise), info: true },
    { key: 'dhuhr', ar: 'الظهر', en: 'Dhuhr', date: toDate(times.dhuhr) },
    { key: 'asr', ar: 'العصر', en: 'Asr', date: toDate(times.asr) },
    { key: 'maghrib', ar: 'المغرب', en: 'Maghrib', date: toDate(times.maghrib) },
    { key: 'isha', ar: 'العشاء', en: 'Isha', date: toDate(times.isha) },
  ]
}

/** which prayer is next, and how long until it */
export function nextPrayer(times, now = new Date()) {
  const list = times.filter((t) => t.date && !t.info)
  for (const p of list) if (p.date > now) return { ...p, ms: p.date - now, tomorrow: false }
  // past Isha → next is tomorrow's Fajr
  const first = list[0]
  const tomorrow = new Date(first.date.getTime() + 864e5)
  return { ...first, date: tomorrow, ms: tomorrow - now, tomorrow: true }
}

export function fmtTime(date, lang = 'en') {
  if (!date) return '—'
  return date.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : lang === 'ja' ? 'ja-JP' : 'en-US',
    { hour: 'numeric', minute: '2-digit' })
}

export function fmtRemaining(ms) {
  if (ms < 0) ms = 0
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000)
  const two = (n) => String(n).padStart(2, '0')
  return `${two(h)}:${two(m)}:${two(s)}`
}

// Hijri date (tabular civil calculation — may differ ±1 day from local sighting)
const HIJRI_MONTHS = ['محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجّة']
export function hijriDate(date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long', weekday: 'long', year: 'numeric' })
    return fmt.format(date)
  } catch {
    const jd = Math.floor((date - new Date(Date.UTC(622, 6, 16))) / 864e5)
    const l = jd + 10632, n = Math.floor((l - 1) / 10631)
    const j = l - 10631 * n
    const mo = Math.floor((24 * j) / 709) % 12
    return `${HIJRI_MONTHS[mo]} ${1 + n * 30}`
  }
}
