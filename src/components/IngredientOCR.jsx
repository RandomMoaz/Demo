import { useEffect, useRef, useState } from 'react'

const MSG = {
  en: {
    pick: 'Take or choose a photo', hint: 'Photograph the ingredients list: flat, well lit, text filling the frame.',
    loading: 'Loading the text reader (first time only)…', reading: 'Reading', fail: 'Could not read the image. Try a clearer photo, or type the ingredients.',
    done: 'Check the text below and fix any mistakes before analyzing.', low: 'The reading looks unreliable. Retake the photo or correct the text.',
  },
  ar: {
    pick: 'صوّر أو اختر صورة', hint: 'صوّر قائمة المكونات: مسطّحة، وإضاءة جيدة، والنص يملأ الإطار.',
    loading: 'جارٍ تحميل قارئ النصوص (أول مرة فقط)…', reading: 'جارٍ القراءة', fail: 'تعذّرت قراءة الصورة. جرّب صورة أوضح أو اكتب المكونات.',
    done: 'راجع النص بالأسفل وصحّح أي أخطاء قبل التحليل.', low: 'القراءة غير موثوقة. أعد التصوير أو صحّح النص.',
  },
}

/* Downscale/upscale, grayscale and stretch contrast: helps Tesseract on phone photos. */
async function prepare(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const scale = Math.min(2, 2000 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < d.data.length; i += 4) {
      const g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]
      const c = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128))
      d.data[i] = d.data[i + 1] = d.data[i + 2] = c
    }
    ctx.putImageData(d, 0, 0)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function IngredientOCR({ lang = 'en', onResult }) {
  const m = MSG[lang] || MSG.en
  const [state, setState] = useState('idle') // idle | loading | reading | done | fail
  const [pct, setPct] = useState(0)
  const [conf, setConf] = useState(null)
  const alive = useRef(true)
  const workerRef = useRef(null)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; workerRef.current?.terminate().catch(() => {}) }
  }, [])

  async function run(file) {
    if (!file) return
    setState('loading'); setPct(0); setConf(null)
    try {
      const canvas = await prepare(file)
      // loaded on demand so the OCR engine is not part of the main bundle
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng+ara', 1, {
        logger: (p) => { if (alive.current && p.status === 'recognizing text') { setState('reading'); setPct(Math.round(p.progress * 100)) } },
      })
      workerRef.current = worker
      const { data } = await worker.recognize(canvas)
      await worker.terminate()
      workerRef.current = null
      if (!alive.current) return
      const text = data.text.replace(/-\s*\n\s*/g, '').replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
      const c = Math.round(data.confidence)
      setConf(c); setState('done')
      onResult({ text, conf: c })
    } catch {
      workerRef.current?.terminate().catch(() => {}); workerRef.current = null
      if (alive.current) setState('fail')
    }
  }

  const busy = state === 'loading' || state === 'reading'
  return (
    <div className="cam">
      <p className="cam-note">{m.hint}</p>
      <label className={`btn block${busy ? ' disabled' : ''}`}>
        {m.pick}
        <input type="file" accept="image/*" hidden disabled={busy}
          onChange={(e) => { run(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {busy && (
        <p className="cam-note">
          {state === 'loading' ? m.loading : `${m.reading} ${pct}%`}
          <span className="ocr-bar"><i style={{ width: `${state === 'loading' ? 5 : pct}%` }} /></span>
        </p>
      )}
      {state === 'fail' && <p className="cam-note err">{m.fail}</p>}
      {state === 'done' && <p className={`cam-note${conf < 70 ? ' err' : ''}`}>{conf < 70 ? m.low : m.done} ({conf}%)</p>}
    </div>
  )
}
