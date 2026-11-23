import { useEffect, useMemo, useRef, useState } from 'react'
import { Tracker, score } from '../lib/recite'
import { createListener, speechSupported } from '../lib/speech'
import { activeAt, ayahSpan, wordSpan } from '../lib/recitation'
import { loadReciters, loadRecitation } from '../lib/reciters'
import { loadHistory, saveHistory, addSession, clearPracticed, streak, weakWords, bestScore, today as todayStats } from '../lib/reciteHistory'

const T = {
  en: { toggle: 'Recite', consentTitle: 'Recite and get checked', consent: 'Your browser turns your voice into text. In Chrome and Edge this sends the audio to Google’s or Microsoft’s speech service. The app keeps only your results, on this device.', agree: 'I understand — start', unsupported: 'This browser cannot listen. Please use Chrome, Edge or Safari.',
    start: 'Start reciting', stop: 'Stop', listening: 'Listening… recite from where the highlight is', paused: 'Tap the microphone and recite', hide: 'Hide the text', again: 'Recite again', from: 'Start from this ayah',
    heard: 'Heard', progress: (d, n) => `${d} of ${n} words`, mistakes: (n) => `${n} mistake${n === 1 ? '' : 's'}`, summary: 'Your recitation', accuracy: 'accuracy', perfect: 'MashaAllah — no mistakes!',
    wrong: 'said instead', skip: 'skipped', last: (s) => `Last time: ${s}%`, tapAyah: 'Tap an ayah number to start there. Tap a hidden word to peek.',
    err: { denied: 'Microphone access was refused. Allow it in the browser settings.', nomic: 'No microphone was found.', network: 'The speech service could not be reached. Check your connection.', error: 'Listening stopped. Tap the microphone to try again.', unsupported: 'This browser cannot listen. Please use Chrome, Edge or Safari.' },
    note: 'Checks the words, not tajweed.' },
  ar: { toggle: 'تسميع', consentTitle: 'سمِّع واحصل على التصحيح', consent: 'يحوّل متصفحك صوتك إلى نص. في Chrome وEdge يُرسَل الصوت إلى خدمة الكلام لدى Google أو Microsoft. لا يحفظ التطبيق إلا نتائجك، على هذا الجهاز.', agree: 'فهمت — ابدأ', unsupported: 'هذا المتصفح لا يستطيع الاستماع. استخدم Chrome أو Edge أو Safari.',
    start: 'ابدأ التسميع', stop: 'إيقاف', listening: 'أستمع… اقرأ من الكلمة المظلَّلة', paused: 'اضغط الميكروفون واقرأ', hide: 'إخفاء النص', again: 'سمِّع مجددًا', from: 'ابدأ من هذه الآية',
    heard: 'سُمِع', progress: (d, n) => `${d} من ${n} كلمة`, mistakes: (n) => `${n} أخطاء`, summary: 'تسميعك', accuracy: 'دقة', perfect: 'ما شاء الله — بلا أخطاء!',
    wrong: 'قيل بدلًا منها', skip: 'سقطت', last: (s) => `المرة السابقة: ${s}٪`, tapAyah: 'اضغط رقم آية لتبدأ منها، واضغط كلمة مخفية لتلمحها.',
    err: { denied: 'رُفض الوصول إلى الميكروفون. اسمح به من إعدادات المتصفح.', nomic: 'لم يُعثر على ميكروفون.', network: 'تعذّر الوصول إلى خدمة الكلام. تحقّق من اتصالك.', error: 'توقف الاستماع. اضغط الميكروفون للمحاولة مجددًا.', unsupported: 'هذا المتصفح لا يستطيع الاستماع. استخدم Chrome أو Edge أو Safari.' },
    note: 'يراجع الكلمات، لا أحكام التجويد.' },
  de: { toggle: 'Rezitieren', consentTitle: 'Rezitieren und prüfen lassen', consent: 'Dein Browser wandelt deine Stimme in Text um. In Chrome und Edge wird der Ton dafür an den Sprachdienst von Google oder Microsoft gesendet. Die App speichert nur deine Ergebnisse, auf diesem Gerät.', agree: 'Verstanden — starten', unsupported: 'Dieser Browser kann nicht zuhören. Bitte Chrome, Edge oder Safari verwenden.',
    start: 'Rezitieren starten', stop: 'Stopp', listening: 'Ich höre zu… rezitiere ab der Markierung', paused: 'Tippe aufs Mikrofon und rezitiere', hide: 'Text verbergen', again: 'Nochmal rezitieren', from: 'Ab diesem Vers',
    heard: 'Gehört', progress: (d, n) => `${d} von ${n} Wörtern`, mistakes: (n) => `${n} Fehler`, summary: 'Deine Rezitation', accuracy: 'Genauigkeit', perfect: 'MashaAllah — keine Fehler!',
    wrong: 'stattdessen gesagt', skip: 'ausgelassen', last: (s) => `Letztes Mal: ${s} %`, tapAyah: 'Tippe auf eine Versnummer, um dort zu beginnen. Tippe auf ein verborgenes Wort, um es kurz zu sehen.',
    err: { denied: 'Mikrofonzugriff abgelehnt. Erlaube ihn in den Browsereinstellungen.', nomic: 'Kein Mikrofon gefunden.', network: 'Der Sprachdienst ist nicht erreichbar. Prüfe deine Verbindung.', error: 'Zuhören beendet. Tippe aufs Mikrofon, um es erneut zu versuchen.', unsupported: 'Dieser Browser kann nicht zuhören. Bitte Chrome, Edge oder Safari verwenden.' },
    note: 'Prüft die Wörter, nicht das Tadschwid.' },
  fr: { toggle: 'Réciter', consentTitle: 'Réciter et être corrigé', consent: 'Votre navigateur transforme votre voix en texte. Dans Chrome et Edge, l’audio est envoyé au service vocal de Google ou de Microsoft. L’app ne garde que vos résultats, sur cet appareil.', agree: 'J’ai compris — commencer', unsupported: 'Ce navigateur ne peut pas écouter. Utilisez Chrome, Edge ou Safari.',
    start: 'Commencer la récitation', stop: 'Arrêter', listening: 'J’écoute… récitez à partir du mot surligné', paused: 'Touchez le micro et récitez', hide: 'Masquer le texte', again: 'Réciter encore', from: 'Commencer à ce verset',
    heard: 'Entendu', progress: (d, n) => `${d} mots sur ${n}`, mistakes: (n) => `${n} erreur${n === 1 ? '' : 's'}`, summary: 'Votre récitation', accuracy: 'précision', perfect: 'MashaAllah — aucune erreur !',
    wrong: 'dit à la place', skip: 'oublié', last: (s) => `La dernière fois : ${s} %`, tapAyah: 'Touchez un numéro de verset pour commencer là. Touchez un mot masqué pour le voir.',
    err: { denied: 'L’accès au micro a été refusé. Autorisez-le dans les réglages du navigateur.', nomic: 'Aucun micro trouvé.', network: 'Le service vocal est injoignable. Vérifiez votre connexion.', error: 'L’écoute s’est arrêtée. Touchez le micro pour réessayer.', unsupported: 'Ce navigateur ne peut pas écouter. Utilisez Chrome, Edge ou Safari.' },
    note: 'Vérifie les mots, pas le tajwid.' },
  es: { toggle: 'Recitar', consentTitle: 'Recita y recibe correcciones', consent: 'Tu navegador convierte tu voz en texto. En Chrome y Edge el audio se envía al servicio de voz de Google o Microsoft. La app solo guarda tus resultados, en este dispositivo.', agree: 'Entendido — empezar', unsupported: 'Este navegador no puede escuchar. Usa Chrome, Edge o Safari.',
    start: 'Empezar a recitar', stop: 'Detener', listening: 'Escuchando… recita desde la palabra resaltada', paused: 'Toca el micrófono y recita', hide: 'Ocultar el texto', again: 'Recitar otra vez', from: 'Empezar en esta aleya',
    heard: 'Oído', progress: (d, n) => `${d} de ${n} palabras`, mistakes: (n) => `${n} error${n === 1 ? '' : 'es'}`, summary: 'Tu recitación', accuracy: 'precisión', perfect: '¡MashaAllah — sin errores!',
    wrong: 'dicho en su lugar', skip: 'omitida', last: (s) => `La última vez: ${s} %`, tapAyah: 'Toca un número de aleya para empezar ahí. Toca una palabra oculta para verla.',
    err: { denied: 'Se negó el acceso al micrófono. Permítelo en los ajustes del navegador.', nomic: 'No se encontró micrófono.', network: 'No se pudo conectar con el servicio de voz. Revisa tu conexión.', error: 'Se detuvo la escucha. Toca el micrófono para intentarlo de nuevo.', unsupported: 'Este navegador no puede escuchar. Usa Chrome, Edge o Safari.' },
    note: 'Revisa las palabras, no el tajwid.' },
  ja: { toggle: '暗唱', consentTitle: '暗唱してチェック', consent: 'ブラウザが声を文字に変換します。ChromeとEdgeでは音声がGoogleまたはMicrosoftの音声サービスに送られます。アプリが保存するのは結果だけで、この端末の中だけです。', agree: 'わかりました — はじめる', unsupported: 'このブラウザは音声を聞き取れません。Chrome・Edge・Safariを使ってください。',
    start: '暗唱をはじめる', stop: '停止', listening: '聞いています… ハイライトの単語から読んでください', paused: 'マイクをタップして読んでください', hide: '本文を隠す', again: 'もう一度', from: 'この節からはじめる',
    heard: '聞こえた語', progress: (d, n) => `${n}語中${d}語`, mistakes: (n) => `まちがい${n}か所`, summary: 'あなたの暗唱', accuracy: '正確さ', perfect: 'マーシャーアッラー — まちがいなし！',
    wrong: '代わりに読んだ語', skip: '抜けた語', last: (s) => `前回: ${s}%`, tapAyah: '節番号をタップするとそこから始めます。隠れた単語はタップでのぞけます。',
    err: { denied: 'マイクへのアクセスが拒否されました。ブラウザの設定で許可してください。', nomic: 'マイクが見つかりません。', network: '音声サービスに接続できません。接続を確認してください。', error: '聞き取りが止まりました。マイクをタップしてもう一度。', unsupported: 'このブラウザは音声を聞き取れません。Chrome・Edge・Safariを使ってください。' },
    note: '単語をチェックします（タジュウィードは対象外）。' },
}
export const reciteText = (lang) => T[lang] || T.en

