import { useState, useRef, useEffect } from 'react'
import { LANGS } from '../lib/data'

const script = (id) => (id === 'ar' ? 'ar' : id === 'ja' ? 'jp' : '')

export default function LangPicker({ value, onChange, label = 'Language' }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef(null)
  const btn = useRef(null)
  const list = useRef(null)
  const current = LANGS.find((l) => l.id === value) || LANGS[0]

  // close on any tap outside
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (!root.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  // start the highlight on the current language and take keyboard focus
  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, LANGS.findIndex((l) => l.id === value)))
    requestAnimationFrame(() => list.current?.focus())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function choose(id) {
    onChange(id)
    setOpen(false)
    btn.current?.focus()
  }

  function onListKey(e) {
    const n = LANGS.length
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % n) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + n) % n) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(n - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(LANGS[active].id) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btn.current?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className={`lang-pick ${open ? 'open' : ''}`} ref={root}>
      <button
        ref={btn}
        type="button"
        className="lp-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.native}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true) } }}
      >
        <svg className="lp-globe" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M2.5 12h19M12 2.5c2.6 2.7 3.9 5.9 3.9 9.5s-1.3 6.8-3.9 9.5c-2.6-2.7-3.9-5.9-3.9-9.5S9.4 5.2 12 2.5z" />
        </svg>
        <span className={`lp-cur ${script(current.id)}`}>{current.native}</span>
        <span className={`lp-short ${script(current.id)}`}>{current.mark}</span>
        <svg className="lp-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          ref={list}
          className="lp-menu"
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`lp-${LANGS[active].id}`}
          onKeyDown={onListKey}
        >
          {LANGS.map((l, i) => {
            const sel = l.id === value
            return (
              <li
                key={l.id}
                id={`lp-${l.id}`}
                role="option"
                aria-selected={sel}
                className={`lp-opt${i === active ? ' active' : ''}${sel ? ' sel' : ''}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(l.id)}
              >
                <span className={`lp-mark ${script(l.id)}`} aria-hidden="true">{l.mark}</span>
                <span className="lp-text">
                  <span className={`lp-name ${script(l.id)}`} lang={l.id}>{l.native}</span>
                  <span className={`lp-hint ${script(l.id)}`} lang={l.id}>{l.hint}</span>
                </span>
                {sel && (
                  <svg className="lp-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
