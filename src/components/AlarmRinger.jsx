import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAlarms, checkAlarms, stopRinging, makeTask, hadithFor, startSound, stopSound, unlockAudio, hmToDate, prayerName } from '../lib/alarms'
import { fmtTime } from '../lib/prayerTimes'
import { notifyAlarm } from '../lib/notify'
import { Anim } from './Lottie'

const STR = {
  en: {
    custom: 'Alarm', prayer: (n) => `Time for ${n}`,
    tap: 'Tap to stop the alarm', solve: 'Solve the task to stop the alarm',
    stop: 'Stop alarm', check: 'Check', wrong: 'Not quite — try again',
    answer: 'Answer', word: 'Spell this word:', pickLetters: 'Tap the letters in order',
    asc: 'Sort from smallest to largest', desc: 'Sort from largest to smallest',
    watch: 'Watch the path…', repeat: 'Now tap the same path', pathWrong: 'Wrong path — watch again',
    replay: 'Show path again', clear: 'Clear', ok: 'Okay', hadith: 'A hadith for you',
  },
  ar: {
    custom: 'منبّه', prayer: (n) => `حان وقت صلاة ${n}`,
    tap: 'اضغط لإيقاف المنبّه', solve: 'حُلّ المهمة لإيقاف المنبّه',
    stop: 'إيقاف المنبّه', check: 'تحقّق', wrong: 'إجابة خاطئة — حاول مرة أخرى',
    answer: 'الإجابة', word: 'الكلمة المطلوبة:', pickLetters: 'اختر الحروف بالترتيب الصحيح',
    asc: 'رتّب الأرقام تصاعديًا (من الأصغر للأكبر)', desc: 'رتّب الأرقام تنازليًا (من الأكبر للأصغر)',
    watch: 'احفظ المسار…', repeat: 'أعد إدخال المسار الآن', pathWrong: 'خطأ في المسار — شاهده مجددًا',
    replay: 'إعادة عرض المسار', clear: 'مسح', ok: 'حسنًا', hadith: 'حديث شريف',
  },
  de: {
    custom: 'Wecker', prayer: (n) => `Zeit für ${n}`,
    tap: 'Tippe, um den Wecker auszuschalten', solve: 'Löse die Aufgabe, um den Wecker auszuschalten',
    stop: 'Wecker aus', check: 'Prüfen', wrong: 'Nicht ganz — versuch es nochmal',
    answer: 'Antwort', word: 'Buchstabiere dieses Wort:', pickLetters: 'Tippe die Buchstaben der Reihe nach',
    asc: 'Sortiere vom kleinsten zum größten', desc: 'Sortiere vom größten zum kleinsten',
    watch: 'Merke dir den Weg…', repeat: 'Tippe jetzt denselben Weg', pathWrong: 'Falscher Weg — schau noch einmal zu',
    replay: 'Weg nochmal zeigen', clear: 'Leeren', ok: 'Okay', hadith: 'Ein Hadith für dich',
  },
  fr: {
    custom: 'Réveil', prayer: (n) => `C’est l’heure de ${n}`,
    tap: 'Touchez pour arrêter le réveil', solve: 'Résolvez la tâche pour arrêter le réveil',
    stop: 'Arrêter le réveil', check: 'Vérifier', wrong: 'Pas tout à fait — réessayez',
    answer: 'Réponse', word: 'Épelez ce mot :', pickLetters: 'Touchez les lettres dans l’ordre',
    asc: 'Triez du plus petit au plus grand', desc: 'Triez du plus grand au plus petit',
    watch: 'Regardez le chemin…', repeat: 'Touchez maintenant le même chemin', pathWrong: 'Mauvais chemin — regardez à nouveau',
    replay: 'Revoir le chemin', clear: 'Effacer', ok: 'D’accord', hadith: 'Un hadith pour vous',
  },
  es: {
    custom: 'Alarma', prayer: (n) => `Es la hora de ${n}`,
    tap: 'Toca para apagar la alarma', solve: 'Resuelve la tarea para apagar la alarma',
    stop: 'Apagar alarma', check: 'Comprobar', wrong: 'No es correcto: inténtalo otra vez',
    answer: 'Respuesta', word: 'Deletrea esta palabra:', pickLetters: 'Toca las letras en orden',
    asc: 'Ordena de menor a mayor', desc: 'Ordena de mayor a menor',
    watch: 'Observa el camino…', repeat: 'Ahora toca el mismo camino', pathWrong: 'Camino incorrecto: obsérvalo otra vez',
    replay: 'Mostrar el camino otra vez', clear: 'Borrar', ok: 'De acuerdo', hadith: 'Un hadiz para ti',
  },
  ja: {
    custom: 'アラーム', prayer: (n) => `${n}の時間です`,
    tap: 'タップしてアラームを止める', solve: '課題を解いてアラームを止めましょう',
    stop: 'アラームを止める', check: '確認', wrong: '惜しい — もう一度',
    answer: '答え', word: 'この言葉を並べてください：', pickLetters: '文字を順番にタップ',
    asc: '小さい順に並べてください', desc: '大きい順に並べてください',
    watch: '道順を覚えてください…', repeat: '同じ道順をタップしてください', pathWrong: '道順が違います — もう一度見てください',
    replay: 'もう一度見る', clear: 'クリア', ok: 'OK', hadith: 'あなたへのハディース',
  },
}

