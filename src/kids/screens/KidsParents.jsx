import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { LANGS } from '../../lib/data'
import { useKids, setProfile, resetProgress, BANDS, LIMITS } from '../store'
import { kidsText } from '../text'
import { makeSum } from '../lib'
import { KTabBar, Noor } from '../ui'

/** Grown-ups only: a sum (or the parent PIN, once one is set) before the settings open. */
export function ParentGate({ onPass }) {
  const { lang } = useApp()
  const { profile } = useKids()
  const t = kidsText(lang).parents
  const [sum, setSum] = useState(() => makeSum())
  const [val, setVal] = useState('')
  const [wrong, setWrong] = useState(false)
  const usePin = !!profile.pin
  function check(e) {
    e.preventDefault()
    if (usePin ? val === profile.pin : Number(val) === sum.answer) { onPass(); return }
    setWrong(true); setVal(''); setSum(makeSum())
  }
  return (
    <form className="k-gate" onSubmit={check}>
      <span className="k-gate-lock" aria-hidden="true">🔒</span>
      <h1>{t.gateTitle}</h1>
      <p>{t.gateLead}</p>
      <label className="k-gate-q" htmlFor="k-gate-in">{usePin ? t.gatePin : t.gateSum(sum.a, sum.b)}</label>
      <input id="k-gate-in" className="k-input num" inputMode="numeric" autoComplete="off" type={usePin ? 'password' : 'text'}
        maxLength={usePin ? 4 : 4} value={val} onChange={(e) => { setVal(e.target.value.replace(/\D/g, '')); setWrong(false) }} />
      {wrong && <p className="k-gate-wrong" role="alert">{t.wrong}</p>}
      <button type="submit" className="k-btn" disabled={!val}>{t.open}</button>
    </form>
  )
}

function Seg({ value, options, onChange, label }) {
  return (
    <div className="k-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  )
}

/** The settings themselves (also used for the first-time setup). */
export function ParentSettings({ setup = false, onDone }) {
  const { lang, setLang, setPersona, go } = useApp()
  const { profile, usage } = useKids()
  const t = kidsText(lang).parents
  const [pin, setPin] = useState('')
  const [sure, setSure] = useState(false)
  const k = kidsText(lang)

  function leave() {
    setProfile({ active: false })
    setPersona('adult')
    go('profile')
  }

  return (
    <div className="k-scroll pad k-parents">
      {setup ? (
        <div className="k-setup-h"><Noor size={72} wave /><h1>{k.setup.title}</h1><p>{k.setup.lead}</p></div>
      ) : <h1 className="k-title solo">{t.title}</h1>}

      <label className="k-field">
        <span>{t.name}</span>
        <input className="k-input" value={profile.name} maxLength={20} autoComplete="off" onChange={(e) => setProfile({ name: e.target.value.replace(/[^\p{L}\p{M}\s'-]/gu, '') })} />
      </label>

      <div className="k-field">
        <span>{t.age}</span>
        <div className="k-bands" role="radiogroup" aria-label={t.age}>
          {BANDS.map((b) => (
            <button key={b} type="button" role="radio" aria-checked={profile.band === b} className={profile.band === b ? 'on' : ''} onClick={() => setProfile({ band: b, voice: b === 'little' ? true : profile.voice })}>
              <b>{t.bands[b]}</b><small>{t.bandHints[b]}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="k-field">
        <span>{t.limit}</span>
        <Seg label={t.limit} value={profile.limitMin} onChange={(v) => setProfile({ limitMin: v })}
          options={LIMITS.map((m) => [m, m ? t.min(m) : t.limitOff])} />
        {!setup && <small className="k-hint num">{t.usedToday(Math.round(usage.ms / 60000))}</small>}
      </div>

      <label className="k-switch">
        <input type="checkbox" checked={profile.voice} onChange={(e) => setProfile({ voice: e.target.checked })} />
        <span>{t.voice}</span>
      </label>

      <div className="k-field">
        <span>{t.language}</span>
        <div className="k-langs">
          {LANGS.map((l) => (
            <button key={l.id} type="button" aria-pressed={lang === l.id} className={lang === l.id ? 'on' : ''} onClick={() => { setLang(l.id); setProfile({ lang: l.id }) }}>{l.native}</button>
          ))}
        </div>
      </div>

      {!setup && (
        <>
          <div className="k-field">
            <span>{t.pin}</span>
            {profile.pin ? (
              <div className="k-row"><b className="k-pin-on">✓ {t.pinOn}</b><button type="button" className="k-btn ghost small" onClick={() => setProfile({ pin: '' })}>{t.pinRemove}</button></div>
            ) : (
              <form className="k-row" onSubmit={(e) => { e.preventDefault(); if (pin.length === 4) { setProfile({ pin }); setPin('') } }}>
                <input className="k-input num" inputMode="numeric" type="password" maxLength={4} placeholder={t.pinNew} aria-label={t.pinNew}
                  value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
                <button type="submit" className="k-btn ghost small" disabled={pin.length !== 4}>{t.pinSave}</button>
              </form>
            )}
            <small className="k-hint">{t.pinHint}</small>
          </div>

          <div className="k-field">
            {sure ? (
              <div className="k-confirm">
                <p>{t.resetSure}</p>
                <div className="k-row">
                  <button type="button" className="k-btn danger small" onClick={() => { resetProgress(); setSure(false) }}>{t.yes}</button>
                  <button type="button" className="k-btn ghost small" onClick={() => setSure(false)}>{t.cancel}</button>
                </div>
              </div>
            ) : <button type="button" className="k-btn ghost" onClick={() => setSure(true)}>{t.reset}</button>}
          </div>

          <div className="k-field">
            <button type="button" className="k-btn ghost" onClick={leave}>{t.leave}</button>
            <small className="k-hint">{t.leaveNote}</small>
          </div>
        </>
      )}

      <p className="k-privacy">{t.privacy}</p>
      <button type="button" className="k-btn" onClick={onDone}>{setup ? k.setup.start : t.done}</button>
    </div>
  )
}

export default function KidsParents() {
  const { go } = useApp()
  const [open, setOpen] = useState(false)
  return (
    <>
      {open ? <ParentSettings onDone={() => go('kids')} /> : <div className="k-scroll pad"><ParentGate onPass={() => setOpen(true)} /></div>}
      <KTabBar />
    </>
  )
}