// strings added for the Tarteel-style modes, merged over T
const MORE = {
  en: { recite: 'Recite', listen: 'Listen', memorize: 'Memorise', show: 'Show text', hideAll: 'Hide', first: 'First letters', play: 'Play', pause: 'Pause',
    speed: 'Speed', repeat: (n) => (n === 1 ? 'No repeat' : `Repeat ×${n}`), reciter: 'Reciter', hear: 'Hear it', tapListen: 'Tap a word to play from there.',
    streak: (n) => `${n}-day streak`, todayAyat: (n) => `${n} ayat today`, weak: 'Words you often miss here', times: (n) => `${n}×`, best: (s) => `Best: ${s}%`, noReciter: 'Add a reciter to listen along (see scripts/qul).' },
  ar: { recite: 'تسميع', listen: 'استماع', memorize: 'حفظ', show: 'إظهار النص', hideAll: 'إخفاء', first: 'أوائل الكلمات', play: 'تشغيل', pause: 'إيقاف مؤقت',
    speed: 'السرعة', repeat: (n) => (n === 1 ? 'بلا تكرار' : `تكرار ×${n}`), reciter: 'القارئ', hear: 'استمع إليها', tapListen: 'اضغط كلمة ليبدأ التشغيل منها.',
    streak: (n) => `${n} أيام متتالية`, todayAyat: (n) => `${n} آيات اليوم`, weak: 'كلمات تخطئ فيها كثيرًا هنا', times: (n) => `${n} مرات`, best: (s) => `الأفضل: ${s}٪`, noReciter: 'أضف قارئًا للاستماع (انظر scripts/qul).' },
  de: { recite: 'Rezitieren', listen: 'Anhören', memorize: 'Auswendig lernen', show: 'Text zeigen', hideAll: 'Verbergen', first: 'Anfangsbuchstaben', play: 'Abspielen', pause: 'Pause',
    speed: 'Tempo', repeat: (n) => (n === 1 ? 'Keine Wiederholung' : `Wiederholen ×${n}`), reciter: 'Rezitator', hear: 'Anhören', tapListen: 'Tippe auf ein Wort, um dort zu starten.',
    streak: (n) => `${n} Tage in Folge`, todayAyat: (n) => `${n} Verse heute`, weak: 'Wörter, die du hier oft verfehlst', times: (n) => `${n}×`, best: (s) => `Bestwert: ${s} %`, noReciter: 'Füge einen Rezitator hinzu (siehe scripts/qul).' },
  fr: { recite: 'Réciter', listen: 'Écouter', memorize: 'Mémoriser', show: 'Afficher le texte', hideAll: 'Masquer', first: 'Premières lettres', play: 'Lire', pause: 'Pause',
    speed: 'Vitesse', repeat: (n) => (n === 1 ? 'Sans répétition' : `Répéter ×${n}`), reciter: 'Récitateur', hear: 'L’écouter', tapListen: 'Touchez un mot pour lire à partir de là.',
    streak: (n) => `${n} jours d’affilée`, todayAyat: (n) => `${n} versets aujourd’hui`, weak: 'Mots que vous manquez souvent ici', times: (n) => `${n}×`, best: (s) => `Meilleur : ${s} %`, noReciter: 'Ajoutez un récitateur pour écouter (voir scripts/qul).' },
  es: { recite: 'Recitar', listen: 'Escuchar', memorize: 'Memorizar', show: 'Mostrar texto', hideAll: 'Ocultar', first: 'Primeras letras', play: 'Reproducir', pause: 'Pausa',
    speed: 'Velocidad', repeat: (n) => (n === 1 ? 'Sin repetir' : `Repetir ×${n}`), reciter: 'Recitador', hear: 'Escucharla', tapListen: 'Toca una palabra para reproducir desde ahí.',
    streak: (n) => `${n} días seguidos`, todayAyat: (n) => `${n} aleyas hoy`, weak: 'Palabras que sueles fallar aquí', times: (n) => `${n}×`, best: (s) => `Mejor: ${s} %`, noReciter: 'Añade un recitador para escuchar (ver scripts/qul).' },
  ja: { recite: '暗唱', listen: '聴く', memorize: '暗記', show: '本文を表示', hideAll: '隠す', first: '頭文字だけ', play: '再生', pause: '一時停止',
    speed: '速度', repeat: (n) => (n === 1 ? 'くり返しなし' : `${n}回くり返す`), reciter: '朗誦者', hear: '聴く', tapListen: '単語をタップするとそこから再生します。',
    streak: (n) => `${n}日連続`, todayAyat: (n) => `今日${n}節`, weak: 'ここでよく間違える単語', times: (n) => `${n}回`, best: (s) => `最高: ${s}%`, noReciter: '朗誦者を追加すると聴けます（scripts/qul 参照）。' },
}
const S = (lang) => ({ ...(T[lang] || T.en), ...(MORE[lang] || MORE.en) })

