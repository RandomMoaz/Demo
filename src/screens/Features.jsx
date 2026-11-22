import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { analyze, pick } from '../lib/data'
import BarcodeCam from '../components/BarcodeCam'
import IngredientOCR from '../components/IngredientOCR'
import { OCR_BLOCK, OCR_TRUST } from '../lib/ocrPrep'
import { createPrayerCameraController } from '../lib/prayerCamera'

const Back = ({ onClick }) => (
  <button className="back-ic" onClick={onClick} aria-label="back">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
)

/* ---------------- Scanner ---------------- */
export function Scanner() {
  const { t, lang, go , back} = useApp()
  const [tab, setTab] = useState('paste')
  const [text, setText] = useState('')
  const [ocrConf, setOcrConf] = useState(null) // set after an OCR read, cleared once the user edits the text
  const [result, setResult] = useState(null)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')

  const show = (name, txt, trusted = true) => setResult({ name, ...analyze(txt || '', { trusted }) })

  async function lookup(c) {
    c = String(c).trim(); if (!/^\d{6,14}$/.test(c)) return
    setStatus(t.looking); setResult(null)
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name,brands,ingredients_text,ingredients_text_en,labels,lang`)
      const d = await r.json(); setStatus('')
      if (d.status === 1 && d.product) {
        const p = d.product
        // a clean verdict is only trusted when the ingredient text is English or Arabic
        const trusted = Boolean(p.ingredients_text_en) || ['en', 'ar'].includes(p.lang)
        show([p.product_name, p.brands].filter(Boolean).join(' · ') || 'Product',
          [p.ingredients_text_en || p.ingredients_text, p.labels].filter(Boolean).join('. '), trusted)
      } else show(t.notfound, '')
    } catch { setStatus(t.neterr) }
  }

  const verdict = result && (result.v === 'ok' ? t.vOk : result.v === 'warn' ? t.vWarn : result.v === 'bad' ? t.vBad : t.vUnknown)
  const icon = { ok: '✓', warn: '!', bad: '✕', unknown: '?' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.scanH1}</div><div className="h2">{t.scanH2}</div></div>
        <span className="ar-tag">حلال</span>
      </div>
      <div className="feat-body">
        <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
          {['barcode', 'photo', 'paste'].map((x) => (
            <button key={x} className="btn ghost" style={{ flex: 1, minHeight: 42, padding: '10px 6px', borderColor: tab === x ? 'var(--accent)' : undefined, color: tab === x ? 'var(--accent)' : undefined }} onClick={() => { setTab(x); setResult(null) }}>
              {x === 'barcode' ? t.tabBarcode : x === 'photo' ? (lang === 'ar' ? 'صورة' : 'Photo') : t.tabPaste}
            </button>
          ))}
        </div>

        {tab === 'barcode' ? (
          <>
            <BarcodeCam lang={lang} onCode={(c) => { setCode(c); lookup(c) }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input className="name-input" inputMode="numeric" placeholder="3017624010701" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup(code)} />
              <button className="btn" onClick={() => lookup(code)}>{t.bcLookup}</button>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {['3017624010701', '5000159407236', '7622210449283'].map((c) => (
                <button key={c} className="btn ghost" style={{ minHeight: 36, fontSize: 11, padding: '7px 11px' }} onClick={() => { setCode(c); lookup(c) }}>{c}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            {tab === 'photo'
              ? <IngredientOCR lang={lang} onResult={({ text: tx, conf }) => { setText(tx); setOcrConf(conf) }} />
              : <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{t.pasteLead}</p>}
            <textarea className="paste" value={text} onChange={(e) => { setText(e.target.value); setOcrConf(null) }} placeholder="Sugar, palm oil, gelatin, soy lecithin, mono- and diglycerides…" />
            <button className="btn block" style={{ marginTop: 12 }} disabled={!text.trim() || (ocrConf != null && ocrConf < OCR_BLOCK)} onClick={() => show(tab === 'photo' ? 'Photo ingredients' : 'Pasted ingredients', text, ocrConf == null || ocrConf >= OCR_TRUST)}>{t.analyze}</button>
          </>
        )}

        {status && <p style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>{status}</p>}

        {result && verdict && (
          <div>
            {result.name && <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 15 }}>{result.name}</div>}
            <div className={`verdict ${result.v}`}>
              <div className="vb">{icon[result.v]}</div>
              <div><div className="vt">{verdict[0]}</div><div className="vs">{verdict[1]}</div></div>
            </div>
            {result.found.map((f) => (
              <div key={f.id} className="flg">
                <div className="fn">{pick(f.n, lang)} · {f.s === 'haram' ? t.haram : t.doubtful}</div>
                <div className="fw">{pick(f.w, lang)}</div>
              </div>
            ))}
            {result.cert && <div className="fine">{lang === 'ar' ? 'النص يذكر كلمة «حلال» — هذا ادّعاء على الملصق ولم نتحقق منه.' : 'The text mentions "halal" — that is a label claim we have not verified.'}</div>}
            <div className="fine">{t.scanFine}</div>
            {result.found[0] && (
              <button className="btn ghost block" style={{ marginTop: 12 }}
                onClick={() => go('rashed', (result.found[0].n.ar) + ' حلال')}>{t.askRashed}</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Alarm ---------------- */

/* The alarm lives in its own file; re-exported so existing imports keep working. */
export { default as Alarm } from './AlarmScreen'

/* The map lives in its own file; re-exported so existing imports keep working. */
export { default as MapScreen } from './MapScreen'

/* ---------------- Salah camera (pose inference is implemented separately) ---------------- */
export function Salah() {
  const { t, lang, back } = useApp()
  const [cameraState, setCameraState] = useState('idle')
  const videoRef = useRef(null)
  const cameraRef = useRef(null)
  const ar = lang === 'ar'
  const text = {
    idle: ar ? 'تُستخدم الكاميرا لعرضك أثناء التدريب. لا يتم حفظ الفيديو أو رفعه.' : 'The camera shows you during practice. Video is not saved or uploaded.',
    starting: ar ? 'جارٍ طلب إذن الكاميرا…' : 'Requesting camera access…',
    active: ar ? 'الكاميرا تعمل. أوقفها في أي وقت.' : 'Camera is on. You can stop it at any time.',
    denied: ar ? 'لم يُسمح بالوصول إلى الكاميرا. يمكنك السماح بها من إعدادات المتصفح.' : 'Camera access was denied. You can allow it in your browser settings.',
    unavailable: ar ? 'لا توجد كاميرا متاحة على هذا الجهاز.' : 'No camera is available on this device.',
    busy: ar ? 'الكاميرا مستخدمة حاليًا. أغلق التطبيق الآخر ثم حاول مجددًا.' : 'The camera is in use. Close the other app and try again.',
    insecure: ar ? 'يتطلب الوصول للكاميرا صفحة آمنة عبر HTTPS.' : 'Camera access requires a secure HTTPS page.',
    error: ar ? 'تعذر تشغيل الكاميرا. تحقق من إعدادات الجهاز وحاول مجددًا.' : 'Could not start the camera. Check device settings and try again.',
  }

  function start() { void cameraRef.current?.start() }
  function stop() { cameraRef.current?.stop() }

  useEffect(() => {
    const camera = createPrayerCameraController(videoRef.current, { onState: setCameraState })
    cameraRef.current = camera
    return () => {
      camera.dispose()
      if (cameraRef.current === camera) cameraRef.current = null
    }
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.salahH1}</div><div className="h2">{t.salahH2}</div></div>
        <span className="ar-tag">صلاة</span>
      </div>
      <div className="feat-body">
        <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#05070a', aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={videoRef} playsInline muted autoPlay aria-label={ar ? 'معاينة الكاميرا' : 'Camera preview'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', visibility: cameraState === 'active' ? 'visible' : 'hidden' }} />
          {cameraState !== 'active' && <div style={{ position: 'relative', textAlign: 'center', padding: 26, color: 'var(--muted)' }}><p style={{ fontSize: 12.5, lineHeight: 1.6, maxWidth: '30ch' }}>{cameraState === 'idle' ? t.poseHint : text[cameraState]}</p></div>}
        </div>
        <p role="status" aria-live="polite" style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>{text[cameraState] || text.error}</p>
        <button className="btn block" disabled={cameraState === 'starting'} onClick={cameraState === 'active' ? stop : start}>{cameraState === 'active' ? (ar ? 'إيقاف الكاميرا' : 'Stop camera') : cameraState === 'starting' ? text.starting : t.poseStart}</button>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: 14 }}>{t.salahNote}</p>
      </div>
    </div>
  )
}
