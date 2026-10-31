import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'

/* GTIN check digit (EAN-8 / UPC-A / EAN-13). Rejects misreads before any network call. */
export function validGtin(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false
  const d = code.split('').map(Number)
  const check = d.pop()
  let sum = 0
  for (let i = d.length - 1, w = 3; i >= 0; i--, w = 4 - w) sum += d[i] * w
  return (10 - (sum % 10)) % 10 === check
}

const MSG = {
  en: {
    open: 'Open camera', close: 'Close camera', starting: 'Starting camera…',
    hint: 'Point the camera at the barcode and hold steady.',
    denied: 'Camera permission was denied. Allow it in the browser settings, or type the code below.',
    nocam: 'No camera was found on this device. Type the code below.',
    busy: 'The camera is in use by another app. Close it and try again.',
    insecure: 'The camera needs a secure (HTTPS) page. Type the code below.',
    error: 'Could not start the camera. Type the code below.',
  },
  ar: {
    open: 'افتح الكاميرا', close: 'اقفل الكاميرا', starting: 'جارٍ تشغيل الكاميرا…',
    hint: 'وجّه الكاميرا للباركود وثبّتها.',
    denied: 'تم رفض إذن الكاميرا. اسمح بها من إعدادات المتصفح، أو اكتب الرقم بالأسفل.',
    nocam: 'مفيش كاميرا على الجهاز ده. اكتب الرقم بالأسفل.',
    busy: 'الكاميرا مستخدمة في تطبيق تاني. اقفله وجرّب تاني.',
    insecure: 'الكاميرا بتحتاج صفحة آمنة (HTTPS). اكتب الرقم بالأسفل.',
    error: 'تعذّر تشغيل الكاميرا. اكتب الرقم بالأسفل.',
  },
}

const hints = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]],
  [DecodeHintType.TRY_HARDER, true],
])

export default function BarcodeCam({ lang = 'en', onCode }) {
  const m = MSG[lang] || MSG.en
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const lastRef = useRef({ code: '', n: 0 })
  const [state, setState] = useState('idle') // idle | starting | scanning | error key

  const stop = useCallback(() => {
    try { controlsRef.current?.stop() } catch { /* already stopped */ }
    controlsRef.current = null
    const v = videoRef.current
    if (v?.srcObject) { v.srcObject.getTracks().forEach((t) => t.stop()); v.srcObject = null }
    lastRef.current = { code: '', n: 0 }
  }, [])

  const start = useCallback(async () => {
    if (!window.isSecureContext) return setState('insecure')
    if (!navigator.mediaDevices?.getUserMedia) return setState('nocam')
    setState('starting')
    try {
      const reader = new BrowserMultiFormatReader(hints)
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current,
        (result) => {
          if (!result) return
          const code = result.getText()
          if (!validGtin(code)) return
          // the same valid code must be read twice in a row before we trust it
          const last = lastRef.current
          last.n = last.code === code ? last.n + 1 : 1
          last.code = code
          if (last.n >= 2) { stop(); setState('idle'); onCode(code) }
        }
      )
      setState('scanning')
    } catch (e) {
      stop()
      const n = e?.name
      setState(n === 'NotAllowedError' || n === 'SecurityError' ? 'denied'
        : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'nocam'
        : n === 'NotReadableError' ? 'busy' : 'error')
    }
  }, [onCode, stop])

  useEffect(() => stop, [stop]) // release the camera when leaving the screen

  const active = state === 'starting' || state === 'scanning'
  return (
    <div className="cam">
      {/* playsInline + muted are required for iOS Safari */}
      <div className="cam-view" style={{ display: active ? 'block' : 'none' }}>
        <video ref={videoRef} playsInline muted autoPlay />
        <div className="cam-frame"><i /></div>
      </div>
      {state === 'starting' && <p className="cam-note">{m.starting}</p>}
      {state === 'scanning' && <p className="cam-note">{m.hint}</p>}
      {m[state] && !active && state !== 'idle' && <p className="cam-note err">{m[state]}</p>}
      <button className="btn block" onClick={active ? () => { stop(); setState('idle') } : start}>
        {active ? m.close : m.open}
      </button>
    </div>
  )
}