const CONSENT = 'mc_recite_consent'
const RESULTS = 'mc_recite_v1'
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage blocked */ } }
const toArabicNum = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])
const SPEEDS = [0.75, 1, 1.25]
const REPEATS = [1, 3, 5]

/** The first letter of a word (with its marks), as a hint for memorising. */
function firstLetter(word) {
  try {
    const seg = new Intl.Segmenter('ar', { granularity: 'grapheme' })
    const first = seg.segment(word)[Symbol.iterator]().next().value?.segment
    if (first) return `${first}ـ`
  } catch { /* old browser */ }
  return `${word[0]}ـ`
}

/**
 * Plays a QUL reciter with word timings: follows the active word, repeats an ayah, plays one word on its own.
 * file is an app recitation file (src/lib/recitation.js).
 */
function usePlayer(file, lastAyah, onPos) {
  const audio = useRef(null)
  const st = useRef({ ayah: 1, left: 1, repeat: 1, stopAt: null, raf: 0 })
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeedState] = useState(1)
  const posRef = useRef(onPos); posRef.current = onPos
  // the audio element's handlers outlive renders: read the current reciter and speed through refs
  const fileRef = useRef(file); fileRef.current = file
  const speedRef = useRef(speed); speedRef.current = speed

  function el() {
    if (!audio.current) {
      const a = new Audio()
      a.preload = 'auto'
      a.addEventListener('ended', () => ended())
      a.addEventListener('pause', () => setPlaying(false))
      a.addEventListener('play', () => setPlaying(true))
      audio.current = a
    }
    return audio.current
  }
  function tick() {
    const a = audio.current, s = st.current
    if (!a || a.paused) return
    const ms = a.currentTime * 1000
    if (s.stopAt != null && ms >= s.stopAt) { a.pause(); s.stopAt = null; return }
    if (fileRef.current.kind === 'surah') {
      const span = ayahSpan(fileRef.current, s.ayah)
      if (span && ms >= span[1]) {
        if (s.left > 1) { s.left--; a.currentTime = span[0] / 1000 } // repeat this ayah
        else { s.left = s.repeat; s.ayah = Math.min(s.ayah + 1, lastAyah) }
      }
    }
    const at = activeAt(fileRef.current, ms, fileRef.current.kind === 'ayah' ? s.ayah : null)
    posRef.current(at)
    s.raf = requestAnimationFrame(tick)
  }
  function ended() {
    const s = st.current
    if (fileRef.current.kind === 'ayah' && s.stopAt == null) {
      if (s.left > 1) { s.left--; start(s.ayah, 0); return }
      if (s.ayah < lastAyah && fileRef.current.ayahs[s.ayah + 1]) { s.left = s.repeat; start(s.ayah + 1, 0); return }
    }
    setPlaying(false); posRef.current({ ayah: null, word: 0 })
  }
  function start(ayah, fromMs, stopAt = null) {
    const a = el(), s = st.current
    s.ayah = ayah; s.stopAt = stopAt
    const src = fileRef.current.kind === 'surah' ? fileRef.current.audio : fileRef.current.ayahs[ayah]?.audio
    if (!src) return
    const go = () => {
      a.currentTime = (fileRef.current.kind === 'surah' && fromMs == null ? ayahSpan(fileRef.current, ayah)[0] : fromMs || 0) / 1000
      a.playbackRate = speedRef.current
      a.play().then(() => { cancelAnimationFrame(s.raf); s.raf = requestAnimationFrame(tick) }, () => setPlaying(false))
    }
    if (!a.src.endsWith(src)) { a.src = src; a.addEventListener('loadedmetadata', go, { once: true }); a.load() } else go()
  }
  const api = {
    playing, speed,
    /** Play from an ayah (and word), carrying on to the end of the surah. */
    playFrom(ayah, word = 0) {
      const s = st.current
      s.left = s.repeat
      const ws = word ? wordSpan(fileRef.current, ayah, word) : null
      start(ayah, ws ? ws[0] : (fileRef.current.kind === 'surah' ? null : 0))
    },
    /** Just one word: how it should sound. */
    playWord(ayah, word) {
      const ws = wordSpan(fileRef.current, ayah, word)
      if (ws) start(ayah, ws[0], ws[1])
    },
    pause() { audio.current?.pause() },
    resume() { if (audio.current?.src) { audio.current.play(); cancelAnimationFrame(st.current.raf); st.current.raf = requestAnimationFrame(tick) } },
    setRepeat(n) { st.current.repeat = n; st.current.left = n },
    setSpeed(v) { setSpeedState(v); if (audio.current) audio.current.playbackRate = v },
    stop() { const a = audio.current; if (a) { a.pause(); a.removeAttribute('src') } cancelAnimationFrame(st.current.raf); posRef.current({ ayah: null, word: 0 }) },
  }
  useEffect(() => () => { audio.current?.pause(); cancelAnimationFrame(st.current.raf) }, [])
  return api
}

