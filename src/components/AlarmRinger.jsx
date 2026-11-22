import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAlarms, checkAlarms, stopRinging, snooze, makeTask, hadithFor, startSound, stopSound, unlockAudio, hmToDate, prayerName, afterPrayer } from '../lib/alarms'
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
    replay: 'Show path again', clear: 'Clear', ok: 'Okay', hadith: 'A hadith for you', snooze: 'Snooze 5 min', endTest: 'End test', testBadge: 'Test', now: (t) => `Now ${t}`, fajrEnds: (t) => `Fajr time ends at sunrise, ${t}`, nextPrayer: (n, t) => `Next prayer: ${n} at ${t}`, done: 'Done', del: 'Delete',
  },
  ar: {
    custom: 'منبّه', prayer: (n) => `حان وقت صلاة ${n}`,
    tap: 'اضغط لإيقاف المنبّه', solve: 'حُلّ المهمة لإيقاف المنبّه',
    stop: 'إيقاف المنبّه', check: 'تحقّق', wrong: 'إجابة خاطئة — حاول مرة أخرى',
    answer: 'الإجابة', word: 'الكلمة المطلوبة:', pickLetters: 'اختر الحروف بالترتيب الصحيح',
    asc: 'رتّب الأرقام تصاعديًا (من الأصغر للأكبر)', desc: 'رتّب الأرقام تنازليًا (من الأكبر للأصغر)',
    watch: 'احفظ المسار…', repeat: 'أعد إدخال المسار الآن', pathWrong: 'خطأ في المسار — شاهده مجددًا',
    replay: 'إعادة عرض المسار', clear: 'مسح', ok: 'حسنًا', hadith: 'حديث شريف', snooze: 'غفوة ٥ دقائق', endTest: 'إنهاء التجربة', testBadge: 'تجربة', now: (t) => `الآن ${t}`, fajrEnds: (t) => `ينتهي وقت الفجر بشروق الشمس ${t}`, nextPrayer: (n, t) => `الصلاة القادمة: ${n} ${t}`, done: 'تم', del: 'حذف',
  },
  de: {
    custom: 'Wecker', prayer: (n) => `Zeit für ${n}`,
    tap: 'Tippe, um den Wecker auszuschalten', solve: 'Löse die Aufgabe, um den Wecker auszuschalten',
    stop: 'Wecker aus', check: 'Prüfen', wrong: 'Nicht ganz — versuch es nochmal',
    answer: 'Antwort', word: 'Buchstabiere dieses Wort:', pickLetters: 'Tippe die Buchstaben der Reihe nach',
    asc: 'Sortiere vom kleinsten zum größten', desc: 'Sortiere vom größten zum kleinsten',
    watch: 'Merke dir den Weg…', repeat: 'Tippe jetzt denselben Weg', pathWrong: 'Falscher Weg — schau noch einmal zu',
    replay: 'Weg nochmal zeigen', clear: 'Leeren', ok: 'Okay', hadith: 'Ein Hadith für dich', snooze: 'Schlummern 5 Min.', endTest: 'Test beenden', testBadge: 'Test', now: (t) => `Jetzt ${t}`, fajrEnds: (t) => `Die Fadschr-Zeit endet mit Sonnenaufgang, ${t}`, nextPrayer: (n, t) => `Nächstes Gebet: ${n} um ${t}`, done: 'Fertig', del: 'Löschen',
  },
  fr: {
    custom: 'Réveil', prayer: (n) => `C’est l’heure de ${n}`,
    tap: 'Touchez pour arrêter le réveil', solve: 'Résolvez la tâche pour arrêter le réveil',
    stop: 'Arrêter le réveil', check: 'Vérifier', wrong: 'Pas tout à fait — réessayez',
    answer: 'Réponse', word: 'Épelez ce mot :', pickLetters: 'Touchez les lettres dans l’ordre',
    asc: 'Triez du plus petit au plus grand', desc: 'Triez du plus grand au plus petit',
    watch: 'Regardez le chemin…', repeat: 'Touchez maintenant le même chemin', pathWrong: 'Mauvais chemin — regardez à nouveau',
    replay: 'Revoir le chemin', clear: 'Effacer', ok: 'D’accord', hadith: 'Un hadith pour vous', snooze: 'Répéter dans 5 min', endTest: 'Terminer le test', testBadge: 'Test', now: (t) => `Il est ${t}`, fajrEnds: (t) => `Le temps de Fajr finit au lever du soleil, ${t}`, nextPrayer: (n, t) => `Prochaine prière : ${n} à ${t}`, done: 'Terminé', del: 'Effacer',
  },
  es: {
    custom: 'Alarma', prayer: (n) => `Es la hora de ${n}`,
    tap: 'Toca para apagar la alarma', solve: 'Resuelve la tarea para apagar la alarma',
    stop: 'Apagar alarma', check: 'Comprobar', wrong: 'No es correcto: inténtalo otra vez',
    answer: 'Respuesta', word: 'Deletrea esta palabra:', pickLetters: 'Toca las letras en orden',
    asc: 'Ordena de menor a mayor', desc: 'Ordena de mayor a menor',
    watch: 'Observa el camino…', repeat: 'Ahora toca el mismo camino', pathWrong: 'Camino incorrecto: obsérvalo otra vez',
    replay: 'Mostrar el camino otra vez', clear: 'Borrar', ok: 'De acuerdo', hadith: 'Un hadiz para ti', snooze: 'Posponer 5 min', endTest: 'Terminar prueba', testBadge: 'Prueba', now: (t) => `Ahora ${t}`, fajrEnds: (t) => `El tiempo de Fajr termina al salir el sol, ${t}`, nextPrayer: (n, t) => `Próxima oración: ${n} a las ${t}`, done: 'Listo', del: 'Borrar',
  },
  ja: {
    custom: 'アラーム', prayer: (n) => `${n}の時間です`,
    tap: 'タップしてアラームを止める', solve: '課題を解いてアラームを止めましょう',
    stop: 'アラームを止める', check: '確認', wrong: '惜しい — もう一度',
    answer: '答え', word: 'この言葉を並べてください：', pickLetters: '文字を順番にタップ',
    asc: '小さい順に並べてください', desc: '大きい順に並べてください',
    watch: '道順を覚えてください…', repeat: '同じ道順をタップしてください', pathWrong: '道順が違います — もう一度見てください',
    replay: 'もう一度見る', clear: 'クリア', ok: 'OK', hadith: 'あなたへのハディース', snooze: '5分スヌーズ', endTest: 'テストを終了', testBadge: 'テスト', now: (t) => `現在 ${t}`, fajrEnds: (t) => `ファジュルの時間は日の出（${t}）までです`, nextPrayer: (n, t) => `次の礼拝: ${n} ${t}`, done: '完了', del: '削除',
  },
}

