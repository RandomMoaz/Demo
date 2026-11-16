import { useState } from 'react'
import PhotoReader from './PhotoReader'
import { readCertificate } from '../lib/certificate'
import { OCR_BLOCK } from '../lib/ocrPrep'

const TONE = { valid: 'ok', expired: 'bad', checkDate: 'warn', noDate: 'warn', notCert: 'warn' }
const ICON = { ok: '✓', warn: '!', bad: '✕' }

/** Photograph a restaurant's halal certificate and see who issued it, until when, and for whom. */
export default function CertificateCheck({ s, placeName, locale, ocrLang }) {
  const c = s.cert
  const [open, setOpen] = useState(false)
  const [res, setRes] = useState(null) // readCertificate() result, or { status: 'fail' }

  const day = (d) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)

  function onText({ raw, conf }) {
    const r = readCertificate(raw, { placeName })
    // a noisy read that found nothing is a failed read, not "not a certificate"
    setRes(r.status === 'notCert' && conf < OCR_BLOCK ? { status: 'fail' } : r)
  }

  if (!open) {
    return (
      <button type="button" className="btn ghost block mp-cert-open" onClick={() => setOpen(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M9 12l2 2 4-4" /></svg>
        {c.open}
      </button>
    )
  }

  const tone = res && TONE[res.status]
  return (
    <section className="mp-cert" aria-label={c.title}>
      <div className="mp-cert-h">{c.title}</div>
      {!res && <p className="cam-note">{c.hint}</p>}
      {res?.status === 'fail' && <p className="cam-note err">{c.fail}</p>}
      {tone && (
        <div className={`verdict ${tone}`} role="status">
          <div className="vb">{ICON[tone]}</div>
          <div>
            <div className="vt">{c.status[res.status]}</div>
            {res.expiry && res.status === 'valid' && <div className="vs">{c.until(day(res.expiry))} · {c.daysLeft(res.daysLeft)}</div>}
            {res.expiry && res.status === 'expired' && <div className="vs">{c.expiredOn(day(res.expiry))}</div>}
            {res.status === 'checkDate' && <div className="vs">{c.ambiguous(day(res.options[0]), day(res.options[1]))}</div>}
          </div>
        </div>
      )}
      {tone && res.status !== 'notCert' && (
        <ul className="mp-cert-facts">
          <li className={res.bodies.length ? 'ok' : 'warn'}>
            {res.bodies.length ? <><b>{c.body}:</b> {res.bodies.map((b) => b.name).join(', ')}</> : c.unknownBody}
          </li>
          {res.names != null && <li className={res.names ? 'ok' : 'warn'}>{res.names ? c.names : c.noName}</li>}
        </ul>
      )}
      <PhotoReader s={s} psm="3" defaultLang={ocrLang} pickLabel={res ? c.again : c.pick}
        onText={onText} onFail={() => setRes({ status: 'fail' })} />
      <p className="fine">{c.fine}</p>
    </section>
  )
}
