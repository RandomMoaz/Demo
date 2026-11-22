import { useMemo, useState } from 'react'
import data from '../data/quranNlp.json'
import { describeWord, searchWords, sameRoot, surahStats } from '../lib/quranNlp'

export const hasWordByWord = (n) => data.surahs.some((s) => s.n === n)
export const surahWords = (n) => data.surahs.find((s) => s.n === n)

const T = {
  en: { toggle: 'Word by word', search: 'Search a word, root or meaning', none: 'No word matches in these three surahs.', hint: 'Tap a word to see how it is built.',
    ayat: 'ayat', words: 'words', roots: 'roots', letters: 'letters', top: (r, n) => `Most common root here: ${r} — ${n}× in the Qur’an`,
    parts: 'How it is built', root: 'Root', rootCount: (n) => `appears in ${n} words of the Qur’an`, forms: 'Words from this root', lemma: 'Dictionary form', times: (n) => `${n}×`,
    here: 'Same root in these surahs', why: { word: 'word', root: 'root', meaning: 'meaning' }, appGloss: 'meaning added by this app', close: 'Close', source: 'Word analysis: QURAN-NLP · Quranic Arabic Corpus' },
  ar: { toggle: 'كلمة كلمة', search: 'ابحث عن كلمة أو جذر أو معنى', none: 'لا توجد كلمة مطابقة في هذه السور الثلاث.', hint: 'اضغط على كلمة لترى بناءها.',
    ayat: 'آيات', words: 'كلمة', roots: 'جذرًا', letters: 'حرفًا', top: (r, n) => `أكثر جذر هنا: ${r} — ${n} مرة في القرآن`,
    parts: 'بناء الكلمة', root: 'الجذر', rootCount: (n) => `ورد في ${n} كلمة في القرآن`, forms: 'كلمات من هذا الجذر', lemma: 'الأصل المعجمي', times: (n) => `${n} مرة`,
    here: 'من الجذر نفسه في هذه السور', why: { word: 'كلمة', root: 'جذر', meaning: 'معنى' }, appGloss: 'معنى أضافه التطبيق', close: 'إغلاق', source: 'تحليل الكلمات: QURAN-NLP · المدوّنة القرآنية العربية' },
  de: { toggle: 'Wort für Wort', search: 'Wort, Wurzel oder Bedeutung suchen', none: 'Kein Treffer in diesen drei Suren.', hint: 'Tippe auf ein Wort, um seinen Aufbau zu sehen.',
    ayat: 'Verse', words: 'Wörter', roots: 'Wurzeln', letters: 'Buchstaben', top: (r, n) => `Häufigste Wurzel hier: ${r} — ${n}× im Koran`,
    parts: 'Aufbau', root: 'Wurzel', rootCount: (n) => `kommt in ${n} Wörtern des Korans vor`, forms: 'Wörter aus dieser Wurzel', lemma: 'Grundform', times: (n) => `${n}×`,
    here: 'Gleiche Wurzel in diesen Suren', why: { word: 'Wort', root: 'Wurzel', meaning: 'Bedeutung' }, appGloss: 'Bedeutung von der App ergänzt', close: 'Schließen', source: 'Wortanalyse: QURAN-NLP · Quranic Arabic Corpus' },
  fr: { toggle: 'Mot à mot', search: 'Chercher un mot, une racine ou un sens', none: 'Aucun mot trouvé dans ces trois sourates.', hint: 'Touchez un mot pour voir comment il est construit.',
    ayat: 'versets', words: 'mots', roots: 'racines', letters: 'lettres', top: (r, n) => `Racine la plus fréquente ici : ${r} — ${n}× dans le Coran`,
    parts: 'Construction', root: 'Racine', rootCount: (n) => `présente dans ${n} mots du Coran`, forms: 'Mots de cette racine', lemma: 'Forme de base', times: (n) => `${n}×`,
    here: 'Même racine dans ces sourates', why: { word: 'mot', root: 'racine', meaning: 'sens' }, appGloss: 'sens ajouté par l’app', close: 'Fermer', source: 'Analyse des mots : QURAN-NLP · Quranic Arabic Corpus' },
  es: { toggle: 'Palabra por palabra', search: 'Busca una palabra, raíz o significado', none: 'Ninguna palabra coincide en estas tres suras.', hint: 'Toca una palabra para ver cómo se forma.',
    ayat: 'aleyas', words: 'palabras', roots: 'raíces', letters: 'letras', top: (r, n) => `Raíz más común aquí: ${r} — ${n}× en el Corán`,
    parts: 'Cómo se forma', root: 'Raíz', rootCount: (n) => `aparece en ${n} palabras del Corán`, forms: 'Palabras de esta raíz', lemma: 'Forma de diccionario', times: (n) => `${n}×`,
    here: 'Misma raíz en estas suras', why: { word: 'palabra', root: 'raíz', meaning: 'significado' }, appGloss: 'significado añadido por la app', close: 'Cerrar', source: 'Análisis de palabras: QURAN-NLP · Quranic Arabic Corpus' },
  ja: { toggle: '単語ごと', search: '単語・語根・意味で検索', none: 'この3つのスーラに一致する単語はありません。', hint: '単語をタップすると成り立ちがわかります。',
    ayat: '節', words: '語', roots: '語根', letters: '文字', top: (r, n) => `ここで最も多い語根: ${r} — クルアーン全体で${n}回`,
    parts: '単語の成り立ち', root: '語根', rootCount: (n) => `クルアーンの${n}語に出てきます`, forms: 'この語根の単語', lemma: '辞書形', times: (n) => `${n}回`,
    here: 'これらのスーラの同じ語根', why: { word: '単語', root: '語根', meaning: '意味' }, appGloss: 'アプリが補った意味', close: '閉じる', source: '単語分析: QURAN-NLP · Quranic Arabic Corpus' },
}
export const wbwText = (lang) => T[lang] || T.en