/** Lives in the app shell: checks alarms every second and takes over the screen when one rings. */
export default function AlarmRinger() {
  const { lang, loc } = useApp()
  const s = STR[lang] || STR.en
  const isAr = lang === 'ar'
  const { ringing } = useAlarms()
  const [hadith, setHadith] = useState(null) // { ...hadith, prayer } shown after the alarm stops

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
    if (ringing.test) { stopRinging(); return } // a test just ends
    setHadith({ ...hadithFor(ringing.prayer), prayer: ringing.prayer })
    stopRinging()
  }
  const after = hadith?.prayer ? afterPrayer(hadith.prayer, loc) : null

  if (hadith) {
    return (
      <div className="alm-overlay" dir={isAr ? 'rtl' : 'ltr'} role="dialog" aria-modal="true" aria-label={s.hadith}>
        <div className="alm-card alm-hadith">
          <div className="alm-hadith-h">{s.hadith}</div>
          <p className="alm-hadith-ar" dir="rtl">{hadith.ar}</p>
          {!isAr && <p className="alm-hadith-en">“{hadith.en}”</p>}
          <div className="alm-hadith-src">{hadith.src}</div>
          {after?.date && (
            <p className="alm-after">{after.key === 'sunrise' ? s.fajrEnds(fmtTime(after.date, lang)) : s.nextPrayer(prayerName(after.key, lang), fmtTime(after.date, lang))}</p>
          )}
          <button className="btn block" onClick={() => setHadith(null)}>{s.done}</button>
        </div>
      </div>
    )
  }
  if (!ringing) return null
  return <Ringing key={ringing.id + ringing.at} alarm={ringing} s={s} lang={lang} onDone={done} />
}

function Ringing({ alarm, s, lang, onDone }) {
  const isAr = lang === 'ar'
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setClock(new Date()), 10000); return () => clearInterval(id) }, [])
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

  // a keyboard still works for the sum: digits, Backspace, Enter
  const checkRef = useRef(check); checkRef.current = check
  useEffect(() => {
    if (task?.type !== 'math') return
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) setInput((v) => (v + e.key).slice(0, 4))
      else if (e.key === 'Backspace') setInput((v) => v.slice(0, -1))
      else if (e.key === 'Enter') checkRef.current()
      else return
      e.preventDefault(); setErr('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [task])

  return (
    <div className={`alm-overlay alm-ring p-${alarm.prayer || 'custom'}`} dir={isAr ? 'rtl' : 'ltr'} role="alertdialog" aria-modal="true" aria-label={name ? s.prayer(name) : s.custom}>
      {alarm.test && <span className="alm-test-badge">{s.testBadge}</span>}
      <div className="alm-ring-anim"><Anim name="wakeup" /></div>
      <div className="alm-ring-time">{fmtTime(hmToDate(alarm.at), lang)}</div>
      <div className="alm-ring-name">{name ? s.prayer(name) : s.custom}{alarm.prayer && !isAr && <span lang="ar"> · {prayerName(alarm.prayer, 'ar')}</span>}</div>
      <div className="alm-ring-now">{s.now(fmtTime(clock, lang))}</div>

      <div className="alm-card">
        <p className="alm-instr">{task ? s.solve : s.tap}</p>

        {task?.type === 'math' && (
          <>
            <div className="alm-problem" dir="ltr">{task.a} + {task.b} = <span className={`alm-entry${input ? '' : ' empty'}`} aria-label={s.answer}>{input || '?'}</span></div>
            <Keypad value={input} onChange={(v) => { setInput(v); setErr('') }} del={s.del} />
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
      {/* snooze only when no task was chosen: a task means "make sure I am awake" */}
      {alarm.test
        ? <button type="button" className="alm-ring-link" onClick={() => stopRinging()}>{s.endTest}</button>
        : !task && <button type="button" className="alm-ring-link" onClick={() => snooze(5)}>{s.snooze}</button>}
    </div>
  )
}

/** Big number keys for a half-asleep thumb: no phone keyboard popping up. */
function Keypad({ value, onChange, del }) {
  const press = (k) => onChange(k === 'del' ? value.slice(0, -1) : (value + k).slice(0, 4))
  return (
    <div className="alm-keys" dir="ltr">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => (
        k === '' ? <span key={i} /> : (
          <button key={i} type="button" className={k === 'del' ? 'del' : ''} aria-label={k === 'del' ? del : k} onClick={() => press(k)}>
            {k === 'del' ? '⌫' : k}
          </button>
        )
      ))}
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
