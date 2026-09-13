import { useApp } from '../context/AppContext'
import Aurora from '../components/reactbits/Aurora'
import SplitText from '../components/reactbits/SplitText'
import ShinyText from '../components/reactbits/ShinyText'
import { Anim } from '../components/Lottie'
import { LANGS } from '../lib/data'

/* ---------- site copy, per language ---------- */
const SITE = {
  en: {
    dir: 'ltr',
    nav: { features: 'Features', how: 'How it works', app: 'The app', open: 'Open the app' },
    pill: 'For new Muslims',
    title1: 'Your first steps,', title2: 'made simple.',
    lead: 'Learn how to pray, read the Qur’an, find a mosque and build daily habits — in your own language, at your own pace.',
    start: 'Start your journey', see: 'See what’s inside',
    fEyebrow: 'Everything in one place', fTitle: 'Built around a Muslim’s day',
    fLead: 'From your first wudu to your daily Qur’an portion — the app adapts to whether you’re new, practising, or a child learning.',
    open: 'Open',
    hEyebrow: 'How it works', hTitle: 'Three steps to begin',
    steps: [
      ['Choose your language', 'Six languages including Arabic and Japanese. Prayers stay in Arabic — the explanation is yours.'],
      ['Tell us who’s learning', 'New Muslim, adult, or child. Lessons, tools and tone adapt to the profile you pick.'],
      ['Build your journey', 'Daily quests, streaks and the reward of each deed — saved on your device, no account needed.'],
    ],
    ctaTitle: 'Use it on the web today',
    ctaLead: 'Works in any browser, on any phone or laptop — nothing to install. A native mobile app is on the way.',
    ctaBtn: 'Open the app', soon: '📱 iOS & Android — coming soon',
    foot: 'Graduation project · Map data © OpenStreetMap contributors',
    features: [
      { k: 'salah', ic: '🧎', ar: 'صلاة', t: 'Learn to pray', d: 'Step-by-step salah with live camera feedback that checks your positions and their order.' },
      { k: 'mushaf', ic: '📗', ar: 'مصحف', t: 'Read the Qur’an', d: 'A golden mushaf with Uthmani script and all 114 surahs available offline.' },
      { k: 'rashed', ic: '💬', ar: 'راشد', t: 'Ask Rashed', d: 'Your questions answered from trusted scholars’ sites — always with the original links.' },
      { k: 'scanner', ic: '🔎', ar: 'حلال', t: 'Halal scanner', d: 'Scan a barcode or ingredients list; it flags haram and doubtful items and explains why.' },
      { k: 'map', ic: '🗺️', ar: 'مساجد', t: 'Mosques near you', d: 'Find prayer spaces and halal food around you, powered by OpenStreetMap.' },
      { k: 'tasbih', ic: '📿', ar: 'سبحة', t: 'Tasbih & journey', d: 'A dhikr counter, daily quests, streaks and the reward of every deed you complete.' },
    ],
  },
  de: {
    dir: 'ltr',
    nav: { features: 'Funktionen', how: 'So funktioniert’s', app: 'Die App', open: 'App öffnen' },
    pill: 'Für neue Muslime',
    title1: 'Deine ersten Schritte,', title2: 'ganz einfach.',
    lead: 'Lerne zu beten, den Koran zu lesen, eine Moschee zu finden und tägliche Gewohnheiten aufzubauen — in deiner Sprache, in deinem Tempo.',
    start: 'Beginne deine Reise', see: 'Sieh, was drinsteckt',
    fEyebrow: 'Alles an einem Ort', fTitle: 'Rund um den Tag eines Muslims gebaut',
    fLead: 'Vom ersten Wudu bis zum täglichen Koranabschnitt — die App passt sich an, ob du neu bist, praktizierst oder ein Kind bist, das lernt.',
    open: 'Öffnen',
    hEyebrow: 'So funktioniert’s', hTitle: 'Drei Schritte zum Anfang',
    steps: [
      ['Wähle deine Sprache', 'Sechs Sprachen, darunter Arabisch und Japanisch. Die Gebete bleiben arabisch — die Erklärung gehört dir.'],
      ['Sag uns, wer lernt', 'Neuer Muslim, Erwachsener oder Kind. Lektionen, Werkzeuge und Tonfall passen sich dem gewählten Profil an.'],
      ['Baue deine Reise', 'Tägliche Aufgaben, Serien und der Lohn jeder Tat — auf deinem Gerät gespeichert, ganz ohne Konto.'],
    ],
    ctaTitle: 'Nutze es heute im Web',
    ctaLead: 'Läuft in jedem Browser, auf jedem Handy oder Laptop — nichts zu installieren. Eine native Mobile-App ist unterwegs.',
    ctaBtn: 'App öffnen', soon: '📱 iOS & Android — bald verfügbar',
    foot: 'Abschlussprojekt · Kartendaten © OpenStreetMap-Mitwirkende',
    features: [
      { k: 'salah', ic: '🧎', ar: 'صلاة', t: 'Beten lernen', d: 'Schritt-für-Schritt-Gebet mit Live-Kamera-Feedback, das deine Positionen und ihre Reihenfolge prüft.' },
      { k: 'mushaf', ic: '📗', ar: 'مصحف', t: 'Den Koran lesen', d: 'Ein goldener Mushaf in Uthmani-Schrift, alle 114 Suren offline verfügbar.' },
      { k: 'rashed', ic: '💬', ar: 'راشد', t: 'Frag Rashed', d: 'Antworten auf deine Fragen von vertrauenswürdigen Gelehrtenseiten — immer mit den Originallinks.' },
      { k: 'scanner', ic: '🔎', ar: 'حلال', t: 'Halal-Scanner', d: 'Scanne einen Barcode oder die Zutatenliste; die App markiert Haram und Zweifelhaftes und erklärt warum.' },
      { k: 'map', ic: '🗺️', ar: 'مساجد', t: 'Moscheen in der Nähe', d: 'Finde Gebetsräume und Halal-Essen um dich herum, auf Basis von OpenStreetMap.' },
      { k: 'tasbih', ic: '📿', ar: 'سبحة', t: 'Tasbih & Reise', d: 'Ein Dhikr-Zähler, tägliche Aufgaben, Serien und der Lohn jeder Tat, die du vollbringst.' },
    ],
  },
  fr: {
    dir: 'ltr',
    nav: { features: 'Fonctions', how: 'Comment ça marche', app: 'L’application', open: 'Ouvrir l’app' },
    pill: 'Pour les nouveaux musulmans',
    title1: 'Vos premiers pas,', title2: 'en toute simplicité.',
    lead: 'Apprenez à prier, lisez le Coran, trouvez une mosquée et installez des habitudes quotidiennes — dans votre langue, à votre rythme.',
    start: 'Commencez votre parcours', see: 'Voir ce qu’il y a dedans',
    fEyebrow: 'Tout au même endroit', fTitle: 'Pensée autour de la journée d’un musulman',
    fLead: 'De votre premier wudu à votre portion quotidienne du Coran — l’app s’adapte, que vous soyez nouveau, pratiquant, ou un enfant qui apprend.',
    open: 'Ouvrir',
    hEyebrow: 'Comment ça marche', hTitle: 'Trois étapes pour commencer',
    steps: [
      ['Choisissez votre langue', 'Six langues, dont l’arabe et le japonais. Les prières restent en arabe — l’explication est à vous.'],
      ['Dites-nous qui apprend', 'Nouveau musulman, adulte ou enfant. Les leçons, les outils et le ton s’adaptent au profil choisi.'],
      ['Construisez votre parcours', 'Quêtes quotidiennes, séries et la récompense de chaque acte — enregistrés sur votre appareil, sans compte.'],
    ],
    ctaTitle: 'Utilisez-le sur le web dès aujourd’hui',
    ctaLead: 'Fonctionne dans n’importe quel navigateur, sur téléphone ou ordinateur — rien à installer. Une application mobile native arrive bientôt.',
    ctaBtn: 'Ouvrir l’app', soon: '📱 iOS et Android — bientôt',
    foot: 'Projet de fin d’études · Données cartographiques © les contributeurs OpenStreetMap',
    features: [
      { k: 'salah', ic: '🧎', ar: 'صلاة', t: 'Apprendre à prier', d: 'La prière pas à pas, avec un retour caméra en direct qui vérifie vos positions et leur ordre.' },
      { k: 'mushaf', ic: '📗', ar: 'مصحف', t: 'Lire le Coran', d: 'Un mushaf doré en graphie uthmanienne, les 114 sourates disponibles hors ligne.' },
      { k: 'rashed', ic: '💬', ar: 'راشد', t: 'Demander à Rashed', d: 'Vos questions trouvent réponse sur les sites de savants de confiance — toujours avec les liens d’origine.' },
      { k: 'scanner', ic: '🔎', ar: 'حلال', t: 'Scanner halal', d: 'Scannez un code-barres ou une liste d’ingrédients ; l’app signale le haram et le douteux, et explique pourquoi.' },
      { k: 'map', ic: '🗺️', ar: 'مساجد', t: 'Mosquées près de vous', d: 'Trouvez des lieux de prière et de la nourriture halal autour de vous, grâce à OpenStreetMap.' },
      { k: 'tasbih', ic: '📿', ar: 'سبحة', t: 'Tasbih et parcours', d: 'Un compteur de dhikr, des quêtes quotidiennes, des séries et la récompense de chaque acte accompli.' },
    ],
  },
  es: {
    dir: 'ltr',
    nav: { features: 'Funciones', how: 'Cómo funciona', app: 'La app', open: 'Abrir la app' },
    pill: 'Para nuevos musulmanes',
    title1: 'Tus primeros pasos,', title2: 'con sencillez.',
    lead: 'Aprende a rezar, lee el Corán, encuentra una mezquita y crea hábitos diarios: en tu idioma y a tu ritmo.',
    start: 'Empieza tu camino', see: 'Mira lo que hay dentro',
    fEyebrow: 'Todo en un solo lugar', fTitle: 'Construida en torno al día de un musulmán',
    fLead: 'Desde tu primer wudu hasta tu porción diaria del Corán: la app se adapta a si eres nuevo, practicante o un niño que aprende.',
    open: 'Abrir',
    hEyebrow: 'Cómo funciona', hTitle: 'Tres pasos para empezar',
    steps: [
      ['Elige tu idioma', 'Seis idiomas, incluidos el árabe y el japonés. Las oraciones siguen en árabe; la explicación es tuya.'],
      ['Dinos quién aprende', 'Nuevo musulmán, adulto o niño. Las lecciones, las herramientas y el tono se adaptan al perfil que elijas.'],
      ['Construye tu camino', 'Misiones diarias, rachas y la recompensa de cada acto, guardadas en tu dispositivo y sin cuenta.'],
    ],
    ctaTitle: 'Úsala hoy en la web',
    ctaLead: 'Funciona en cualquier navegador, en cualquier móvil u ordenador: nada que instalar. La app móvil nativa está en camino.',
    ctaBtn: 'Abrir la app', soon: '📱 iOS y Android — muy pronto',
    foot: 'Proyecto de fin de carrera · Datos de mapas © colaboradores de OpenStreetMap',
    features: [
      { k: 'salah', ic: '🧎', ar: 'صلاة', t: 'Aprender a rezar', d: 'La oración paso a paso, con la cámara comprobando en directo tus posiciones y su orden.' },
      { k: 'mushaf', ic: '📗', ar: 'مصحف', t: 'Leer el Corán', d: 'Un mushaf dorado con grafía uthmaní y las 114 suras disponibles sin conexión.' },
      { k: 'rashed', ic: '💬', ar: 'راشد', t: 'Pregunta a Rashed', d: 'Tus preguntas respondidas desde sitios de sabios de confianza, siempre con los enlaces originales.' },
      { k: 'scanner', ic: '🔎', ar: 'حلال', t: 'Escáner halal', d: 'Escanea un código de barras o la lista de ingredientes; marca lo haram y lo dudoso y explica por qué.' },
      { k: 'map', ic: '🗺️', ar: 'مساجد', t: 'Mezquitas cerca de ti', d: 'Encuentra lugares de oración y comida halal a tu alrededor, gracias a OpenStreetMap.' },
      { k: 'tasbih', ic: '📿', ar: 'سبحة', t: 'Tasbih y camino', d: 'Un contador de dhikr, misiones diarias, rachas y la recompensa de cada acto que completes.' },
    ],
  },
  ja: {
    dir: 'ltr',
    nav: { features: '機能', how: '使い方', app: 'アプリ', open: 'アプリを開く' },
    pill: '新しいムスリムのために',
    title1: '最初の一歩を、', title2: 'やさしく。',
    lead: '礼拝の仕方を学び、クルアーンを読み、モスクを見つけ、毎日の習慣を育てる — あなたの言葉で、あなたのペースで。',
    start: '旅を始める', see: '中身を見る',
    fEyebrow: '必要なものがひとつに', fTitle: 'ムスリムの一日に寄り添う設計',
    fLead: '最初のウドゥーから毎日のクルアーンの分量まで — 新しい方にも、実践している方にも、学ぶ子どもにも合わせて変わります。',
    open: '開く',
    hEyebrow: '使い方', hTitle: 'はじめの三ステップ',
    steps: [
      ['言語を選ぶ', 'アラビア語と日本語を含む6言語。礼拝はアラビア語のまま、説明はあなたの言葉で。'],
      ['学ぶ人を教えてください', '新しいムスリム、大人、子ども。選んだプロフィールに合わせて、レッスン・ツール・語り口が変わります。'],
      ['自分の旅を築く', '毎日のクエスト、連続記録、行いごとの報い — 端末に保存され、アカウントは不要です。'],
    ],
    ctaTitle: '今日からウェブで使えます',
    ctaLead: 'どのブラウザでも、スマホでもノートPCでも動きます。インストールは不要。ネイティブのモバイルアプリも準備中です。',
    ctaBtn: 'アプリを開く', soon: '📱 iOS・Android — 近日公開',
    foot: '卒業制作 · 地図データ © OpenStreetMap 貢献者',
    features: [
      { k: 'salah', ic: '🧎', ar: 'صلاة', t: '礼拝を学ぶ', d: 'カメラが姿勢とその順序をその場で確認しながら、一歩ずつ礼拝を学べます。' },
      { k: 'mushaf', ic: '📗', ar: 'مصحف', t: 'クルアーンを読む', d: 'ウスマーン写本の書体による金色のムスハフ。114章すべてをオフラインで。' },
      { k: 'rashed', ic: '💬', ar: 'راشد', t: 'ラーシドに聞く', d: '信頼できる学者のサイトからの回答を、つねに元のリンクとともに。' },
      { k: 'scanner', ic: '🔎', ar: 'حلال', t: 'ハラール・スキャナー', d: 'バーコードか原材料表示を読み取り、ハラームや疑わしいものを指摘して理由も説明します。' },
      { k: 'map', ic: '🗺️', ar: 'مساجد', t: '近くのモスク', d: 'OpenStreetMap をもとに、身のまわりの礼拝所とハラールの食事を探せます。' },
      { k: 'tasbih', ic: '📿', ar: 'سبحة', t: 'タスビーフと旅路', d: 'ズィクルの数取り器、毎日のクエスト、連続記録、そして成し遂げた行いごとの報い。' },
    ],
  },
  ar: {
    dir: 'rtl',
    nav: { features: 'المميزات', how: 'كيف يعمل', app: 'التطبيق', open: 'ابدأ الآن' },
    pill: 'رفيقك في خطواتك الأولى',
    title1: 'خطواتك الأولى،', title2: 'بكل بساطة.',
    lead: 'تعلّم كيف تصلّي، واقرأ القرآن، واعثر على أقرب مسجد، وابنِ عاداتك اليومية — بلغتك وعلى مهلك.',
    start: 'ابدأ رحلتك', see: 'شاهد ما بالداخل',
    fEyebrow: 'كل ما تحتاجه في مكان واحد', fTitle: 'مبنيّ على يوم المسلم',
    fLead: 'من وضوئك الأول إلى وردك اليومي من القرآن — يتكيّف التطبيق معك سواء كنت جديدًا أو ملتزمًا أو طفلًا يتعلّم.',
    open: 'افتح',
    hEyebrow: 'كيف يعمل', hTitle: 'ثلاث خطوات للبدء',
    steps: [
      ['اختر لغتك', 'ست لغات منها العربية واليابانية. تبقى الصلاة والقرآن بالعربية، والشرح بلغتك.'],
      ['أخبرنا من يتعلّم', 'مسلم جديد، أو بالغ، أو طفل. تتكيّف الدروس والأدوات والأسلوب مع الملف الذي تختاره.'],
      ['ابنِ رحلتك', 'مهام يومية وتتابع وثواب كل عمل تنجزه — محفوظة على جهازك دون حساب.'],
    ],
    ctaTitle: 'استخدمه على الويب اليوم',
    ctaLead: 'يعمل في أي متصفّح، على الهاتف أو الحاسوب — دون تثبيت. وتطبيق الهاتف في الطريق.',
    ctaBtn: 'افتح التطبيق', soon: '📱 iOS و Android — قريبًا',
    foot: 'مشروع تخرّج · بيانات الخرائط © مساهمو OpenStreetMap',
    features: [
      { k: 'salah', ic: '🧎', ar: 'صلاة', t: 'تعلّم الصلاة', d: 'صلاة خطوة بخطوة مع ملاحظات مباشرة من الكاميرا تتحقّق من وضعياتك وترتيبها.' },
      { k: 'mushaf', ic: '📗', ar: 'مصحف', t: 'اقرأ القرآن', d: 'مصحف ذهبي بالرسم العثماني، وجميع السور الـ١١٤ متاحة دون إنترنت.' },
      { k: 'rashed', ic: '💬', ar: 'راشد', t: 'اسأل راشد', d: 'إجابات أسئلتك من مواقع أهل العلم الموثوقة — مع روابط الأصل دائمًا.' },
      { k: 'scanner', ic: '🔎', ar: 'حلال', t: 'فاحص الحلال', d: 'امسح الباركود أو قائمة المكوّنات؛ يُعلّم المحرّم والمشبوه ويشرح السبب.' },
      { k: 'map', ic: '🗺️', ar: 'مساجد', t: 'المساجد القريبة', d: 'اعثر على أماكن الصلاة والطعام الحلال حولك، بالاعتماد على OpenStreetMap.' },
      { k: 'tasbih', ic: '📿', ar: 'سبحة', t: 'السبحة والرحلة', d: 'عدّاد ذِكر ومهام يومية وتتابع وثواب كل عمل تنجزه.' },
    ],
  },
}
const site = (lang) => SITE[lang] || SITE.en