/** Recite a surah aloud and see each word checked (words, not tajweed); or listen to a reciter word by word. */
export default function Recite({ surah, ayat, lang, fontSize = 27 }) {
  const t = S(lang)
  const words = useMemo(() => ayat.flatMap((a) => a.ar.trim().split(/\s+/).map((ar, i) => ({ ar, a: a.n, i }))), [ayat])
  const tracker = useMemo(() => new Tracker(words, { basmalaIsText: surah === 1 }), [words, surah])
  const [mode, setMode] = useState('recite') // recite | listen
  const [view, setView] = useState(() => tracker.view())
  const [status, setStatus] = useState(speechSupported() ? 'stopped' : 'unsupported')
  const [said, setSaid] = useState('')
  const [hideMode, setHideMode] = useState('off') // off | hide | first
  const [peek, setPeek] = useState(null)
  const [consent, setConsent] = useState(() => !!readJSON(CONSENT))
  const [last, setLast] = useState(() => readJSON(RESULTS)?.[surah] || null)
  const [history, setHistory] = useState(loadHistory)
  const [reciters, setReciters] = useState([])
  const [reciter, setReciter] = useState(null)
  const [file, setFile] = useState(null)
  const [pos, setPos] = useState({ ayah: null, word: 0 }) // the reciter's word while listening
  const [repeat, setRepeatState] = useState(1)
  const listener = useRef(null)
  const summaryRef = useRef(null)
  const textRef = useRef(null)
  const saved = useRef(false)
  const player = usePlayer(file || { kind: 'ayah', ayahs: {} }, ayat.length, setPos)

  // reciters installed in this app (none: no Listen tab, the check still works)
  useEffect(() => { loadReciters().then((list) => { const ok = list.filter((r) => r.surahs.includes(surah)); setReciters(ok); setReciter((r) => r || ok[0]?.slug || null) }) }, [surah])
  useEffect(() => { setFile(null); if (reciter) loadRecitation(reciter, surah).then(setFile) }, [reciter, surah])

  useEffect(() => {
    const l = createListener({
      onText: (text, final) => { setSaid(text.split(/\s+/).slice(-6).join(' ')); setView(tracker.hear(text, final)) },
      onSession: () => tracker.endSession(),
      onState: setStatus,
    })
    listener.current = l
    return () => l.stop()
  }, [tracker])

  const listening = status === 'listening'
  const stopped = !listening && view.done > 0
  const showSummary = mode === 'recite' && (view.finished || (stopped && status === 'stopped'))

  // finished or stopped: stop listening and remember the result and the mistakes (on this device only)
  useEffect(() => {
    if (!showSummary || saved.current) return
    saved.current = true
    listener.current?.stop()
    writeJSON(RESULTS, { ...(readJSON(RESULTS) || {}), [surah]: { at: Date.now(), score: score(view), mistakes: view.mistakes.length } })
    setHistory((h) => { const next = clearPracticed(addSession(h, { surah, view, words }), { surah, view, words }); saveHistory(next); return next })
    summaryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [showSummary]) // eslint-disable-line react-hooks/exhaustive-deps

  // keep the word being recited (or played) in view in long surahs
  const liveK = mode === 'listen' ? words.findIndex((w) => w.a === pos.ayah && w.i + 1 === pos.word) : view.pos
  useEffect(() => {
    if (!(listening || player.playing)) return
    textRef.current?.querySelector('.rc-w.now')?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [liveK]) // eslint-disable-line react-hooks/exhaustive-deps

  function switchMode(m) {
    listener.current?.stop(); player.stop()
    setMode(m); setPeek(null)
  }
  function start() {
    if (!consent) return
    if (view.finished) restart()
    setSaid('')
    saved.current = false
    listener.current?.start()
  }
  function restart(at = 0) {
    listener.current?.stop()
    tracker.reset()
    if (at) tracker.startAt(at)
    saved.current = false
    setLast(readJSON(RESULTS)?.[surah] || null)
    setView(tracker.view()); setSaid(''); setPeek(null)
  }
  const fromAyah = (n) => (mode === 'listen' ? player.playFrom(n) : restart(words.findIndex((w) => w.a === n)))
  const hear = (k) => file && player.playWord(words[k].a, words[k].i + 1)

  const tabs = (
    <div className="rc-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={mode === 'recite'} className={mode === 'recite' ? 'on' : ''} onClick={() => switchMode('recite')}>🎙 {t.recite}</button>
      {reciters.length > 0 && <button type="button" role="tab" aria-selected={mode === 'listen'} className={mode === 'listen' ? 'on' : ''} onClick={() => switchMode('listen')}>🎧 {t.listen}</button>}
    </div>
  )

  if (mode === 'recite' && status === 'unsupported') return <div className="rc">{tabs}<div className="rc-card"><p>{t.unsupported}</p></div></div>
  if (mode === 'recite' && !consent) {
    return (
      <div className="rc">
        {tabs}
        <div className="rc-card">
          <h3>{t.consentTitle}</h3>
          <p>{t.consent}</p>
          <p className="rc-note">{t.note}</p>
          <button type="button" className="btn block" onClick={() => { writeJSON(CONSENT, true); setConsent(true) }}>{t.agree}</button>
        </div>
      </div>
    )
  }

  const pct = score(view)
  const err = t.err[status]
  const days = streak(history)
  const weak = weakWords(history, surah)
  const best = bestScore(history, surah)
  return (
    <div className="rc" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {tabs}
      <div className="rc-bar">
        <div className="rc-seg" role="radiogroup" aria-label={t.memorize}>
          {[['off', t.show], ['hide', t.hideAll], ['first', t.first]].map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={hideMode === k} className={hideMode === k ? 'on' : ''} onClick={() => { setHideMode(k); setPeek(null) }}>{label}</button>
          ))}
        </div>
        {mode === 'recite'
          ? <span className="rc-prog latin">{t.progress(view.done, view.total)}{view.mistakes.length > 0 && <b> · {t.mistakes(view.mistakes.length)}</b>}</span>
          : <span className="rc-prog">{t.tapListen}</span>}
      </div>
      {(days > 0 || best > 0) && (
        <p className="rc-stats">{days > 0 && <span>🔥 {t.streak(days)}</span>}<span>{t.todayAyat(todayStats(history).ayat)}</span>{best > 0 && <span>{t.best(best)}</span>}</p>
      )}
      {mode === 'recite' && <p className="rc-tip">{t.tapAyah}</p>}

      <div ref={textRef} className="rc-text" dir="rtl" style={{ fontSize }}>
        {ayat.map((a) => (
          <span key={a.n} className={mode === 'listen' && pos.ayah === a.n ? 'rc-ayah-on' : undefined}>
            {words.map((w, k) => {
              if (w.a !== a.n) return null
              const s = mode === 'recite' ? view.state[k] : 'pending'
              const playedPast = mode === 'listen' && pos.ayah != null && (w.a < pos.ayah || (w.a === pos.ayah && w.i + 1 < pos.word))
              const hidden = hideMode !== 'off' && s === 'pending' && peek !== k && !(mode === 'listen' && (playedPast || k === liveK))
              const cls = `rc-w s-${s}${k === liveK && (mode === 'listen' ? player.playing : !view.finished) ? ' now' : ''}${hidden ? (hideMode === 'first' ? ' hint' : ' hidden') : ''}${playedPast ? ' played' : ''}`
              return (
                <span key={k} className={cls} title={s === 'wrong' ? `${t.heard}: ${view.heard[k]}` : undefined}
                  onClick={() => {
                    if (mode === 'listen') { player.playFrom(w.a, w.i + 1); return }
                    if (hidden) { setPeek(peek === k ? null : k); return }
                    if ((s === 'wrong' || s === 'skip') && file) hear(k)
                  }}>
                  {hidden && hideMode === 'first' ? firstLetter(w.ar) : w.ar}
                  {s === 'wrong' && <small className="rc-said">{view.heard[k]}</small>}
                </span>
              )
            })}
            <button type="button" className="ayah-num rc-num" onClick={() => fromAyah(a.n)} aria-label={`${t.from} ${a.n}`}>{toArabicNum(a.n)}</button>{' '}
          </span>
        ))}
      </div>

      {showSummary && (
        <div ref={summaryRef} className="rc-summary" role="status">
          <h3>{t.summary}</h3>
          <div className="rc-score"><b className="latin">{pct}%</b> <span>{t.accuracy}</span></div>
          {last && <p className="rc-last">{t.last(last.score)}</p>}
          {!view.mistakes.length ? <p>{view.finished ? t.perfect : ''}</p> : (
            <ul className="rc-mistakes">
              {view.mistakes.map((m) => (
                <li key={m.k}>
                  <span className="latin">{surah}:{m.a}</span>
                  <b lang="ar">{m.expected}</b>
                  <small>{m.type === 'wrong' ? <>{t.wrong}: <bdi lang="ar">{m.heard}</bdi></> : t.skip}</small>
                  <span className="rc-mbtns">
                    {file && <button type="button" onClick={() => hear(m.k)}>🔊 {t.hear}</button>}
                    <button type="button" onClick={() => fromAyah(m.a)}>{t.from}</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {weak.length > 0 && (
            <div className="rc-weak">
              <h4>{t.weak}</h4>
              <div>
                {weak.map((w) => (
                  <button key={w.key} type="button" onClick={() => fromAyah(w.a)}>
                    <b lang="ar">{w.ar}</b> <small className="latin">{w.a} · {t.times(w.count)}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="btn ghost block" onClick={() => restart()}>{t.again}</button>
        </div>
      )}

      {mode === 'recite' ? (
        <div className="rc-dock">
          <p className="rc-status" role="status" aria-live="polite">{err || (listening ? t.listening : t.paused)}</p>
          {listening && said && <p className="rc-heard" dir="rtl"><small>{t.heard}:</small> {said}</p>}
          <button type="button" className={`rc-mic${listening ? ' on' : ''}`} onClick={listening ? () => listener.current?.stop() : start} aria-pressed={listening} aria-label={listening ? t.stop : t.start}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {listening ? <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
            </svg>
          </button>
          <p className="rc-note">{t.note}</p>
        </div>
      ) : (
        <div className="rc-dock rc-player">
          {reciters.length > 1 && (
            <label className="rc-reciter">{t.reciter}
              <select value={reciter || ''} onChange={(e) => { player.stop(); setReciter(e.target.value) }}>
                {reciters.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
              </select>
            </label>
          )}
          <div className="rc-controls">
            <button type="button" className="rc-chip" onClick={() => { const n = REPEATS[(REPEATS.indexOf(repeat) + 1) % REPEATS.length]; setRepeatState(n); player.setRepeat(n) }}>🔁 {t.repeat(repeat)}</button>
            <button type="button" className={`rc-mic${player.playing ? ' on' : ''}`} disabled={!file}
              onClick={() => (player.playing ? player.pause() : pos.ayah ? player.resume() : player.playFrom(1))} aria-label={player.playing ? t.pause : t.play}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {player.playing ? <><rect x="6.5" y="5" width="4" height="14" rx="1.2" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" /></> : <path d="M8 5.5v13l11-6.5z" />}
              </svg>
            </button>
            <button type="button" className="rc-chip latin" onClick={() => player.setSpeed(SPEEDS[(SPEEDS.indexOf(player.speed) + 1) % SPEEDS.length])} aria-label={t.speed}>⏱ {player.speed}×</button>
          </div>
          <p className="rc-note">{reciters.find((r) => r.slug === reciter)?.name} · QUL — qul.tarteel.ai</p>
        </div>
      )}
    </div>
  )
}
