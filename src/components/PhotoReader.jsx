import { useEffect, useRef, useState } from 'react'
import { readPhotoText } from '../lib/ocrRun'

/**
 * Take or pick a photo and read its text on the device.
 * Calls onText({ raw, conf }) with the line-broken text; the parent decides what the text means.
 */
export default function PhotoReader({ s, defaultLang = 'eng', psm = '11', pickLabel, onText, onFail }) {
  const [state, setState] = useState('idle') // idle | loading | reading
  const [pct, setPct] = useState(0)
  const [ocrLang, setOcrLang] = useState(defaultLang)
  const abortRef = useRef(null)

  // leaving the panel stops the worker
  useEffect(() => () => abortRef.current?.abort(), [])

  async function run(file) {
    if (!file) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState('loading'); setPct(0)
    try {
      const r = await readPhotoText(file, {
        langs: ocrLang, psm, signal: ctrl.signal,
        onProgress: (p) => { if (!ctrl.signal.aborted) { setState('reading'); setPct(p) } },
      })
      if (ctrl.signal.aborted) return
      setState('idle')
      onText({ raw: r?.raw || '', conf: r?.conf || 0 })
    } catch {
      if (ctrl.signal.aborted) return
      setState('idle')
      onFail?.()
    }
  }

  const busy = state !== 'idle'
  return (
    <div className="mp-reader">
      <div className="ocr-langs" role="group" aria-label={s.textLang}>
        {Object.entries(s.langs).map(([k, label]) => (
          <button key={k} type="button" className={ocrLang === k ? 'on' : ''} aria-pressed={ocrLang === k} disabled={busy} onClick={() => setOcrLang(k)}>{label}</button>
        ))}
      </div>
      <label className={`btn block${busy ? ' disabled' : ''}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        {pickLabel}
        <input type="file" accept="image/*" hidden disabled={busy}
          onChange={(e) => { run(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {busy && (
        <p className="cam-note" role="status" aria-live="polite">
          {state === 'loading' ? s.loadingOcr : `${s.reading} ${pct}%`}
          <span className="ocr-bar"><i style={{ width: `${state === 'loading' ? 5 : pct}%` }} /></span>
        </p>
      )}
    </div>
  )
}
