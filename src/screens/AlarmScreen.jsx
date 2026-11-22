// Prayer alarm screen: the next prayer, one switch per prayer, and a sheet for each alarm's details.
import { useState, useEffect, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { fmtTime, prayerTimes, nextPrayer } from '../lib/prayerTimes'
import { notifyStatus, askNotifyPermission } from '../lib/notify'
import { getLocation, saveLocation } from '../lib/location'
import { formatDuration } from '../lib/route'
import {
  useAlarms, addAlarm, updateAlarm, removeAlarm, restoreAlarm, savePrayerAlarm, ring, unlockAudio, todaysTimes, alarmTime,
  nextRing, whereFor, hm, hmToDate, prayerName, localeOf, PRAYERS, TASKS, LEVELS, MAKKAH,
} from '../lib/alarms'

const PRAYER_AR = Object.fromEntries(PRAYERS.map((k) => [k, prayerName(k, 'ar')]))

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

const NEW = {
  en: {
    next: 'Next prayer', inX: (x) => `in ${x}`, alarmOn: 'Alarm on', noAlarm: 'No alarm',
    warnTitle: 'These are not your prayer times yet',
    warn: 'Without your location the app uses Makkah’s times on your phone’s clock, so an alarm could ring hours early or late.',
    locSaved: 'Times for your location · saved on this device',
    notifyAsk: 'Allow alerts so a ringing alarm reaches you in other tabs.', notifyAllow: 'Allow alerts', notifyDenied: 'Alerts are blocked in your browser settings.',
    openNote: 'Alarms ring while this app is open in your browser.',
    prayersH: 'Prayer alarms', otherH: 'Other alarms', add: 'Add an alarm', adhan: (t) => `Adhan ${t}`,
    when: 'When', atAdhan: 'At the adhan', before: (m) => `${m} min before`, after: (m) => `${m} min after`, ringsAt: (t) => `Rings at ${t}`,
    save: 'Save', tryIt: 'Try it', undo: 'Undo', close: 'Close', deleteAlarm: 'Delete alarm', earlier: 'Earlier', later: 'Later',
    onToast: (n, x) => `${n} alarm on · rings ${x}`, offToast: (n) => `${n} alarm off`, savedToast: (x) => `Saved · rings ${x}`,
    taskHelp: { none: 'Just tap to stop', math: 'Add two numbers', scramble: 'Put the letters in order', sort: 'Put the numbers in order', path: 'Repeat a short pattern' },
    fajrTip: 'A task makes sure you are really awake for Fajr.',
  },
  ar: {
    next: 'الصلاة القادمة', inX: (x) => `بعد ${x}`, alarmOn: 'المنبّه مفعّل', noAlarm: 'بلا منبّه',
    warnTitle: 'هذه ليست مواقيت صلاتك بعد',
    warn: 'من دون موقعك يستخدم التطبيق مواقيت مكة على ساعة هاتفك، فقد يرنّ المنبّه قبل الوقت أو بعده بساعات.',
    locSaved: 'مواقيت موقعك · محفوظة على هذا الجهاز',
    notifyAsk: 'اسمح بالتنبيهات ليصلك المنبّه وأنت في صفحات أخرى.', notifyAllow: 'السماح بالتنبيهات', notifyDenied: 'التنبيهات محظورة في إعدادات المتصفح.',
    openNote: 'يرنّ المنبّه ما دام التطبيق مفتوحًا في المتصفح.',
    prayersH: 'منبّهات الصلاة', otherH: 'منبّهات أخرى', add: 'إضافة منبّه', adhan: (t) => `الأذان ${t}`,
    when: 'التوقيت', atAdhan: 'عند الأذان', before: (m) => `قبل ${m} دقيقة`, after: (m) => `بعد ${m} دقيقة`, ringsAt: (t) => `يرنّ ${t}`,
    save: 'حفظ', tryIt: 'جرّبه', undo: 'تراجع', close: 'إغلاق', deleteAlarm: 'حذف المنبّه', earlier: 'أبكر', later: 'أبطأ',
    onToast: (n, x) => `منبّه ${n} مفعّل · يرنّ ${x}`, offToast: (n) => `أُوقف منبّه ${n}`, savedToast: (x) => `تم الحفظ · يرنّ ${x}`,
    taskHelp: { none: 'اضغط لإيقافه فقط', math: 'اجمع عددين', scramble: 'رتّب الحروف', sort: 'رتّب الأرقام', path: 'كرّر نمطًا قصيرًا' },
    fajrTip: 'المهمة تضمن أنك استيقظت فعلًا لصلاة الفجر.',
  },
  de: {
    next: 'Nächstes Gebet', inX: (x) => `in ${x}`, alarmOn: 'Wecker an', noAlarm: 'Kein Wecker',
    warnTitle: 'Das sind noch nicht deine Gebetszeiten',
    warn: 'Ohne deinen Standort nutzt die App die Zeiten von Mekka auf deiner Uhr – ein Wecker könnte Stunden zu früh oder zu spät klingeln.',
    locSaved: 'Zeiten für deinen Standort · auf diesem Gerät gespeichert',
    notifyAsk: 'Erlaube Hinweise, damit dich ein Wecker auch in anderen Tabs erreicht.', notifyAllow: 'Hinweise erlauben', notifyDenied: 'Hinweise sind in den Browsereinstellungen blockiert.',
    openNote: 'Wecker klingeln, solange die App im Browser geöffnet ist.',
    prayersH: 'Gebetswecker', otherH: 'Weitere Wecker', add: 'Wecker hinzufügen', adhan: (t) => `Adhan ${t}`,
    when: 'Wann', atAdhan: 'Zum Adhan', before: (m) => `${m} Min. vorher`, after: (m) => `${m} Min. danach`, ringsAt: (t) => `Klingelt um ${t}`,
    save: 'Speichern', tryIt: 'Ausprobieren', undo: 'Rückgängig', close: 'Schließen', deleteAlarm: 'Wecker löschen', earlier: 'Früher', later: 'Später',
    onToast: (n, x) => `${n}-Wecker an · klingelt ${x}`, offToast: (n) => `${n}-Wecker aus`, savedToast: (x) => `Gespeichert · klingelt ${x}`,
    taskHelp: { none: 'Einfach antippen', math: 'Zwei Zahlen addieren', scramble: 'Buchstaben ordnen', sort: 'Zahlen ordnen', path: 'Ein Muster wiederholen' },
    fajrTip: 'Eine Aufgabe sorgt dafür, dass du zum Fadschr wirklich wach bist.',
  },
  fr: {
    next: 'Prochaine prière', inX: (x) => `dans ${x}`, alarmOn: 'Réveil activé', noAlarm: 'Pas de réveil',
    warnTitle: 'Ce ne sont pas encore vos horaires de prière',
    warn: 'Sans votre position, l’app utilise les horaires de La Mecque sur l’heure de votre téléphone : un réveil pourrait sonner des heures trop tôt ou trop tard.',
    locSaved: 'Horaires de votre position · enregistrée sur cet appareil',
    notifyAsk: 'Autorisez les alertes pour qu’un réveil vous atteigne dans d’autres onglets.', notifyAllow: 'Autoriser les alertes', notifyDenied: 'Les alertes sont bloquées dans les réglages du navigateur.',
    openNote: 'Les réveils sonnent tant que l’app est ouverte dans le navigateur.',
    prayersH: 'Réveils de prière', otherH: 'Autres réveils', add: 'Ajouter un réveil', adhan: (t) => `Adhan ${t}`,
    when: 'Quand', atAdhan: 'À l’adhan', before: (m) => `${m} min avant`, after: (m) => `${m} min après`, ringsAt: (t) => `Sonne à ${t}`,
    save: 'Enregistrer', tryIt: 'Essayer', undo: 'Annuler', close: 'Fermer', deleteAlarm: 'Supprimer le réveil', earlier: 'Plus tôt', later: 'Plus tard',
    onToast: (n, x) => `Réveil ${n} activé · sonne ${x}`, offToast: (n) => `Réveil ${n} désactivé`, savedToast: (x) => `Enregistré · sonne ${x}`,
    taskHelp: { none: 'Touchez simplement pour arrêter', math: 'Additionner deux nombres', scramble: 'Remettre les lettres en ordre', sort: 'Ranger les nombres', path: 'Répéter un motif court' },
    fajrTip: 'Une tâche vous assure d’être bien réveillé pour Fajr.',
  },
  es: {
    next: 'Próxima oración', inX: (x) => `en ${x}`, alarmOn: 'Alarma activada', noAlarm: 'Sin alarma',
    warnTitle: 'Todavía no son tus horarios de oración',
    warn: 'Sin tu ubicación, la app usa los horarios de La Meca en el reloj de tu teléfono, así que una alarma podría sonar horas antes o después.',
    locSaved: 'Horarios de tu ubicación · guardada en este dispositivo',
    notifyAsk: 'Permite avisos para que la alarma te llegue en otras pestañas.', notifyAllow: 'Permitir avisos', notifyDenied: 'Los avisos están bloqueados en los ajustes del navegador.',
    openNote: 'Las alarmas suenan mientras la app esté abierta en el navegador.',
    prayersH: 'Alarmas de oración', otherH: 'Otras alarmas', add: 'Añadir una alarma', adhan: (t) => `Adhan ${t}`,
    when: 'Cuándo', atAdhan: 'Con el adhan', before: (m) => `${m} min antes`, after: (m) => `${m} min después`, ringsAt: (t) => `Suena a las ${t}`,
    save: 'Guardar', tryIt: 'Probar', undo: 'Deshacer', close: 'Cerrar', deleteAlarm: 'Eliminar alarma', earlier: 'Antes', later: 'Después',
    onToast: (n, x) => `Alarma de ${n} activada · suena ${x}`, offToast: (n) => `Alarma de ${n} desactivada`, savedToast: (x) => `Guardada · suena ${x}`,
    taskHelp: { none: 'Solo toca para apagarla', math: 'Suma dos números', scramble: 'Ordena las letras', sort: 'Ordena los números', path: 'Repite un patrón corto' },
    fajrTip: 'Una tarea asegura que de verdad estés despierto para Fajr.',
  },
  ja: {
    next: '次の礼拝', inX: (x) => `あと${x}`, alarmOn: 'アラームあり', noAlarm: 'アラームなし',
    warnTitle: 'まだあなたの礼拝時刻ではありません',
    warn: '位置情報がないと、マッカの時刻をスマホの時計で表示するため、アラームが何時間もずれることがあります。',
    locSaved: '現在地の時刻 · この端末に保存済み',
    notifyAsk: '通知を許可すると、他のタブを見ていてもアラームが届きます。', notifyAllow: '通知を許可', notifyDenied: '通知はブラウザの設定でブロックされています。',
    openNote: 'アラームはこのアプリをブラウザで開いている間に鳴ります。',
    prayersH: '礼拝アラーム', otherH: 'その他のアラーム', add: 'アラームを追加', adhan: (t) => `アザーン ${t}`,
    when: 'タイミング', atAdhan: 'アザーンちょうど', before: (m) => `${m}分前`, after: (m) => `${m}分後`, ringsAt: (t) => `${t}に鳴ります`,
    save: '保存', tryIt: '試す', undo: '元に戻す', close: '閉じる', deleteAlarm: 'アラームを削除', earlier: '早く', later: '遅く',
    onToast: (n, x) => `${n}のアラームをオン · ${x}に鳴ります`, offToast: (n) => `${n}のアラームをオフ`, savedToast: (x) => `保存しました · ${x}に鳴ります`,
    taskHelp: { none: 'タップするだけ', math: '2つの数を足す', scramble: '文字を並べる', sort: '数字を並べる', path: '短いパターンをくり返す' },
    fajrTip: '課題があるとファジュルにしっかり目が覚めます。',
  },
}

const T = (lang) => ({ ...(ALM[lang] || ALM.en), ...(NEW[lang] || NEW.en) })

const TASK_IC = { none: '👆', math: '➕', scramble: '🔤', sort: '🔢', path: '🧩' }
const OFFSETS = { min: -60, max: 60, step: 5 }

const Back = ({ onClick }) => (
  <button className="back-ic" onClick={onClick} aria-label="back">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
)

const Seg = ({ value, options, onChange, label }) => (
  <div className="alm-seg" role="radiogroup" aria-label={label}>
    {options.map(([k, txt]) => (
      <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{txt}</button>
    ))}
  </div>
)

const Switch = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} className={`alm-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}><i /></button>
)

const offsetText = (s, m, num = String) => (!m ? s.atAdhan : m < 0 ? s.before(num(-m)) : s.after(num(m)))

/** The prayer alarm screen: next prayer, one switch per prayer, an editor sheet for the details. */
export default function AlarmScreen() {
  const { t, lang, back, loc, setLoc } = useApp()
  const s = T(lang)
  const isAr = lang === 'ar'
  const locale = localeOf(lang)
  const nm = (k) => prayerName(k, lang)
  const num = (n) => new Intl.NumberFormat(locale).format(n)
  const { alarms } = useAlarms()
  const where = whereFor(loc)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(id) }, [])
  const times = useMemo(() => todaysTimes(loc, now), [loc, where?.lat, now.getDate()]) // eslint-disable-line react-hooks/exhaustive-deps
  const next = useMemo(() => {
    const c = where || MAKKAH
    return nextPrayer(prayerTimes(c.lat, c.lng, now), now)
  }, [where?.lat, where?.lng, now]) // eslint-disable-line react-hooks/exhaustive-deps

  const [edit, setEdit] = useState(null) // the alarm being edited: a draft object
  const [toast, setToast] = useState(null) // { text, undo }
  const [notify, setNotify] = useState(() => notifyStatus())
  const toastTimer = useRef(null)

  const at = (hhmm) => fmtTime(hmToDate(hhmm), lang)
  const until = (date) => (date ? s.inX(formatDuration((date - new Date()) / 1000, locale)) : '')
  const dayNames = useMemo(() => Array.from({ length: 7 }, (_, d) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + d))), [locale])
  const repeatText = (a) => (a.repeat === 'once' ? s.once : a.repeat === 'daily' ? s.daily : a.days.map((d) => dayNames[d]).join(isAr ? '، ' : lang === 'ja' ? '、' : ', '))
  const byPrayer = Object.fromEntries(alarms.filter((a) => a.prayer).map((a) => [a.prayer, a]))
  const custom = alarms.filter((a) => !a.prayer)

  function say(text, undo) {
    clearTimeout(toastTimer.current)
    setToast({ text, undo })
    toastTimer.current = setTimeout(() => setToast(null), 4500)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function askAlerts() {
    if (notify === 'default') askNotifyPermission().then(() => setNotify(notifyStatus()), () => setNotify(notifyStatus()))
  }

  /** The switch on a prayer row: on with sensible defaults (Fajr gets a wake-up task), or off. */
  function togglePrayer(k, on) {
    unlockAudio()
    const a = byPrayer[k]
    if (!on) { updateAlarm(a.id, { on: false }); say(s.offToast(nm(k)), () => updateAlarm(a.id, { on: true })); return }
    const saved = a ? (updateAlarm(a.id, { on: true }), { ...a, on: true }) : savePrayerAlarm(k, k === 'fajr' ? { task: 'math', level: 'medium' } : {})
    say(s.onToast(nm(k), until(nextRing(saved, loc))))
    askAlerts()
  }
  function toggleCustom(a, on) {
    unlockAudio()
    updateAlarm(a.id, { on })
    say(on ? s.savedToast(until(nextRing({ ...a, on }, loc))) : s.offToast(at(a.time)), () => updateAlarm(a.id, { on: !on }))
  }

  const openPrayer = (k) => {
    const a = byPrayer[k]
    setEdit(a ? { ...a, offset: a.offset || 0 } : { prayer: k, time: null, repeat: 'daily', days: [], task: k === 'fajr' ? 'math' : null, level: 'medium', offset: 0, isNew: true })
  }
  const openCustom = (a) => setEdit(a ? { ...a } : { prayer: null, time: '', repeat: 'daily', days: [], task: null, level: 'medium', offset: 0, isNew: true })

  function locate() {
    getLocation().then((l) => { setLoc(l); saveLocation(l) }, () => say(s.blocked))
  }

  return (
    <div className="alm2" dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.alarmH1}</div><div className="h2">{t.alarmH2}</div></div>
        <span className="ar-tag">منبّه</span>
      </div>
      <div className="feat-body alm">
        {/* the next prayer, and whether its alarm is on */}
        <section className={`alm-next p-${next.key}`}>
          <div className="alm-next-l">
            <span className="alm-eyebrow">{s.next}</span>
            <b>{nm(next.key)}{!isAr && <span lang="ar"> {next.ar}</span>}</b>
            <span className="alm-next-t latin">{fmtTime(next.date, lang)} · {s.inX(formatDuration(next.ms / 1000, locale))}</span>
          </div>
          <button type="button" className={`alm-next-chip${byPrayer[next.key]?.on !== false && byPrayer[next.key] ? ' on' : ''}`} onClick={() => openPrayer(next.key)}>
            {byPrayer[next.key] && byPrayer[next.key].on !== false ? `⏰ ${s.alarmOn}` : `＋ ${s.noAlarm}`}
          </button>
        </section>

        {where ? (
          <p className="alm-loc-ok">📍 {s.locSaved}</p>
        ) : (
          <section className="alm-warn" role="alert">
            <b>{s.warnTitle}</b>
            <p>{s.warn}</p>
            <button type="button" className="btn" onClick={locate}>📍 {s.useLoc}</button>
          </section>
        )}

        <section className="alm-card alm-list">
          <h2 className="alm-h">{s.prayersH}</h2>
          {PRAYERS.map((k) => {
            const a = byPrayer[k]
            const on = !!a && a.on !== false
            return (
              <div key={k} className={`alm-prow p-${k}${on ? ' on' : ''}${next.key === k ? ' next' : ''}`}>
                <button type="button" className="alm-prow-main" onClick={() => openPrayer(k)}>
                  <span className="alm-dot" aria-hidden="true" />
                  <span className="alm-prow-name"><b>{nm(k)}</b>{!isAr && <small lang="ar">{PRAYER_AR[k]}</small>}</span>
                  <span className="alm-prow-time">
                    <b className="latin">{at(a ? alarmTime(a, times) : times[k])}</b>
                    <small>{on ? [a.offset ? offsetText(s, a.offset, num) : null, repeatText(a), a.task ? s[a.task] : null].filter(Boolean).join(' · ') : s.adhan(at(times[k]))}</small>
                  </span>
                </button>
                <Switch on={on} label={nm(k)} onChange={(v) => togglePrayer(k, v)} />
              </div>
            )
          })}
        </section>

        <section className="alm-card alm-list">
          <h2 className="alm-h">{s.otherH}</h2>
          {custom.map((a) => (
            <div key={a.id} className={`alm-prow p-custom${a.on !== false ? ' on' : ''}`}>
              <button type="button" className="alm-prow-main" onClick={() => openCustom(a)}>
                <span className="alm-dot" aria-hidden="true" />
                <span className="alm-prow-name"><b className="latin">{at(a.time)}</b><small>{repeatText(a)}{a.task ? ` · ${s[a.task]}` : ''}</small></span>
              </button>
              <Switch on={a.on !== false} label={at(a.time)} onChange={(v) => toggleCustom(a, v)} />
            </div>
          ))}
          <button type="button" className="alm-add" onClick={() => openCustom(null)}>＋ {s.add}</button>
        </section>

        {notify === 'default' && (
          <section className="alm-hint"><p>{s.notifyAsk}</p><button type="button" className="btn ghost" onClick={askAlerts}>{s.notifyAllow}</button></section>
        )}
        {notify === 'denied' && <p className="alm-note">{s.notifyDenied}</p>}
        <p className="alm-note">{s.openNote}</p>
      </div>

      {edit && (
        <Editor draft={edit} s={s} lang={lang} num={num} times={times} dayNames={dayNames} at={at} loc={loc}
          onClose={() => setEdit(null)}
          onSave={(d) => {
            unlockAudio()
            const { isNew, ...a } = d
            let saved
            if (a.prayer) saved = savePrayerAlarm(a.prayer, { offset: a.offset, repeat: a.repeat, days: a.days, task: a.task, level: a.level, on: true })
            else if (isNew) saved = addAlarm({ prayer: null, time: a.time, repeat: a.repeat, days: a.days, task: a.task, level: a.level })
            else { updateAlarm(a.id, { time: a.time, repeat: a.repeat, days: a.days, task: a.task, level: a.level, on: true }); saved = { ...a, on: true } }
            setEdit(null)
            say(s.savedToast(until(nextRing(saved, loc))))
            askAlerts()
          }}
          onDelete={(id) => { const gone = removeAlarm(id); setEdit(null); say(s.removed, () => restoreAlarm(gone)) }}
          onTry={(d) => { unlockAudio(); ring({ ...d, id: 'test', test: true, at: d.prayer ? alarmTime(d, times) : (d.time || hm(new Date())) }) }}
        />
      )}

      {toast && (
        <div className="alm-toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && <button type="button" onClick={() => { toast.undo(); setToast(null) }}>{s.undo}</button>}
        </div>
      )}
    </div>
  )
}

/** Bottom sheet with an alarm's details. */
function Editor({ draft, s, lang, num, times, dayNames, at, onClose, onSave, onDelete, onTry }) {
  const [d, setD] = useState(draft)
  const [err, setErr] = useState('')
  const set = (patch) => { setD((x) => ({ ...x, ...patch })); setErr('') }
  const title = d.prayer ? prayerName(d.prayer, lang) : s.custom
  const ringAt = d.prayer ? alarmTime(d, times) : d.time

  function save() {
    if (!d.prayer && !d.time) return setErr(s.needTime)
    if (d.repeat === 'days' && !d.days.length) return setErr(s.needDay)
    onSave({ ...d, days: d.repeat === 'days' ? [...d.days].sort() : [], task: d.task || null })
  }

  return (
    <div className="alm-sheet-bg" onClick={onClose}>
      <div className={`alm-sheet p-${d.prayer || 'custom'}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="alm-sheet-h">
          <h2>{title}{d.prayer && lang !== 'ar' && <span lang="ar"> · {PRAYER_AR[d.prayer]}</span>}</h2>
          <button type="button" className="alm-x" onClick={onClose} aria-label={s.close}>×</button>
        </div>

        {d.prayer ? (
          <>
            <div className="alm-label">{s.when}</div>
            <div className="alm-step">
              <button type="button" aria-label={s.earlier} disabled={d.offset <= OFFSETS.min} onClick={() => set({ offset: d.offset - OFFSETS.step })}>−</button>
              <div><b>{offsetText(s, d.offset, num)}</b><small>{s.adhan(at(times[d.prayer]))}</small></div>
              <button type="button" aria-label={s.later} disabled={d.offset >= OFFSETS.max} onClick={() => set({ offset: d.offset + OFFSETS.step })}>+</button>
            </div>
          </>
        ) : (
          <label className="alm-row">{s.time}
            <input type="time" className="name-input alm-time" value={d.time || ''} onChange={(e) => set({ time: e.target.value })} />
          </label>
        )}
        {ringAt && <p className="alm-rings latin">{s.ringsAt(at(ringAt))}</p>}

        <div className="alm-label">{s.repeat}</div>
        <Seg label={s.repeat} value={d.repeat} onChange={(v) => set({ repeat: v })} options={[['once', s.once], ['daily', s.daily], ['days', s.days]]} />
        {d.repeat === 'days' && (
          <div className="alm-days">
            {dayNames.map((name, i) => (
              <button key={i} type="button" aria-pressed={d.days.includes(i)} className={d.days.includes(i) ? 'on' : ''}
                onClick={() => set({ days: d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i] })}>{name}</button>
            ))}
          </div>
        )}

        <div className="alm-label">{s.task}</div>
        <div className="alm-tasks" role="radiogroup" aria-label={s.task}>
          {['none', ...TASKS].map((k) => {
            const on = (d.task || 'none') === k
            return (
              <button key={k} type="button" role="radio" aria-checked={on} className={on ? 'on' : ''} onClick={() => set({ task: k === 'none' ? null : k })}>
                <span aria-hidden="true">{TASK_IC[k]}</span><b>{s[k]}</b><small>{s.taskHelp[k]}</small>
              </button>
            )
          })}
        </div>
        {d.prayer === 'fajr' && !d.task && <p className="alm-tip">{s.fajrTip}</p>}
        {d.task && (
          <>
            <div className="alm-label">{s.level}</div>
            <Seg label={s.level} value={d.level} onChange={(v) => set({ level: v })} options={LEVELS.map((k) => [k, s[k]])} />
          </>
        )}

        {err && <p className="alm-msg" role="alert">{err}</p>}
        <div className="alm-actions">
          <button type="button" className="btn ghost" onClick={() => onTry(d)}>{s.tryIt}</button>
          <button type="button" className="btn" onClick={save}>{s.save}</button>
        </div>
        {!d.isNew && d.id && <button type="button" className="alm-del2" onClick={() => onDelete(d.id)}>{s.deleteAlarm}</button>}
      </div>
    </div>
  )
}