export default function Landing() {
  const { go, theme, setTheme, lang, setLang } = useApp()
  const s = site(lang)
  const isAr = s.dir === 'rtl'

  // each feature card opens that feature directly
  const openFeature = (key) => go(key === 'tasbih' ? 'journey' : key)

  return (
    <div className="site" dir={s.dir} lang={lang}>
      {/* ---------- nav ---------- */}
      <header className="site-nav">
        <div className="site-wrap nav-inner">
          <div className="brand">
            <span className="brand-mark">☾</span>
            <span>
              <span className="brand-ar ar">رفيق المسلم الجديد</span>
              {!isAr && <span className="brand-en">New Muslim Companion</span>}
            </span>
          </div>
          <nav className="nav-links">
            <a href="#features">{s.nav.features}</a>
            <a href="#how">{s.nav.how}</a>
            <a href="#app">{s.nav.app}</a>
          </nav>
          <div className="nav-actions">
            <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="language">
              {LANGS.map((l) => <option key={l.id} value={l.id}>{l.native}</option>)}
            </select>
            <button className="icon-btn" onClick={() => setTheme(theme === 'night' ? 'day' : 'night')} aria-label="theme">
              {theme === 'night' ? '☀' : '☾'}
            </button>
            <button className="btn" onClick={() => go('language')}>{s.nav.open}</button>
          </div>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="hero">
        <Aurora colors={['#1F7A6B', '#C4573C', '#A8823C']} style={{ opacity: .5 }} />
        <div className="site-wrap hero-inner">
          <div className="hero-copy">
            <span className="pill">{s.pill}</span>
            <h1 className={`display hero-title ${isAr ? 'ar' : ''}`}>
              {isAr ? s.title1 : <SplitText text={s.title1} delay={35} />}<br />
              <span className="hero-accent">{isAr ? s.title2 : <SplitText text={s.title2} delay={35} />}</span>
            </h1>
            <p className="hero-lead">{s.lead}</p>
            <div className="hero-cta">
              <button className="btn btn-lg" onClick={() => go('language')}>{s.start}</button>
              <a className="btn btn-lg ghost" href="#features">{s.see}</a>
            </div>
            <div className="hero-langs">
              {LANGS.map((l) => (
                <button key={l.id} className={l.id === lang ? 'on' : ''} onClick={() => setLang(l.id)}>{l.native}</button>
              ))}
            </div>
          </div>

          <div className="hero-art">
            <div className="phone-preview">
              <div className="pp-glow" />
              <div className="pp-inner">
                <div className="pp-anim"><Anim name="mosque" /></div>
                <div className="pp-ar ar">السَّلَامُ عَلَيْكُم</div>
                <div className="pp-sub">
                  {isAr ? <span className="ar">رفيق المسلم الجديد</span> : <ShinyText text="New Muslim Companion" />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- features (clickable) ---------- */}
      <section id="features" className="section">
        <div className="site-wrap">
          <div className="sec-head">
            <span className="eyebrow">{s.fEyebrow}</span>
            <h2 className="display">{s.fTitle}</h2>
            <p>{s.fLead}</p>
          </div>
          <div className="feature-grid">
            {s.features.map((f) => (
              <button key={f.k} className="feature-card" onClick={() => openFeature(f.k)}>
                <span className="fc-ic">{f.ic}</span>
                <span className="fc-ar ar">{f.ar}</span>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
                <span className="fc-go">{s.open} {isAr ? '←' : '→'}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- how ---------- */}
      <section id="how" className="section alt">
        <div className="site-wrap">
          <div className="sec-head">
            <span className="eyebrow">{s.hEyebrow}</span>
            <h2 className="display">{s.hTitle}</h2>
          </div>
          <div className="steps-grid">
            {s.steps.map(([t, d], i) => (
              <article key={t} className="step-card">
                <span className="step-n">{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- cta ---------- */}
      <section id="app" className="section">
        <div className="site-wrap cta-band">
          <div>
            <h2 className="display">{s.ctaTitle}</h2>
            <p>{s.ctaLead}</p>
            <div className="hero-cta">
              <button className="btn btn-lg" onClick={() => go('language')}>{s.ctaBtn}</button>
              <span className="soon">{s.soon}</span>
            </div>
          </div>
          <div className="cta-anim"><Anim name="salam" /></div>
        </div>
      </section>

      <footer className="site-foot">
        <div className="site-wrap foot-inner">
          <span className="ar">رفيق المسلم الجديد</span>
          <span>{s.foot}</span>
        </div>
      </footer>
    </div>
  )
}
