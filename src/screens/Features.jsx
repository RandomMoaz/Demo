import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { analyze, pick } from '../lib/data'
import { Anim } from '../components/Lottie'

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
  const [result, setResult] = useState(null)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')

  const show = (name, txt) => setResult({ name, ...analyze(txt || '') })

  async function lookup(c) {
    c = String(c).trim(); if (!/^\d{6,14}$/.test(c)) return
    setStatus(t.looking); setResult(null)
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name,brands,ingredients_text,ingredients_text_en,labels`)
      const d = await r.json(); setStatus('')
      if (d.status === 1 && d.product) {
        const p = d.product
        show([p.product_name, p.brands].filter(Boolean).join(' · ') || 'Product',
          [p.ingredients_text_en, p.ingredients_text, p.labels].filter(Boolean).join('. '))
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
          {['barcode', 'paste'].map((x) => (
            <button key={x} className="btn ghost" style={{ flex: 1, minHeight: 42, borderColor: tab === x ? 'var(--accent)' : undefined, color: tab === x ? 'var(--accent)' : undefined }} onClick={() => { setTab(x); setResult(null) }}>
              {x === 'barcode' ? t.tabBarcode : t.tabPaste}
            </button>
          ))}
        </div>

        {tab === 'barcode' ? (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
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
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{t.pasteLead}</p>
            <textarea className="paste" value={text} onChange={(e) => setText(e.target.value)} placeholder="Sugar, palm oil, gelatin, soy lecithin, mono- and diglycerides…" />
            <button className="btn block" style={{ marginTop: 12 }} onClick={() => show('Pasted ingredients', text)}>{t.analyze}</button>
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
export function Alarm() {
  const { t, go } = useApp()
  const [challenge, setChallenge] = useState(null)
  const [answer, setAnswer] = useState('')
  const [msg, setMsg] = useState(null)
  const [ringing, setRinging] = useState(true)

  const dismiss = () => {
    if (!challenge) {
      const a = 6 + Math.floor(Math.random() * 8), b = 7 + Math.floor(Math.random() * 8)
      setChallenge({ a, b, sum: a + b }); setMsg(null); setAnswer('')
      return
    }
    if (parseInt(answer, 10) === challenge.sum) { setMsg({ ok: true, text: t.alarmDone }); setRinging(false) }
    else setMsg({ ok: false, text: t.alarmWrong })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.alarmH1}</div><div className="h2">{t.alarmH2}</div></div>
        <span className="ar-tag">فجر</span>
      </div>
      <div className="feat-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 56, fontWeight: 700, color: 'var(--coral)', fontVariantNumeric: 'tabular-nums' }}>05:02</div>
        <div className="ar" style={{ fontSize: 22 }}>صلاة الفجر</div>
        <div style={{ width: 220, height: 220 }}><Anim name="wakeup" /></div>
        {ringing && <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--muted)', fontSize: 13 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--coral)' }} />{t.alarmRing}</div>}
        {challenge && (
          <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 16, textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{challenge.a} + {challenge.b} = ?</div>
            <input className="name-input" style={{ width: 120, textAlign: 'center', marginTop: 12 }} inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && dismiss()} />
            {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.ok ? 'var(--accent)' : 'var(--coral)' }}>{msg.text}</div>}
          </div>
        )}
        {ringing && <button className="btn block" style={{ maxWidth: 320 }} onClick={dismiss}>{challenge ? t.alarmSolve : t.alarmDismiss}</button>}
        <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6, textAlign: 'center', maxWidth: 320, marginTop: 12 }}>{t.alarmNote}</p>
      </div>
    </div>
  )
}

/* ---------------- Map (Leaflet loaded on demand) ---------------- */
export function MapScreen() {
  const { t, go, loc, setLoc } = useApp()
  const [phase, setPhase] = useState(loc ? 'map' : 'gate')
  const [status, setStatus] = useState('')
  const mapRef = useRef(null)

  useEffect(() => { if (phase === 'map' && loc) start(loc) /* eslint-disable-next-line */ }, [phase])

  function requestLoc() {
    setStatus(t.mapLocating)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { const l = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setLoc(l); setPhase('map') },
        () => setStatus(t.mapDenied), { enableHighAccuracy: false, timeout: 8000 })
    } else setStatus(t.mapDenied)
  }

  async function loadLeaflet() {
    if (window.L) return
    await new Promise((res) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l); res() })
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s) })
  }

  async function start(l) {
    setStatus(t.mapSearching)
    await loadLeaflet()
    const L = window.L
    if (!mapRef.current._map) {
      const map = L.map(mapRef.current).setView([l.lat, l.lng], 14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map)
      mapRef.current._map = map
      L.circleMarker([l.lat, l.lng], { radius: 7, color: '#48B9A2', fillColor: '#48B9A2', fillOpacity: .9 }).addTo(map)
      setTimeout(() => map.invalidateSize(), 200)
      const q = `[out:json][timeout:20];(node["amenity"="place_of_worship"]["religion"="muslim"](around:3000,${l.lat},${l.lng});way["amenity"="place_of_worship"]["religion"="muslim"](around:3000,${l.lat},${l.lng}););out center 40;`
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q })
        const data = await res.json(); let n = 0
        ;(data.elements || []).forEach((el) => {
          const la = el.lat || (el.center && el.center.lat), ln = el.lon || (el.center && el.center.lon)
          if (la == null || ln == null) return; n++
          const nm = (el.tags && (el.tags['name:ar'] || el.tags.name)) || 'مسجد'
          L.marker([la, ln]).addTo(map).bindPopup(`<b>${nm}</b>`)
        })
        setStatus(n ? t.mapFound(n) : t.mapNone)
      } catch { setStatus(t.mapNone) }
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.mapH1}</div><div className="h2">{t.mapH2}</div></div>
        <span className="ar-tag">مساجد</span>
      </div>
      {phase === 'gate' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 30, textAlign: 'center' }}>
          <div style={{ width: 220, height: 130 }}><Anim name="mosque" /></div>
          <h1 className="display" style={{ fontSize: 20 }}>{t.mapGate}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: '30ch', marginBottom: 10 }}>{status || t.mapGateLead}</p>
          <button className="btn" onClick={requestLoc}>{t.mapUse}</button>
        </div>
      ) : (
        <>
          <div ref={mapRef} style={{ flex: 1, width: '100%' }} />
          <div style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--muted)', borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>{status}</div>
        </>
      )}
    </div>
  )
}

/* ---------------- Salah (MediaPipe loaded on demand) ---------------- */
export function Salah() {
  const { t, go } = useApp()
  const [started, setStarted] = useState(false)
  const [posture, setPosture] = useState('—')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  async function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s) })
  }

  async function start() {
    setStarted(true)
    try {
      if (!window.Pose) {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js')
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js')
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js')
      }
      const video = videoRef.current, canvas = canvasRef.current, ctx = canvas.getContext('2d')
      const pose = new window.Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${f}` })
      pose.setOptions({ modelComplexity: 0, smoothLandmarks: true, minDetectionConfidence: .5, minTrackingConfidence: .5 })
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
      const classify = (lm) => {
        const nose = lm[0], hp = mid(lm[23], lm[24]), an = mid(lm[27], lm[28])
        const sh = mid(lm[11], lm[12])
        const torso = Math.atan2(Math.abs(sh.x - hp.x), Math.abs(sh.y - hp.y)) * 180 / Math.PI
        const headLow = nose.y > hp.y - 0.02, hi = (an.y - hp.y) > 0.32, low = (an.y - hp.y) < 0.18
        if (headLow && torso > 45) return 'سجود'
        if (torso > 55 && hi) return 'ركوع'
        if (torso < 35 && hi) return 'قيام'
        if (torso < 45 && low) return 'جلوس'
        return '—'
      }
      pose.onResults((r) => {
        canvas.width = r.image.width; canvas.height = r.image.height
        ctx.save(); ctx.drawImage(r.image, 0, 0)
        if (r.poseLandmarks) {
          window.drawConnectors(ctx, r.poseLandmarks, window.POSE_CONNECTIONS, { color: 'rgba(72,185,162,.9)', lineWidth: 3 })
          window.drawLandmarks(ctx, r.poseLandmarks, { color: '#fff', radius: 2.5 })
          setPosture(classify(r.poseLandmarks))
        }
        ctx.restore()
      })
      const cam = new window.Camera(video, { onFrame: async () => { await pose.send({ image: video }) }, width: 480, height: 360 })
      cam.start()
    } catch (e) { /* camera unavailable */ }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{t.salahH1}</div><div className="h2">{t.salahH2}</div></div>
        <span className="ar-tag">صلاة</span>
      </div>
      <div className="feat-body">
        <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: '#05070a', aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          {!started && (
            <div style={{ position: 'relative', textAlign: 'center', padding: 26, color: 'var(--muted)' }}>
              <button className="btn" onClick={start}>{t.poseStart}</button>
              <p style={{ fontSize: 12.5, marginTop: 14, lineHeight: 1.6, maxWidth: '30ch' }}>{t.poseHint}</p>
            </div>
          )}
        </div>
        <div style={{ marginTop: 14, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 16 }}>
          <div className="ar" style={{ fontSize: 44, color: 'var(--gold)' }}>{posture}</div>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: 14 }}>{t.salahNote}</p>
      </div>
    </div>
  )
}
