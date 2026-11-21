import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import data from '../content/surahs.json'
import { useKids, update } from '../store'
import { readSurah } from '../progress'
import { kidsText } from '../text'
import { BAND } from '../lib'
import { KTop, Noor, celebrate } from '../ui'
import { surahWords } from '../../components/WordByWord'
import { describeWord } from '../../lib/quranNlp'

const BY_N = Object.fromEntries(data.surahs.map((s) => [s.n, s]))

// Qur'an text is copied exactly from the app's Qur'an data (src/assets/quran.json); it is never read by a computer voice.
export default function KidsSurahs() {
  const { lang } = useApp()
  const { profile, progress } = useKids()
  const k = kidsText(lang), t = k.surahs
  const band = BAND[profile.band] ? profile.band : 'explorer'
  const list = data.bands[band].map((n) => BY_N[n])
  const [open, setOpen] = useState(null) // surah number
  const [ayah, setAyah] = useState(0)
  const [done, setDone] = useState(false)
  const [word, setWord] = useState(null) // index of the tapped word in this ayah

  if (!open) {
    return (
      <div className="k-screen">
        <KTop title={t.title} />
        <div className="k-scroll pad">
          <h2 className="k-h2">{t.pick}</h2>
          <div className="k-surah-list">
            {list.map((s) => (
              <button key={s.n} type="button" className={`k-surah${progress.surahsRead.includes(s.n) ? ' read' : ''}`} onClick={() => { setOpen(s.n); setAyah(0); setDone(false) }}>
                <span className="k-surah-n num">{s.n}</span>
                <span className="k-surah-t"><b>{s.tr}</b><small>{t.ayat(s.ayat.length)}</small></span>
                <span className="k-surah-ar" lang="ar">{s.ar}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const s = BY_N[open]
  const a = s.ayat[ayah]
  const last = ayah === s.ayat.length - 1
  const wbw = surahWords(s.n)?.ayat[ayah] // word by word, for the surahs that have it
  if (done) {
    return (
      <div className="k-screen">
        <KTop title={s.tr} />
        <div className="k-scroll pad k-center">
          <Noor size={110} wave />
          <h2 className="k-result">{t.done(s.tr)}</h2>
          <button type="button" className="k-btn" onClick={() => { setAyah(0); setDone(false) }}>{t.again}</button>
          <button type="button" className="k-btn ghost" onClick={() => setOpen(null)}>{t.more}</button>
        </div>
      </div>
    )
  }
  return (
    <div className="k-screen">
      <KTop title={s.tr} right={<span className="k-count num">{ayah + 1} / {s.ayat.length}</span>} />
      <div className="k-scroll pad">
        <div className="k-pbar" aria-hidden="true"><i style={{ width: `${((ayah + 1) / s.ayat.length) * 100}%` }} /></div>
        <div className="k-ayah-card">
          <div className="k-surah-name" lang="ar">سورة {s.ar}</div>
          {wbw ? (
            <p className="k-ayah" lang="ar" dir="rtl">
              {wbw.words.map((w, i) => (
                <button key={i} type="button" className={`k-word${word === i ? ' on' : ''}`} onClick={() => setWord(word === i ? null : i)} aria-pressed={word === i}>{w.ar}</button>
              ))} <span className="k-ayah-n">﴿{ayah + 1}﴾</span>
            </p>
          ) : <p className="k-ayah" lang="ar" dir="rtl">{a.ar} <span className="k-ayah-n">﴿{ayah + 1}﴾</span></p>}
          {wbw && word != null && wbw.words[word] && (
            <div className="k-word-info" role="status">
              <b lang="ar">{wbw.words[word].ar}</b>
              {lang !== 'ar' && <span className="k-word-tl">{wbw.words[word].tr}</span>}
              <span>{lang === 'ar' ? describeWord(wbw.words[word], 'ar').pos : wbw.words[word].en}</span>
              {band === 'young' && wbw.words[word].root && <small>{t.root}: <bdi lang="ar" dir="rtl">{wbw.words[word].root}</bdi></small>}
            </div>
          )}
          {wbw && word == null && <p className="k-word-hint">{t.tapWord}</p>}
          {BAND[band].translation && lang !== 'ar' && <p className="k-ayah-en">{a.en}</p>}
        </div>
        <div className="k-ayah-dots" aria-label={t.ayah(ayah + 1, s.ayat.length)}>
          {s.ayat.map((_, j) => <button key={j} type="button" className={j === ayah ? 'on' : j < ayah ? 'seen' : ''} onClick={() => { setAyah(j); setWord(null) }} aria-label={t.ayah(j + 1, s.ayat.length)} />)}
        </div>
      </div>
      <div className="k-foot two">
        <button type="button" className="k-btn ghost" onClick={() => { setWord(null); if (ayah) setAyah(ayah - 1); else setOpen(null) }}>{k.back}</button>
        <button type="button" className="k-btn" onClick={() => { setWord(null); if (!last) { setAyah(ayah + 1); return } celebrate(update(readSurah, s.n)); setDone(true) }}>{last ? t.finish : t.next}</button>
      </div>
    </div>
  )
}