/** Lives in the app shell: checks alarms every second and takes over the screen when one rings. */
export default function AlarmRinger() {
  const { lang, loc } = useApp()
  const s = STR[lang] || STR.en
  const isAr = lang === 'ar'
  const { ringing } = useAlarms()
  const [hadith, setHadith] = useState(null)

  // the clock that fires alarms
  const locRef = useRef(loc); locRef.current = loc
  useEffect(() => {
    const id = setInterval(() => {
      const a = checkAlarms(new Date(), locRef.current)
      if (a && document.hidden) {
        const name = a.prayer ? prayerName(a.prayer, lang) : ''
        notifyAlarm(name ? s.prayer(name) : s.custom, fmtTime(hmToDate(a.at), lang))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [lang, s])

  // sound needs one tap on the page first; unlock it on the first tap anywhere
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    if (!ringing) return
    startSound()
    return stopSound
  }, [ringing])

  function done() {
    setHadith(hadithFor(ringing.prayer))
    stopRinging()
  }

  if (hadith) {
    return (
      <div className="alm-overlay" dir={isAr ? 'rtl' : 'ltr'} role="dialog" aria-modal="true" aria-label={s.hadith}>
        <div className="alm-card alm-hadith">
          <div className="alm-hadith-h">{s.hadith}</div>
          <p className="alm-hadith-ar" dir="rtl">{hadith.ar}</p>
          {!isAr && <p className="alm-hadith-en">“{hadith.en}”</p>}
          <div className="alm-hadith-src">{hadith.src}</div>
          <button className="btn block" onClick={() => setHadith(null)}>{s.ok}</button>
        </div>
      </div>
    )
  }
  if (!ringing) return null
  return <Ringing key={ringing.id + ringing.at} alarm={ringing} s={s} lang={lang} onDone={done} />
}

function Ringing({ alarm, s, lang, onDone }) {
  const isAr = lang === 'ar'
  const [task] = useState(() => (alarm.task ? makeTask(alarm.task, alarm.level, lang) : null))
  const [input, setInput] = useState('')
  const [picked, setPicked] = useState([])   // indices of tiles placed in the slots
  const [err, setErr] = useState('')
  const name = alarm.prayer ? prayerName(alarm.prayer, lang) : ''

  function check() {
    if (!task) return onDone()
    let ok = false
    if (task.type === 'math') ok = Number(input) === task.answer
    if (task.type === 'scramble') ok = picked.map((i) => task.tiles[i]).join('') === task.word
    if (task.type === 'sort') ok = picked.map((i) => task.tiles[i]).join() === task.answer.join()
    if (ok) return onDone()
    setErr(s.wrong); setInput(''); setPicked([])
  }

  return (
    <div className={`alm-overlay alm-ring p-${alarm.prayer || 'custom'}`} dir={isAr ? 'rtl' : 'ltr'} role="alertdialog" aria-modal="true" aria-label={name ? s.prayer(name) : s.custom}>
      <div className="alm-ring-anim"><Anim name="wakeup" /></div>
      <div className="alm-ring-time">{fmtTime(hmToDate(alarm.at), lang)}</div>
      <div className="alm-ring-name">{name ? s.prayer(name) : s.custom}</div>

      <div className="alm-card">
        <p className="alm-instr">{task ? s.solve : s.tap}</p>

        {task?.type === 'math' && (
          <>
            <div className="alm-problem" dir="ltr">{task.a} + {task.b} = ?</div>
            <input className="name-input alm-answer" type="number" inputMode="numeric" aria-label={s.answer} placeholder={s.answer}
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && check()} autoFocus />
          </>
        )}

        {task?.type === 'scramble' && (
          <>
            <div className="alm-sub">{s.word}</div>
            <div className="alm-word">{task.word}</div>
            <div className="alm-sub">{s.pickLetters}</div>
            <Picker tiles={task.tiles} picked={picked} setPicked={setPicked} dir={isAr ? 'rtl' : 'ltr'} clear={s.clear} />
          </>
        )}

        {task?.type === 'sort' && (
          <>
            <div className="alm-sub alm-strong">{task.asc ? s.asc : s.desc}</div>
            <Picker tiles={task.tiles} picked={picked} setPicked={setPicked} dir="ltr" clear={s.clear} />
          </>
        )}

        {task?.type === 'path' && <PathTask seq={task.seq} s={s} onSolved={onDone} setErr={setErr} />}

        {err && <div className="alm-err" role="alert">{err}</div>}
        {task?.type !== 'path' && <button className="btn block alm-stop" onClick={check}>{task ? s.check : s.stop}</button>}
      </div>
    </div>
  )
}

/** tap tiles to fill the slots in order; tap a slot to send its tile back */
function Picker({ tiles, picked, setPicked, dir, clear }) {
  return (
    <div className="alm-picker">
      <div className="alm-slots" dir={dir}>
        {tiles.map((_, i) => (
          <button key={i} type="button" className={`alm-slot${picked[i] != null ? ' on' : ''}`}
            onClick={() => picked[i] != null && setPicked(picked.filter((_, j) => j !== i))}>
            {picked[i] != null ? tiles[picked[i]] : ''}
          </button>
        ))}
      </div>
      <div className="alm-bank" dir={dir}>
        {tiles.map((t, i) => (
          <button key={i} type="button" className="alm-tile" disabled={picked.includes(i)}
            onClick={() => setPicked([...picked, i])}>{t}</button>
        ))}
      </div>
      {picked.length > 0 && <button type="button" className="alm-link" onClick={() => setPicked([])}>{clear}</button>}
    </div>
  )
}

/** watch a path light up on a 3×3 grid, then tap it back */
function PathTask({ seq, s, onSolved, setErr }) {
  const [lit, setLit] = useState(-1)
  const [playing, setPlaying] = useState(true)
  const [taps, setTaps] = useState([])
  const [tapped, setTapped] = useState(-1)
  const timers = useRef([])

  function play() {
    timers.current.forEach(clearTimeout)
    setPlaying(true); setTaps([])
    const at = (ms, f) => timers.current.push(setTimeout(f, ms))
    seq.forEach((n, i) => { at(400 + i * 700, () => setLit(n)); at(800 + i * 700, () => setLit(-1)) })
    at(400 + seq.length * 700, () => setPlaying(false))
  }
  useEffect(() => { play(); return () => timers.current.forEach(clearTimeout) }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  function tap(n) {
    if (playing) return
    setTapped(n); timers.current.push(setTimeout(() => setTapped(-1), 200))
    const next = [...taps, n]
    if (seq[next.length - 1] !== n) { setErr(s.pathWrong); play(); return }
    setErr('')
    if (next.length === seq.length) onSolved()
    else setTaps(next)
  }

  return (
    <>
      <div className="alm-sub alm-strong" aria-live="polite">{playing ? s.watch : s.repeat}</div>
      <div className="alm-grid" dir="ltr">
        {Array.from({ length: 9 }, (_, n) => (
          <button key={n} type="button" aria-label={String(n + 1)}
            className={`alm-node${lit === n ? ' lit' : ''}${tapped === n ? ' tap' : ''}`}
            onClick={() => tap(n)} />
        ))}
      </div>
      {!playing && <button type="button" className="btn ghost block" onClick={play}>{s.replay}</button>}
    </>
  )
}
