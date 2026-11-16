import { useEffect, useRef, useState } from 'react'
import { OCR_BLOCK } from '../lib/ocrPrep'
import { readPhotoText } from '../lib/ocrRun'

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

export default function IngredientOCR({ lang = 'en', onResult }) {
  const m = MSG[lang] || MSG.en
  const [state, setState] = useState('idle') // idle | loading | reading | done | low | fail
  const [pct, setPct] = useState(0)
  const [conf, setConf] = useState(null)
  const [ocrLang, setOcrLang] = useState(lang === 'ar' ? 'eng+ara' : 'eng')
  const abortRef = useRef(null)

  // leaving the screen stops the OCR worker
  useEffect(() => () => abortRef.current?.abort(), [])

  async function run(file) {
    if (!file) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState('loading'); setPct(0); setConf(null)
    try {
      const best = await readPhotoText(file, {
        langs: ocrLang, psm: '6', // one uniform block of text
        signal: ctrl.signal,
        onProgress: (p) => { if (!ctrl.signal.aborted) { setState('reading'); setPct(p) } },
      })
      if (ctrl.signal.aborted) return
      setConf(best.conf)
      if (!best.text) { setState('fail'); onResult({ text: '', conf: 0 }); return }
      setState(best.conf < OCR_BLOCK ? 'low' : 'done')
      onResult({ text: best.text, conf: best.conf })
    } catch {
      if (!ctrl.signal.aborted) setState('fail')
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
