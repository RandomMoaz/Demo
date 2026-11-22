import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import bank from '../content/quiz.json'
import { useKids, update } from '../store'
import { quizAnswer, finishQuiz } from '../progress'
import { kidsText } from '../text'
import { BAND, quizRound, pickLang, say, hush } from '../lib'
import { KTop, Noor, Star, SpeakBtn, celebrate } from '../ui'

export default function KidsQuiz() {
  const { lang } = useApp()
  const { profile } = useKids()
  const k = kidsText(lang), t = k.quiz
  const band = BAND[profile.band] ? profile.band : 'explorer'
  const conf = BAND[band]
  const newRound = () => quizRound(bank[band], { len: conf.quizLen, options: conf.options })
  const [round, setRound] = useState(newRound)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null)
  const [right, setRight] = useState(0)
  const [over, setOver] = useState(false)
  const q = round[i]

  useEffect(() => { if (profile.voice && conf.readAloud && q && !over) say(pickLang(q.q, lang), lang) }, [i, over]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => hush, [])

  function choose(j) {
    if (picked != null) return
    setPicked(j)
    const ok = j === q.ok
    if (ok) setRight((r) => r + 1)
    celebrate(update(quizAnswer, ok))
  }
  function next() {
    if (i + 1 < round.length) { setI(i + 1); setPicked(null); return }
    celebrate(update(finishQuiz))
    setOver(true)
  }
  function again() { setRound(newRound()); setI(0); setPicked(null); setRight(0); setOver(false) }

  const bar = <div className="k-qbar" aria-hidden="true">{round.map((_, j) => <i key={j} className={j < i || (j === i && picked != null) || over ? 'on' : ''} />)}</div>

  if (over) {
    return (
      <div className="k-screen">
        <KTop title={bar} />
        <div className="k-scroll pad k-center">
          <Noor size={110} wave />
          <h2 className="k-result">{t.result(right, round.length)}</h2>
          <div className="k-result-stars" aria-hidden="true">{round.map((_, j) => <span key={j} className={j < right ? 'on' : ''}><Star size={30} /></span>)}</div>
          <button type="button" className="k-btn" onClick={again}>{t.again}</button>
        </div>
      </div>
    )
  }

  const answered = picked != null
  const why = answered ? pickLang(q.why, lang) : ''
  return (
    <div className="k-screen">
      <KTop title={bar} />
      <div className="k-scroll pad">
        <div className="k-question">
          <span className="k-q-ic" aria-hidden="true">?</span>
          <h2>{pickLang(q.q, lang)}</h2>
          <SpeakBtn text={pickLang(q.q, lang)} />
        </div>

        <div className={`k-answers n${q.a.length}`}>
          {q.a.map((a, j) => {
            const state = !answered ? '' : j === q.ok ? ' right' : j === picked ? ' tried' : ' fade'
            return (
              <button key={j} type="button" className={`k-answer${state}${a.pic ? ' pic' : ''}`} onClick={() => choose(j)} disabled={answered} aria-pressed={j === picked}>
                {a.pic && <span className="k-answer-pic" aria-hidden="true">{a.pic}</span>}
                <span className="k-answer-t">{pickLang(a, lang)}</span>
                {answered && j === q.ok && <span className="k-tick" aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>

        {answered && (
          <div className="k-bubble" role="status">
            <Noor size={46} />
            <p><b>{picked === q.ok ? t.right : `${t.gentle} ${pickLang(q.a[q.ok], lang)}.`}</b> {why}</p>
            {picked === q.ok && <span className="k-plus-chip num">+1 <Star size={14} /></span>}
          </div>
        )}
      </div>
      <div className="k-foot">
        <button type="button" className="k-btn" disabled={!answered} onClick={next}>{i + 1 < round.length ? t.next : t.finish}</button>
      </div>
    </div>
  )
}