const key = (h) => `${h.s}:${h.a}:${h.i}`

function WordPanel({ hit, lang, t, onPick, onClose }) {
  const w = hit.word
  const d = describeWord(w, lang)
  const root = w.root ? data.roots[w.root] : null
  const family = sameRoot(data, w.root).filter((h) => key(h) !== key(hit))
  return (
    <div className="wbw-panel" role="region" aria-label={w.ar}>
      <button type="button" className="wbw-close" onClick={onClose} aria-label={t.close}>×</button>
      <div className="wbw-big" lang="ar" dir="rtl">{w.ar}</div>
      <div className="wbw-tr">{w.tr} · <span>{w.en}</span>{w.gloss === 'app' && <small> ({t.appGloss})</small>}</div>
      <div className="wbw-pos"><b>{d.pos}</b>{d.grammar.length > 0 && <span> · {d.grammar.join(' · ')}</span>}</div>

      <h4>{t.parts}</h4>
      <div className="wbw-parts" dir="rtl">
        {d.parts.map((p, i) => (
          <div key={i} className={`wbw-part k-${w.segs[i].kind}`}>
            <span lang="ar">{p.ar}</span>
            <small dir="auto">{p.role}</small>
          </div>
        ))}
      </div>

      {root && (
        <>
          <h4>{t.root}</h4>
          <div className="wbw-root"><b lang="ar" dir="rtl">{w.root}</b><span>{t.rootCount(root.count)}</span></div>
          <div className="wbw-forms">
            <small>{t.forms}</small>
            {root.lemmas.map((l) => <span key={l.ar}><b lang="ar">{l.ar}</b> {t.times(l.count)}</span>)}
          </div>
        </>
      )}
      {w.lemma && <div className="wbw-lemma"><small>{t.lemma}</small> <b lang="ar">{w.lemma}</b> {t.times(w.lemmaCount)}</div>}

      {family.length > 0 && (
        <>
          <h4>{t.here}</h4>
          <div className="wbw-family">
            {family.map((h) => <button key={key(h)} type="button" lang="ar" onClick={() => onPick(h)}>{h.word.ar} <small className="latin">{h.s}:{h.a}</small></button>)}
          </div>
        </>
      )}
    </div>
  )
}

/** Word-by-word study of one surah: overview, search, every word tappable, and the word panel. */
export default function WordByWord({ surah, lang, fontSize = 26 }) {
  const t = wbwText(lang)
  const su = surahWords(surah)
  const stats = useMemo(() => surahStats(data, surah), [surah])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const hits = useMemo(() => searchWords(data, q), [q])
  const hitKeys = new Set(hits.map(key))
  if (!su) return null
  const pick = (h) => { setSel(h); setQ('') }

  return (
    <div className="wbw" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="wbw-stats">
        <span><b className="latin">{stats.ayat}</b> {t.ayat}</span>
        <span><b className="latin">{stats.words}</b> {t.words}</span>
        <span><b className="latin">{stats.roots}</b> {t.roots}</span>
        <span><b className="latin">{stats.letters}</b> {t.letters}</span>
        {/* RLI…PDI keeps the Arabic root from reordering the sentence around it */}
        {stats.top && <p>{t.top(`⁧${stats.top.root}⁩`, stats.top.count)}</p>}
      </div>

      <input className="wbw-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} dir="auto" />
      {q.trim() && (
        <div className="wbw-hits" role="list">
          {!hits.length && <p className="wbw-none">{t.none}</p>}
          {hits.map((h) => (
            <button key={key(h)} type="button" role="listitem" onClick={() => pick(h)}>
              <b lang="ar">{h.word.ar}</b> <span className="latin">{h.s}:{h.a}</span> <small>{t.why[h.why]} · {h.word.en}</small>
            </button>
          ))}
        </div>
      )}

      {!sel && <p className="wbw-hint">{t.hint}</p>}
      {su.ayat.map((ay) => (
        <div key={ay.n} className="wbw-ayah">
          <div className="wbw-row" dir="rtl">
            {ay.words.map((w, i) => {
              const h = { s: surah, a: ay.n, i, word: w }
              const on = sel && key(sel) === key(h)
              return (
                <button key={i} type="button" className={`wbw-word${on ? ' on' : ''}${hitKeys.has(key(h)) ? ' hit' : ''}`} onClick={() => setSel(on ? null : h)} aria-pressed={!!on}>
                  <span className="wbw-ar" lang="ar" style={{ fontSize }}>{w.ar}</span>
                  {lang === 'ar' ? <small>{describeWord(w, 'ar').pos}</small> : <><small className="wbw-tl">{w.tr}</small><small>{w.en}</small></>}
                </button>
              )
            })}
            <span className="wbw-num latin">{ay.n}</span>
          </div>
          {sel && sel.s === surah && sel.a === ay.n && <WordPanel hit={sel} lang={lang} t={t} onPick={setSel} onClose={() => setSel(null)} />}
        </div>
      ))}
      {sel && sel.s !== surah && <WordPanel hit={sel} lang={lang} t={t} onPick={setSel} onClose={() => setSel(null)} />}

      <p className="wbw-source">
        <a href={data.source.repo} target="_blank" rel="noopener noreferrer">QURAN-NLP</a> ·{' '}
        <a href={data.source.corpus} target="_blank" rel="noopener noreferrer">Quranic Arabic Corpus</a> — {t.source.split(':')[0]}
      </p>
    </div>
  )
}
