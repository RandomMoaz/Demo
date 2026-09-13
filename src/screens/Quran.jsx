import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { SURAHS, ADHKAR, loadQuran } from '../lib/quran'

const Back = ({ onClick }) => (
  <button className="back-ic" onClick={onClick} aria-label="back">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
)

/* ---------------- Mushaf (Quran reader) ---------------- */
export function Mushaf() {
  const { t, lang, go , back} = useApp()
  const [surah, setSurah] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('mc_quran_fs')) || 27)
  const showTr = lang !== 'ar'

  useEffect(() => { localStorage.setItem('mc_quran_fs', String(fontSize)) }, [fontSize])

  useEffect(() => {
    if (!surah) return
    let alive = true
    setLoading(true); setError(false); setData(null)
    loadQuran()
      .then((q) => {
        if (!alive) return
        const c = q[surah] || q[String(surah)]
        if (!c) throw new Error('missing')
        setData({
          name: c.n,
          ename: c.e,
          meaning: c.t,
          ayat: c.v.map(([n, ar, tr]) => ({ n, ar, tr: tr || '' })),
        })
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [surah])

  // --- reader view ---
  if (surah) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir="rtl">
        <div className="feat-top">
          <Back onClick={() => setSurah(null)} />
          <div>
            <div className="h1 ar">{data?.name || SURAHS.find((s) => s[0] === surah)?.[1]}</div>
            <div className="h2">{data?.ename || SURAHS.find((s) => s[0] === surah)?.[2]}</div>
          </div>
          {/* font size controls */}
          <div dir="ltr" style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
            <button className="back-ic latin" style={{ width: 34, height: 34, fontSize: 13, fontWeight: 700 }} onClick={() => setFontSize((f) => Math.max(20, f - 2))} aria-label="smaller">A−</button>
            <button className="back-ic latin" style={{ width: 34, height: 34, fontSize: 15, fontWeight: 700 }} onClick={() => setFontSize((f) => Math.min(44, f + 2))} aria-label="larger">A+</button>
          </div>
        </div>
        <div className="feat-body mushaf-page">
          <div className="surah-plaque">
            <div className="s-name">سورة {data?.name || SURAHS.find((s) => s[0] === surah)?.[1]}</div>
            <div className="s-meta">{data?.ename || SURAHS.find((s) => s[0] === surah)?.[2]} · {data ? data.ayat.length : SURAHS.find((s) => s[0] === surah)?.[3]} {t.qAyat}</div>
          </div>
          {surah !== 1 && surah !== 9 && (
            <div className="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
          )}
          {loading && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>… {t.qLoading}</p>}
          {error && <p style={{ color: 'var(--coral)', textAlign: 'center', padding: 20 }}>{t.qError}</p>}

          {data && (
            <div className="mushaf-frame">
              <div className="mushaf-flow" style={{ fontSize, lineHeight: 2.35, textAlign: 'justify', textAlignLast: 'center', direction: 'rtl' }}>
                {data.ayat.map((a) => (
                  <span key={a.n}>
                    {a.ar}
                    <span className="ayah-num">{toArabicNum(a.n)}</span>{' '}
                  </span>
                ))}
              </div>
            </div>
          )}

          {showTr && data && (
            <details className="mushaf-tr">
              <summary>{t.qTr}</summary>
              {data.ayat.map((a) => a.tr && (
                <p key={a.n} style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, margin: '8px 0', direction: 'ltr', textAlign: 'left' }}>
                  <b style={{ color: 'var(--accent)' }}>{a.n}.</b> {a.tr}
                </p>
              ))}
            </details>
          )}
        </div>
      </div>
    )
  }

  // --- surah list ---
  const list = SURAHS.filter((s) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return s[1].includes(query) || s[2].toLowerCase().includes(q) || String(s[0]) === q
  })
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.qH1}</div><div className="h2">{t.qH2}</div></div>
        <span className="ar-tag">مصحف</span>
      </div>
      <div style={{ padding: '12px 18px 0' }}>
        <input className="name-input" placeholder={t.qSearch} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="feat-body" style={{ paddingTop: 10 }}>
        {list.map((s) => (
          <button key={s[0]} className="choice" onClick={() => setSurah(s[0])}>
            <span className="mark">{s[0]}</span>
            <span style={{ flex: 1 }}>
              <span className="t1 ar" style={{ fontSize: 17 }}>{s[1]}</span>
              <span className="t2">{s[2]} · {s[3]} {t.qAyat} · {s[4] === 'م' ? t.qMeccan : t.qMedinan}</span>
            </span>
            <span className="arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></span>
          </button>
        ))}
      </div>
    </div>
  )
}

function toArabicNum(n) {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])
}

/* ---------------- Tasbih (digital counter) ---------------- */
export function Tasbih() {
  const { t, back } = useApp()
  const [idx, setIdx] = useState(0)
  const [count, setCount] = useState(0)
  const [rounds, setRounds] = useState(0)
  const [dhikr, tr, target] = ADHKAR[idx]
  const ringRef = useRef(null)

  const tap = () => {
    const n = count + 1
    const done = n % target === 0
    setCount(n)
    if (done) setRounds((r) => r + 1)
    if (navigator.vibrate) navigator.vibrate(done ? [40, 40, 40] : 12)
  }
  const reset = () => { setCount(0); setRounds(0) }
  const pick = (i) => { setIdx(i); setCount(0); setRounds(0) }

  const inRound = count % target
  const pct = (inRound / target) * 100
  const R = 92, C = 2 * Math.PI * R

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.tasH1}</div><div className="h2">{t.tasH2}</div></div>
        <span className="ar-tag">سبحة</span>
      </div>

      <div className="feat-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* dhikr presets */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 18 }}>
          {ADHKAR.map((a, i) => (
            <button key={i} onClick={() => pick(i)} className="ar" style={{
              border: '1px solid var(--line)', borderRadius: 20, padding: '7px 13px', minHeight: 44, cursor: 'pointer',
              fontFamily: 'Amiri, serif', fontSize: 15,
              background: i === idx ? 'var(--lapis-soft)' : 'var(--surface)',
              color: i === idx ? 'var(--accent)' : 'var(--muted)',
              borderColor: i === idx ? 'var(--accent)' : 'var(--line)',
            }}>{a[0]}</button>
          ))}
        </div>

        {/* big tap counter ring */}
        <button ref={ringRef} onClick={tap} style={{ position: 'relative', width: 240, height: 240, border: 'none', background: 'none', cursor: 'pointer' }}>
          <svg width="240" height="240" viewBox="0 0 240 240" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="120" cy="120" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
            <circle cx="120" cy="120" r={R} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} style={{ transition: 'stroke-dashoffset .15s' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="ar" style={{ fontSize: 20, color: 'var(--accent)', marginBottom: 4 }}>{dhikr}</div>
            <div style={{ fontSize: 52, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{inRound}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>/ {target} · {t.tasRound(rounds)}</div>
          </div>
        </button>

        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>{tr} · {t.tasTotal(count)}</div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn ghost" onClick={reset}>{t.tasReset}</button>
          <button className="btn" onClick={tap}>{t.tasCount}</button>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', marginTop: 16, maxWidth: '32ch' }}>
          {t.tasHint}
        </p>
      </div>
    </div>
  )
}
