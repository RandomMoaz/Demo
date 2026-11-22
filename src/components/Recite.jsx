import { useEffect, useMemo, useRef, useState } from 'react'
import { Tracker, score } from '../lib/recite'
import { createListener, speechSupported } from '../lib/speech'

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

const CONSENT = 'mc_recite_consent'
const RESULTS = 'mc_recite_v1'
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage blocked */ } }
const toArabicNum = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])

/** Recite a surah aloud and see each word checked as you go (words, not tajweed). */
export default function Recite({ surah, ayat, lang, fontSize = 27 }) {
  const t = reciteText(lang)
  const words = useMemo(() => ayat.flatMap((a) => a.ar.trim().split(/\s+/).map((ar, i) => ({ ar, a: a.n, i }))), [ayat])
  const tracker = useMemo(() => new Tracker(words, { basmalaIsText: surah === 1 }), [words, surah])
  const [view, setView] = useState(() => tracker.view())
  const [status, setStatus] = useState(speechSupported() ? 'stopped' : 'unsupported')
  const [said, setSaid] = useState('')
  const [hide, setHide] = useState(false)
  const [peek, setPeek] = useState(null)
  const [consent, setConsent] = useState(() => !!readJSON(CONSENT))
  const [last, setLast] = useState(() => readJSON(RESULTS)?.[surah] || null)
  const listener = useRef(null)
  const summaryRef = useRef(null)

  useEffect(() => {
    const l = createListener({
      onText: (text, final) => { setSaid(text.split(/\s+/).slice(-6).join(' ')); setView(tracker.hear(text, final)) },
      onSession: () => tracker.endSession(),
      onState: setStatus,
    })
    listener.current = l
    return () => l.stop()
  }, [tracker])

  // finished: stop listening and remember the result (on this device only)
  useEffect(() => {
    if (!view.finished) return
    listener.current?.stop()
    const result = { at: Date.now(), score: score(view), mistakes: view.mistakes.length }
    const all = readJSON(RESULTS) || {}
    writeJSON(RESULTS, { ...all, [surah]: result })
  }, [view.finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const listening = status === 'listening'
  function start() {
    if (!consent) return
    if (view.finished) restart()
    setSaid('')
    listener.current?.start()
  }
  function restart(at = 0) {
    listener.current?.stop()
    tracker.reset()
    if (at) tracker.startAt(at)
    setLast(readJSON(RESULTS)?.[surah] || null)
    setView(tracker.view()); setSaid(''); setPeek(null)
  }
  const fromAyah = (n) => restart(words.findIndex((w) => w.a === n))

  const stopped = !listening && view.done > 0
  const showSummary = view.finished || (stopped && status === 'stopped')
  // bring the result into view when the recitation ends (it sits below the text)
  useEffect(() => { if (showSummary) summaryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }) }, [showSummary])

  if (status === 'unsupported') return <div className="rc-card"><p>{t.unsupported}</p></div>
  if (!consent) {
    return (
      <div className="rc-card">
        <h3>{t.consentTitle}</h3>
        <p>{t.consent}</p>
        <p className="rc-note">{t.note}</p>
        <button type="button" className="btn block" onClick={() => { writeJSON(CONSENT, true); setConsent(true) }}>{t.agree}</button>
      </div>
    )
  }

  const pct = score(view)
  const err = t.err[status]
  return (
    <div className="rc" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="rc-bar">
        <label className="rc-hide"><input type="checkbox" checked={hide} onChange={(e) => { setHide(e.target.checked); setPeek(null) }} /> {t.hide}</label>
        <span className="rc-prog latin">{t.progress(view.done, view.total)}{view.mistakes.length > 0 && <b> · {t.mistakes(view.mistakes.length)}</b>}</span>
      </div>
      <p className="rc-tip">{t.tapAyah}</p>

      <div className="rc-text" dir="rtl" style={{ fontSize }}>
        {ayat.map((a) => (
          <span key={a.n}>
            {words.map((w, k) => {
              if (w.a !== a.n) return null
              const s = view.state[k]
              const hidden = hide && s === 'pending' && peek !== k
              const cls = `rc-w s-${s}${k === view.pos && !view.finished ? ' now' : ''}${hidden ? ' hidden' : ''}`
              return (
                <span key={k} className={cls} title={s === 'wrong' ? `${t.heard}: ${view.heard[k]}` : undefined}
                  onClick={() => { if (hide && s === 'pending') setPeek(peek === k ? null : k) }}>
                  {w.ar}
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
                  <button type="button" onClick={() => fromAyah(m.a)}>{t.from}</button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn ghost block" onClick={() => restart()}>{t.again}</button>
        </div>
      )}

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
    </div>
  )
}
