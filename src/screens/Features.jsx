import { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { analyze, pick } from '../lib/data'
import { Anim } from '../components/Lottie'
import { fmtTime } from '../lib/prayerTimes'
import { notifyStatus, askNotifyPermission } from '../lib/notify'
import { getLocation } from '../lib/location'
import { useAlarms, addAlarm, removeAlarm, ring, unlockAudio, todaysTimes, currentPeriod, alarmTime, hm, hmToDate, prayerName, localeOf, PRAYERS, TASKS, LEVELS } from '../lib/alarms'
import BarcodeCam from '../components/BarcodeCam'
import IngredientOCR from '../components/IngredientOCR'
import { OCR_BLOCK, OCR_TRUST } from '../lib/ocrPrep'
import { createPrayerCameraController } from '../lib/prayerCamera'

const Back = ({ onClick }) => (
  <button className="back-ic" onClick={onClick} aria-label="back">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
)

/* ---------------- Scanner ---------------- */
export function Scanner() {
  const { t, lang, go , back} = useApp()
  const [tab, setTab] = useState('paste')
  const [text, setText] = useState('')
  const [ocrConf, setOcrConf] = useState(null) // set after an OCR read, cleared once the user edits the text
  const [result, setResult] = useState(null)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')

  const show = (name, txt, trusted = true) => setResult({ name, ...analyze(txt || '', { trusted }) })

  async function lookup(c) {
    c = String(c).trim(); if (!/^\d{6,14}$/.test(c)) return
    setStatus(t.looking); setResult(null)
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name,brands,ingredients_text,ingredients_text_en,labels,lang`)
      const d = await r.json(); setStatus('')
      if (d.status === 1 && d.product) {
        const p = d.product
        // a clean verdict is only trusted when the ingredient text is English or Arabic
        const trusted = Boolean(p.ingredients_text_en) || ['en', 'ar'].includes(p.lang)
        show([p.product_name, p.brands].filter(Boolean).join(' · ') || 'Product',
          [p.ingredients_text_en || p.ingredients_text, p.labels].filter(Boolean).join('. '), trusted)
      } else show(t.notfound, '')
    } catch { setStatus(t.neterr) }
  }

  const verdict = result && (result.v === 'ok' ? t.vOk : result.v === 'warn' ? t.vWarn : result.v === 'bad' ? t.vBad : t.vUnknown)
  const icon = { ok: '✓', warn: '!', bad: '✕', unknown: '?' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.scanH1}</div><div className="h2">{t.scanH2}</div></div>
        <span className="ar-tag">حلال</span>
      </div>
      <div className="feat-body">
        <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
          {['barcode', 'photo', 'paste'].map((x) => (
            <button key={x} className="btn ghost" style={{ flex: 1, minHeight: 42, padding: '10px 6px', borderColor: tab === x ? 'var(--accent)' : undefined, color: tab === x ? 'var(--accent)' : undefined }} onClick={() => { setTab(x); setResult(null) }}>
              {x === 'barcode' ? t.tabBarcode : x === 'photo' ? (lang === 'ar' ? 'صورة' : 'Photo') : t.tabPaste}
            </button>
          ))}
        </div>

        {tab === 'barcode' ? (
          <>
            <BarcodeCam lang={lang} onCode={(c) => { setCode(c); lookup(c) }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input className="name-input" inputMode="numeric" placeholder="3017624010701" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup(code)} />
              <button className="btn" onClick={() => lookup(code)}>{t.bcLookup}</button>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {['3017624010701', '5000159407236', '7622210449283'].map((c) => (
                <button key={c} className="btn ghost" style={{ minHeight: 36, fontSize: 11, padding: '7px 11px' }} onClick={() => { setCode(c); lookup(c) }}>{c}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            {tab === 'photo'
              ? <IngredientOCR lang={lang} onResult={({ text: tx, conf }) => { setText(tx); setOcrConf(conf) }} />
              : <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{t.pasteLead}</p>}
            <textarea className="paste" value={text} onChange={(e) => { setText(e.target.value); setOcrConf(null) }} placeholder="Sugar, palm oil, gelatin, soy lecithin, mono- and diglycerides…" />
            <button className="btn block" style={{ marginTop: 12 }} disabled={!text.trim() || (ocrConf != null && ocrConf < OCR_BLOCK)} onClick={() => show(tab === 'photo' ? 'Photo ingredients' : 'Pasted ingredients', text, ocrConf == null || ocrConf >= OCR_TRUST)}>{t.analyze}</button>
          </>
        )}

        {status && <p style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>{status}</p>}

        {result && verdict && (
          <div>
            {result.name && <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 15 }}>{result.name}</div>}
            <div className={`verdict ${result.v}`}>
              <div className="vb">{icon[result.v]}</div>
              <div><div className="vt">{verdict[0]}</div><div className="vs">{verdict[1]}</div></div>
            </div>
            {result.found.map((f) => (
              <div key={f.id} className="flg">
                <div className="fn">{pick(f.n, lang)} · {f.s === 'haram' ? t.haram : t.doubtful}</div>
                <div className="fw">{pick(f.w, lang)}</div>
              </div>
            ))}
            {result.cert && <div className="fine">{lang === 'ar' ? 'النص يذكر كلمة «حلال» — هذا ادّعاء على الملصق ولم نتحقق منه.' : 'The text mentions "halal" — that is a label claim we have not verified.'}</div>}
            <div className="fine">{t.scanFine}</div>
            {result.found[0] && (
              <button className="btn ghost block" style={{ marginTop: 12 }}
                onClick={() => go('rashed', (result.found[0].n.ar) + ' حلال')}>{t.askRashed}</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Alarm ---------------- */
const ALM = {
  en: {
    here: 'Prayer times for your location', makkah: 'Prayer times for Makkah — use your location for local times',
    useLoc: 'Use my location', blocked: 'Couldn’t get your location — using Makkah times.',
    for: 'Alarm for', custom: 'Set time', time: 'Alarm time',
    repeat: 'Repeat', once: 'Once', daily: 'Every day', days: 'Choose days',
    task: 'Task to stop it', none: 'None', math: 'Sum', scramble: 'Word', sort: 'Sort', path: 'Path',
    level: 'Difficulty', easy: 'Easy', medium: 'Medium', hard: 'Hard',
    set: 'Set alarm', test: 'Test alarm', setOk: (x) => `Alarm set for ${x}`, needTime: 'Choose a time first',
    needDay: 'Choose at least one day', list: 'Your alarms', empty: 'No alarms yet',
    remove: 'Delete', removed: 'Alarm deleted', withTask: 'task',
    note: 'Keep this tab open: the browser can only ring while the app is open. Allow notifications to be alerted from other tabs.',
  },
  ar: {
    here: 'مواقيت الصلاة حسب موقعك', makkah: 'مواقيت مكة المكرمة — استخدم موقعك لمواقيت مدينتك',
    useLoc: 'استخدم موقعي', blocked: 'تعذّر تحديد موقعك — نستخدم مواقيت مكة.',
    for: 'المنبّه لـ', custom: 'وقت يدوي', time: 'وقت المنبّه',
    repeat: 'التكرار', once: 'مرة واحدة', daily: 'كل يوم', days: 'أيام معيّنة',
    task: 'مهمة لإيقافه', none: 'بدون', math: 'جمع', scramble: 'كلمة', sort: 'ترتيب', path: 'مسار',
    level: 'الصعوبة', easy: 'سهلة', medium: 'متوسطة', hard: 'صعبة',
    set: 'تفعيل المنبّه', test: 'تجربة المنبّه', setOk: (x) => `تم ضبط المنبّه على ${x}`, needTime: 'حدّد الوقت أولًا',
    needDay: 'اختر يومًا واحدًا على الأقل', list: 'منبّهاتك', empty: 'لا توجد منبّهات',
    remove: 'حذف', removed: 'تم حذف المنبّه', withTask: 'مهمة',
    note: 'أبقِ هذه الصفحة مفتوحة: المتصفح لا يرنّ إلا والتطبيق مفتوح. اسمح بالإشعارات لتنبيهك من الصفحات الأخرى.',
  },
  de: {
    here: 'Gebetszeiten für deinen Standort', makkah: 'Gebetszeiten für Mekka — nutze deinen Standort für lokale Zeiten',
    useLoc: 'Meinen Standort nutzen', blocked: 'Standort nicht verfügbar — wir nutzen die Zeiten von Mekka.',
    for: 'Wecker für', custom: 'Eigene Zeit', time: 'Weckzeit',
    repeat: 'Wiederholen', once: 'Einmal', daily: 'Täglich', days: 'Tage wählen',
    task: 'Aufgabe zum Ausschalten', none: 'Keine', math: 'Rechnen', scramble: 'Wort', sort: 'Sortieren', path: 'Weg',
    level: 'Schwierigkeit', easy: 'Leicht', medium: 'Mittel', hard: 'Schwer',
    set: 'Wecker stellen', test: 'Wecker testen', setOk: (x) => `Wecker gestellt auf ${x}`, needTime: 'Wähle zuerst eine Uhrzeit',
    needDay: 'Wähle mindestens einen Tag', list: 'Deine Wecker', empty: 'Noch keine Wecker',
    remove: 'Löschen', removed: 'Wecker gelöscht', withTask: 'Aufgabe',
    note: 'Lass diesen Tab offen: Der Browser kann nur klingeln, solange die App geöffnet ist. Erlaube Benachrichtigungen, um auch in anderen Tabs gewarnt zu werden.',
  },
  fr: {
    here: 'Horaires de prière pour votre position', makkah: 'Horaires de prière de La Mecque — utilisez votre position pour vos horaires locaux',
    useLoc: 'Utiliser ma position', blocked: 'Position indisponible — horaires de La Mecque utilisés.',
    for: 'Réveil pour', custom: 'Heure libre', time: 'Heure du réveil',
    repeat: 'Répétition', once: 'Une fois', daily: 'Chaque jour', days: 'Choisir les jours',
    task: 'Tâche pour l’arrêter', none: 'Aucune', math: 'Calcul', scramble: 'Mot', sort: 'Tri', path: 'Chemin',
    level: 'Difficulté', easy: 'Facile', medium: 'Moyenne', hard: 'Difficile',
    set: 'Activer le réveil', test: 'Tester le réveil', setOk: (x) => `Réveil réglé sur ${x}`, needTime: 'Choisissez d’abord une heure',
    needDay: 'Choisissez au moins un jour', list: 'Vos réveils', empty: 'Aucun réveil pour l’instant',
    remove: 'Supprimer', removed: 'Réveil supprimé', withTask: 'tâche',
    note: 'Gardez cet onglet ouvert : le navigateur ne peut sonner que si l’app est ouverte. Autorisez les notifications pour être alerté depuis d’autres onglets.',
  },
  es: {
    here: 'Horarios de oración para tu ubicación', makkah: 'Horarios de oración de La Meca — usa tu ubicación para los horarios locales',
    useLoc: 'Usar mi ubicación', blocked: 'Ubicación no disponible — usamos los horarios de La Meca.',
    for: 'Alarma para', custom: 'Hora propia', time: 'Hora de la alarma',
    repeat: 'Repetir', once: 'Una vez', daily: 'Cada día', days: 'Elegir días',
    task: 'Tarea para apagarla', none: 'Ninguna', math: 'Suma', scramble: 'Palabra', sort: 'Ordenar', path: 'Camino',
    level: 'Dificultad', easy: 'Fácil', medium: 'Media', hard: 'Difícil',
    set: 'Activar alarma', test: 'Probar alarma', setOk: (x) => `Alarma puesta a las ${x}`, needTime: 'Elige una hora primero',
    needDay: 'Elige al menos un día', list: 'Tus alarmas', empty: 'Aún no hay alarmas',
    remove: 'Eliminar', removed: 'Alarma eliminada', withTask: 'tarea',
    note: 'Mantén esta pestaña abierta: el navegador solo puede sonar mientras la app está abierta. Permite las notificaciones para recibir avisos desde otras pestañas.',
  },
  ja: {
    here: '現在地の礼拝時刻', makkah: 'マッカの礼拝時刻 — 現在地を使うと地元の時刻になります',
    useLoc: '現在地を使う', blocked: '現在地を取得できません — マッカの時刻を使います。',
    for: 'アラームの対象', custom: '時刻を指定', time: 'アラーム時刻',
    repeat: '繰り返し', once: '1回', daily: '毎日', days: '曜日を選ぶ',
    task: '止めるための課題', none: 'なし', math: '計算', scramble: '言葉', sort: '並べ替え', path: '道順',
    level: '難しさ', easy: 'やさしい', medium: 'ふつう', hard: 'むずかしい',
    set: 'アラームを設定', test: 'アラームを試す', setOk: (x) => `${x}にアラームを設定しました`, needTime: '先に時刻を選んでください',
    needDay: '曜日を1つ以上選んでください', list: 'アラーム一覧', empty: 'アラームはまだありません',
    remove: '削除', removed: 'アラームを削除しました', withTask: '課題',
    note: 'このタブを開いたままにしてください。ブラウザはアプリが開いている間しか鳴らせません。通知を許可すると、他のタブでもお知らせします。',
  },
}

const Seg = ({ value, options, onChange, label }) => (
  <div className="alm-seg" role="radiogroup" aria-label={label}>
    {options.map(([k, txt]) => (
      <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{txt}</button>
    ))}
  </div>
)

export function Alarm() {
  const { t, lang, back, loc, setLoc } = useApp()
  const s = ALM[lang] || ALM.en
  const isAr = lang === 'ar'
  const nm = (k) => prayerName(k, lang)
  const { alarms } = useAlarms()

  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  const times = useMemo(() => todaysTimes(loc, now), [loc, now.getDate()])   // eslint-disable-line react-hooks/exhaustive-deps
  const period = currentPeriod(times, now)

  const [prayer, setPrayer] = useState('fajr')       // a prayer key, or 'custom'
  const [time, setTime] = useState('')
  const [repeat, setRepeat] = useState('daily')       // once | daily | days
  const [days, setDays] = useState([])
  const [task, setTask] = useState('math')            // 'none' or one of TASKS
  const [level, setLevel] = useState('medium')
  const [msg, setMsg] = useState(null)

  const locale = localeOf(lang)
  const dayNames = useMemo(() => Array.from({ length: 7 }, (_, d) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + d))), [locale])   // 7 Jan 2024 was a Sunday
  const at = (hhmm) => fmtTime(hmToDate(hhmm), lang)
  const flash = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 2200) }

  function draft() {
    return {
      prayer: prayer === 'custom' ? null : prayer, time: prayer === 'custom' ? time : null,
      repeat, days: repeat === 'days' ? [...days].sort() : [],
      task: task === 'none' ? null : task, level,
    }
  }

  function save() {
    unlockAudio()
    if (prayer === 'custom' && !time) return flash(false, s.needTime)
    if (repeat === 'days' && !days.length) return flash(false, s.needDay)
    addAlarm(draft())
    flash(true, s.setOk(at(prayer === 'custom' ? time : times[prayer])))
    if (notifyStatus() === 'default') askNotifyPermission()
  }

  function test() {
    unlockAudio()
    ring({ ...draft(), id: 'test', test: true, at: prayer === 'custom' ? (time || hm(new Date())) : times[prayer] })
  }

  function locate() {
    getLocation().then(setLoc, () => flash(false, s.blocked))
  }

  const repeatText = (a) =>
    a.repeat === 'once' ? s.once : a.repeat === 'daily' ? s.daily : a.days.map((d) => dayNames[d]).join(isAr ? '، ' : lang === 'ja' ? '、' : ', ')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.alarmH1}</div><div className="h2">{t.alarmH2}</div></div>
        <span className="ar-tag">منبّه</span>
      </div>
      <div className="feat-body alm">
        <div className={`alm-clock p-${period}`}>
          <div className="alm-now" dir="ltr">{now.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
          <div className="alm-date">{now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div className="alm-loc">
            {loc ? s.here : s.makkah}
            {!loc && <button type="button" className="alm-link" onClick={locate}>{s.useLoc}</button>}
          </div>
        </div>

        <section className="alm-card">
          <div className="alm-label">{s.for}</div>
          <div className="alm-prayers" role="radiogroup" aria-label={s.for}>
            {[...PRAYERS, 'custom'].map((k) => (
              <button key={k} type="button" role="radio" aria-checked={prayer === k}
                className={`alm-prayer p-${k}${prayer === k ? ' on' : ''}`} onClick={() => setPrayer(k)}>
                <b>{k === 'custom' ? s.custom : nm(k)}</b>
                <span>{k === 'custom' ? (time ? at(time) : '—') : at(times[k])}</span>
              </button>
            ))}
          </div>
          {prayer === 'custom' && (
            <label className="alm-row">{s.time}
              <input type="time" className="name-input alm-time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          )}

          <div className="alm-label">{s.repeat}</div>
          <Seg label={s.repeat} value={repeat} onChange={setRepeat} options={[['once', s.once], ['daily', s.daily], ['days', s.days]]} />
          {repeat === 'days' && (
            <div className="alm-days">
              {dayNames.map((d, i) => (
                <button key={i} type="button" aria-pressed={days.includes(i)} className={days.includes(i) ? 'on' : ''}
                  onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>{d}</button>
              ))}
            </div>
          )}

          <div className="alm-label">{s.task}</div>
          <Seg label={s.task} value={task} onChange={setTask} options={['none', ...TASKS].map((k) => [k, s[k]])} />
          {task !== 'none' && (
            <>
              <div className="alm-label">{s.level}</div>
              <Seg label={s.level} value={level} onChange={setLevel} options={LEVELS.map((k) => [k, s[k]])} />
            </>
          )}

          <div className="alm-actions">
            <button className="btn" onClick={save}>{s.set}</button>
            <button className="btn ghost" onClick={test}>{s.test}</button>
          </div>
          {msg && <div className={`alm-msg${msg.ok ? ' ok' : ''}`} role="status">{msg.text}</div>}
        </section>

        <section className="alm-card">
          <div className="alm-label">{s.list}</div>
          {!alarms.length && <div className="alm-empty">{s.empty}</div>}
          {alarms.map((a) => (
            <div key={a.id} className={`alm-item p-${a.prayer || 'custom'}`}>
              <div>
                <div className="alm-item-t"><b>{at(alarmTime(a, times))}</b> <span>{a.prayer ? nm(a.prayer) : s.custom}</span></div>
                <div className="alm-item-s">{repeatText(a)}{a.task ? ` · ${s.withTask}: ${s[a.task]}` : ''}</div>
              </div>
              <button type="button" className="btn ghost alm-del" onClick={() => { removeAlarm(a.id); flash(true, s.removed) }}>{s.remove}</button>
            </div>
          ))}
        </section>

        <p className="alm-note">{s.note}</p>
      </div>
    </div>
  )
}

/* ---------------- Map (Leaflet loaded on demand) ---------------- */
export function MapScreen() {
  const { t, go, back, loc, setLoc } = useApp()
  const [phase, setPhase] = useState(loc ? 'map' : 'gate')
  const [status, setStatus] = useState('')
  const mapRef = useRef(null)

  useEffect(() => { if (phase === 'map' && loc) start(loc) /* eslint-disable-next-line */ }, [phase])

  function requestLoc() {
    setStatus(t.mapLocating)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { const l = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setLoc(l); setPhase('map') },
        () => setStatus(t.mapDenied), { enableHighAccuracy: false, timeout: 8000 })
    } else setStatus(t.mapDenied)
  }

  async function loadLeaflet() {
    if (window.L) return
    await new Promise((res) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l); res() })
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s) })
  }

  async function start(l) {
    setStatus(t.mapSearching)
    await loadLeaflet()
    const L = window.L
    if (!mapRef.current._map) {
      const map = L.map(mapRef.current).setView([l.lat, l.lng], 14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map)
      mapRef.current._map = map
      L.circleMarker([l.lat, l.lng], { radius: 7, color: '#48B9A2', fillColor: '#48B9A2', fillOpacity: .9 }).addTo(map)
      setTimeout(() => map.invalidateSize(), 200)
      const q = `[out:json][timeout:20];(node["amenity"="place_of_worship"]["religion"="muslim"](around:3000,${l.lat},${l.lng});way["amenity"="place_of_worship"]["religion"="muslim"](around:3000,${l.lat},${l.lng}););out center 40;`
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q })
        const data = await res.json(); let n = 0
        ;(data.elements || []).forEach((el) => {
          const la = el.lat || (el.center && el.center.lat), ln = el.lon || (el.center && el.center.lon)
          if (la == null || ln == null) return; n++
          const nm = (el.tags && (el.tags['name:ar'] || el.tags.name)) || 'مسجد'
          L.marker([la, ln]).addTo(map).bindPopup(`<b>${nm}</b>`)
        })
        setStatus(n ? t.mapFound(n) : t.mapNone)
      } catch { setStatus(t.mapNone) }
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.mapH1}</div><div className="h2">{t.mapH2}</div></div>
        <span className="ar-tag">مساجد</span>
      </div>
      {phase === 'gate' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 30, textAlign: 'center' }}>
          <div style={{ width: 220, height: 130 }}><Anim name="mosque" /></div>
          <h1 className="display" style={{ fontSize: 20 }}>{t.mapGate}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: '30ch', marginBottom: 10 }}>{status || t.mapGateLead}</p>
          <button className="btn" onClick={requestLoc}>{t.mapUse}</button>
        </div>
      ) : (
        <>
          <div ref={mapRef} style={{ flex: 1, width: '100%' }} />
          <div style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--muted)', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>{status}</div>
        </>
      )}
    </div>
  )
}

/* ---------------- Salah camera (pose inference is implemented separately) ---------------- */
export function Salah() {
  const { t, lang, back } = useApp()
  const [cameraState, setCameraState] = useState('idle')
  const videoRef = useRef(null)
  const cameraRef = useRef(null)
  const ar = lang === 'ar'
  const text = {
    idle: ar ? 'تُستخدم الكاميرا لعرضك أثناء التدريب. لا يتم حفظ الفيديو أو رفعه.' : 'The camera shows you during practice. Video is not saved or uploaded.',
    starting: ar ? 'جارٍ طلب إذن الكاميرا…' : 'Requesting camera access…',
    active: ar ? 'الكاميرا تعمل. أوقفها في أي وقت.' : 'Camera is on. You can stop it at any time.',
    denied: ar ? 'لم يُسمح بالوصول إلى الكاميرا. يمكنك السماح بها من إعدادات المتصفح.' : 'Camera access was denied. You can allow it in your browser settings.',
    unavailable: ar ? 'لا توجد كاميرا متاحة على هذا الجهاز.' : 'No camera is available on this device.',
    busy: ar ? 'الكاميرا مستخدمة حاليًا. أغلق التطبيق الآخر ثم حاول مجددًا.' : 'The camera is in use. Close the other app and try again.',
    insecure: ar ? 'يتطلب الوصول للكاميرا صفحة آمنة عبر HTTPS.' : 'Camera access requires a secure HTTPS page.',
    error: ar ? 'تعذر تشغيل الكاميرا. تحقق من إعدادات الجهاز وحاول مجددًا.' : 'Could not start the camera. Check device settings and try again.',
  }

  function start() { void cameraRef.current?.start() }
  function stop() { cameraRef.current?.stop() }

  useEffect(() => {
    const camera = createPrayerCameraController(videoRef.current, { onState: setCameraState })
    cameraRef.current = camera
    return () => {
      camera.dispose()
      if (cameraRef.current === camera) cameraRef.current = null
    }
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.salahH1}</div><div className="h2">{t.salahH2}</div></div>
        <span className="ar-tag">صلاة</span>
      </div>
      <div className="feat-body">
        <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#05070a', aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={videoRef} playsInline muted autoPlay aria-label={ar ? 'معاينة الكاميرا' : 'Camera preview'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', visibility: cameraState === 'active' ? 'visible' : 'hidden' }} />
          {cameraState !== 'active' && <div style={{ position: 'relative', textAlign: 'center', padding: 26, color: 'var(--muted)' }}><p style={{ fontSize: 12.5, lineHeight: 1.6, maxWidth: '30ch' }}>{cameraState === 'idle' ? t.poseHint : text[cameraState]}</p></div>}
        </div>
        <p role="status" aria-live="polite" style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>{text[cameraState] || text.error}</p>
        <button className="btn block" disabled={cameraState === 'starting'} onClick={cameraState === 'active' ? stop : start}>{cameraState === 'active' ? (ar ? 'إيقاف الكاميرا' : 'Stop camera') : cameraState === 'starting' ? text.starting : t.poseStart}</button>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: 14 }}>{t.salahNote}</p>
      </div>
    </div>
  )
}
