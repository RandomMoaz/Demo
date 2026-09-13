import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { LANGS } from '../lib/data'
import { t as tr } from '../lib/i18n'

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
)
const Steps = ({ n }) => (
  <div className="steps">{[0, 1, 2, 3].map((i) => <i key={i} className={i < n ? 'on' : ''} />)}</div>
)

export function Language() {
  const { setLang, go } = useApp()
  return (
    <div className="scroll" dir="ltr">
      <div className="onb">
        <Steps n={1} />
        <h1 className="display">Choose your language</h1>
        <p>So every Arabic word you learn has a clear explanation beside it.</p>
      </div>
      <div style={{ padding: '4px 24px 8px' }}>
        {LANGS.map((l) => (
          <button key={l.id} className="choice" onClick={() => { setLang(l.id); go('name') }}>
            <span className={`mark ${l.id === 'ar' ? 'ar' : ''}`}>{l.mark}</span>
            <span><span className="t1">{l.native}</span><span className="t2">{l.hint}</span></span>
            <span className="arrow"><Arrow /></span>
          </button>
        ))}
        <p className="note">Prayer and Qur’an stay in <bdi className="ar">العربية</bdi>. Your language carries the explanation and the meaning.</p>
      </div>
    </div>
  )
}

export function Name() {
  const { lang, setName, go } = useApp()
  const t = tr(lang)
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)
  const submit = () => {
    if (!val.trim()) { setErr(true); return }
    setName(val.trim()); go('profile')
  }
  return (
    <div className="scroll" dir={t.dir}>
      <button className="back" style={{ padding: '14px 24px 0' }} onClick={() => go('language')}>← {t.back}</button>
      <div className="onb">
        <Steps n={2} />
        <span className="big-emoji wave">👋</span>
        <h1 className="display ar">{t.nameTitle}</h1>
        <p>{t.nameLead}</p>
      </div>
      <div style={{ padding: '4px 24px' }}>
        <input className="name-input" placeholder={t.namePh} value={val} maxLength={24}
          style={{ borderColor: err ? 'var(--coral)' : undefined }}
          onChange={(e) => { setVal(e.target.value); setErr(false) }}
          onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button className="btn block" style={{ marginTop: 14 }} onClick={submit}>{t.nameNext}</button>
      </div>
    </div>
  )
}

export function Profile() {
  const { lang, setPersona, go } = useApp()
  const t = tr(lang)
  const pick = (p) => { setPersona(p); go('location') }
  const P = [
    ['child', 'طفل', t.child, 'M14 3a8 8 0 1 0 7 11.5A9 9 0 0 1 14 3z'],
    ['new', 'مسلم جديد', t.new, 'M12 21v-8M12 13C12 9 9 7 5 7c0 4 3 6 7 6zM12 13c0-4 3-6 7-6 0 4-3 6-7 6z'],
    ['adult', 'بالغ', t.adult, 'M12 3c-3 3.2-5.5 4.2-5.5 8h11c0-3.8-2.5-4.8-5.5-8zM5 11h14v9H5zM10 20v-4a2 2 0 0 1 4 0v4'],
  ]
  return (
    <div className="scroll" dir={t.dir}>
      <button className="back" style={{ padding: '14px 24px 0' }} onClick={() => go('name')}>← {t.back}</button>
      <div className="onb">
        <Steps n={3} />
        <h1 className="display">{t.selTitle}</h1>
        <p>{t.selLead}</p>
      </div>
      <div style={{ padding: '4px 22px' }}>
        <div className="arches">
          {P.map(([id, ar, en, d]) => (
            <button key={id} className="arch" onClick={() => pick(id)}>
              <div className="pic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg></div>
              <span className="p-ar">{ar}</span><span className="p-en">{en}</span>
            </button>
          ))}
        </div>
        <p className="note">{t.selFoot}</p>
      </div>
    </div>
  )
}

export function Location() {
  const { lang, setLoc, go } = useApp()
  const t = tr(lang)
  const finish = () => go('home')
  const allow = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); finish() },
        () => finish(),
        { enableHighAccuracy: false, timeout: 8000 }
      )
    } else finish()
  }
  return (
    <div className="scroll" dir={t.dir}>
      <div className="onb" style={{ textAlign: 'center' }}>
        <Steps n={4} />
        <span className="big-emoji bob" style={{ display: 'block' }}>📍</span>
        <h1 className="display" style={{ marginInline: 'auto' }}>{t.locTitle}</h1>
        <p style={{ marginInline: 'auto' }}>{t.locLead}</p>
      </div>
      <div style={{ padding: '4px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn block" onClick={allow}>{t.locAllow}</button>
        <button className="btn ghost block" onClick={finish}>{t.locSkip}</button>
        <p className="note" style={{ textAlign: 'center' }}>{t.locNote}</p>
      </div>
    </div>
  )
}
