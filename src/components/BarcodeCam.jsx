import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'
import { parseScannedCode } from '../lib/scanCodes'

const MSG = {
  en: {
    open: 'Open camera', close: 'Close camera', starting: 'Starting camera…',
    hint: 'Point the camera at the barcode or QR code and hold steady.',
    qrLink: (h) => `This QR code is a link to a website (${h}), not a product code. We did not open it. Scan the product barcode, or paste the ingredients.`,
    qrOther: 'This QR code does not contain a product code. Scan the product barcode, or paste the ingredients.',
    denied: 'Camera permission was denied. Allow it in the browser settings, or type the code below.',
    nocam: 'No camera was found on this device. Type the code below.',
    busy: 'The camera is in use by another app. Close it and try again.',
    insecure: 'The camera needs a secure (HTTPS) page. Type the code below.',
    error: 'Could not start the camera. Type the code below.',
  },
  ar: {
    open: 'افتح الكاميرا', close: 'اقفل الكاميرا', starting: 'جارٍ تشغيل الكاميرا…',
    hint: 'وجّه الكاميرا للباركود أو كود QR وثبّتها.',
    qrLink: (h) => `كود QR ده رابط لموقع (${h}) وليس كود منتج. ما فتحناهوش. امسح باركود المنتج أو الصق المكونات.`,
    qrOther: 'كود QR ده مفيهوش كود منتج. امسح باركود المنتج أو الصق المكونات.',
    denied: 'تم رفض إذن الكاميرا. اسمح بها من إعدادات المتصفح، أو اكتب الرقم بالأسفل.',
    nocam: 'مفيش كاميرا على الجهاز ده. اكتب الرقم بالأسفل.',
    busy: 'الكاميرا مستخدمة في تطبيق تاني. اقفله وجرّب تاني.',
    insecure: 'الكاميرا بتحتاج صفحة آمنة (HTTPS). اكتب الرقم بالأسفل.',
    error: 'تعذّر تشغيل الكاميرا. اكتب الرقم بالأسفل.',
  },
}

const hints = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.QR_CODE]],
  [DecodeHintType.TRY_HARDER, true],
])

export default function BarcodeCam({ lang = 'en', onCode }) {
  const m = MSG[lang] || MSG.en
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const lastRef = useRef({ code: '', n: 0 })
  const [state, setState] = useState('idle') // idle | starting | scanning | error key
  const [note, setNote] = useState('') // shown when a QR code is not a product code

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
    setState('starting'); setNote('')
    try {
      const reader = new BrowserMultiFormatReader(hints)
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current,
        (result) => {
          if (!result) return
          const isQr = result.getBarcodeFormat() === BarcodeFormat.QR_CODE
          const p = parseScannedCode(result.getText())
          // 1D barcodes that are not a valid product code are misreads: ignore silently
          if (!isQr && p.kind !== 'gtin') return
          // the same content must be read twice in a row before we trust it
          const key = p.kind === 'gtin' ? p.gtin : `${p.kind}:${p.host || ''}`
          const last = lastRef.current
          last.n = last.code === key ? last.n + 1 : 1
          last.code = key
          if (last.n < 2) return
          stop(); setState('idle')
          if (p.kind === 'gtin') onCode(p.gtin)
          else setNote(p.kind === 'url' ? m.qrLink(p.host) : m.qrOther) // links are shown as text only, never opened
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
      {note && <p className="cam-note err">{note}</p>}
      {m[state] && !active && state !== 'idle' && <p className="cam-note err">{m[state]}</p>}
      <button className="btn block" onClick={active ? () => { stop(); setState('idle') } : start}>
        {active ? m.close : m.open}
      </button>
    </div>
  )
}
