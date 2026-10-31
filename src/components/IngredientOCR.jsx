import { useEffect, useRef, useState } from 'react'
import { binarize, readResult, OCR_BLOCK } from '../lib/ocrPrep'

// three preprocessing settings; the most reliable read wins (measured best-of beat any single setting)
const PASSES = [{ k: 0.8, div: 60 }, { k: 0.88, div: 30 }, { k: 0.7, div: 90 }]
const GOOD_ENOUGH = 85 // stop early when a pass is already this reliable

const MSG = {
  en: {
    pick: 'Take or choose a photo', hint: 'Photograph only the ingredients list: flat, well lit, text filling the frame, no glare.',
    loading: 'Loading the text reader (first time only)…', reading: 'Reading',
    fail: 'Could not read any reliable text. Retake the photo closer and flatter, pick the right language, or type the ingredients.',
    done: 'Check the text below and fix any mistakes before analyzing.',
    low: 'The reading is not reliable enough to analyze. Retake the photo, change the language, or type the ingredients.',
    langs: { eng: 'English', ara: 'Arabic', 'eng+ara': 'Both' }, langLabel: 'Label language',
  },
  ar: {
    pick: 'صوّر أو اختر صورة', hint: 'صوّر قائمة المكونات فقط: مسطّحة، وإضاءة جيدة، والنص يملأ الإطار، من غير انعكاس.',
    loading: 'جارٍ تحميل قارئ النصوص (أول مرة فقط)…', reading: 'جارٍ القراءة',
    fail: 'ماقدرتش أقرا نص موثوق. صوّر أقرب وأكثر استواءً، أو اختر اللغة الصح، أو اكتب المكونات.',
    done: 'راجع النص بالأسفل وصحّح أي أخطاء قبل التحليل.',
    low: 'القراءة مش موثوقة كفاية للتحليل. أعد التصوير أو غيّر اللغة أو اكتب المكونات.',
    langs: { eng: 'إنجليزي', ara: 'عربي', 'eng+ara': 'الاتنين' }, langLabel: 'لغة الملصق',
  },
}

/* Scale to ~2000px and return the raw pixels; each pass then thresholds its own copy. */
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
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    return { w, h, data: ctx.getImageData(0, 0, w, h).data }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function pass({ w, h, data }, opt) {
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  const img = new ImageData(new Uint8ClampedArray(data), w, h)
  binarize(img.data, w, h, opt)
  ctx.putImageData(img, 0, 0)
  return canvas
}

export default function IngredientOCR({ lang = 'en', onResult }) {
  const m = MSG[lang] || MSG.en
  const [state, setState] = useState('idle') // idle | loading | reading | done | low | fail
  const [pct, setPct] = useState(0)
  const [conf, setConf] = useState(null)
  const [ocrLang, setOcrLang] = useState(lang === 'ar' ? 'eng+ara' : 'eng')
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
      const base = await prepare(file)
      // loaded on demand so the OCR engine is not part of the main bundle
      const { createWorker } = await import('tesseract.js')
      let n = 0
      const worker = await createWorker(ocrLang, 1, {
        logger: (p) => {
          if (alive.current && p.status === 'recognizing text') { setState('reading'); setPct(Math.round(((n + p.progress) / PASSES.length) * 100)) }
        },
      })
      workerRef.current = worker
      await worker.setParameters({ tessedit_pageseg_mode: '6' }) // one uniform block of text
      let best = null
      for (; n < PASSES.length; n++) {
        const { data } = await worker.recognize(pass(base, PASSES[n]), {}, { text: true, blocks: true })
        const lines = (data.blocks || []).flatMap((b) => b.paragraphs.flatMap((q) => q.lines.map((l) => l.words)))
        const r = readResult(lines, data.text) // full text + mean word confidence
        if (!best || r.conf > best.conf) best = r
        if (best.conf >= GOOD_ENOUGH || !alive.current) break
      }
      await worker.terminate()
      workerRef.current = null
      if (!alive.current) return
      setConf(best.conf)
      if (!best.text) { setState('fail'); onResult({ text: '', conf: 0 }); return }
      setState(best.conf < OCR_BLOCK ? 'low' : 'done')
      onResult({ text: best.text, conf: best.conf })
    } catch {
      workerRef.current?.terminate().catch(() => {}); workerRef.current = null
      if (alive.current) setState('fail')
    }
  }

  const busy = state === 'loading' || state === 'reading'
  return (
    <div className="cam">
      <p className="cam-note">{m.hint}</p>
      <div className="ocr-langs" role="group" aria-label={m.langLabel}>
        {Object.entries(m.langs).map(([k, label]) => (
          <button key={k} type="button" className={ocrLang === k ? 'on' : ''} disabled={busy} onClick={() => setOcrLang(k)}>{label}</button>
        ))}
      </div>
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
      {state === 'low' && <p className="cam-note err">{m.low} ({conf}%)</p>}
      {state === 'done' && <p className="cam-note">{m.done} ({conf}%)</p>}
    </div>
  )
}
