export const LANGS = [
  { id: 'en', mark: 'EN', native: 'English', hint: 'Learn Arabic through English' },
  { id: 'de', mark: 'DE', native: 'Deutsch', hint: 'Arabisch lernen auf Deutsch' },
  { id: 'fr', mark: 'FR', native: 'Français', hint: "Apprendre l'arabe en français" },
  { id: 'es', mark: 'ES', native: 'Español', hint: 'Aprender árabe en español' },
  { id: 'ja', mark: '日', native: '日本語', hint: 'アラビア語を日本語で学ぶ' },
  { id: 'ar', mark: 'ع', native: 'العربية', hint: 'تعلّم بلغة القرآن مباشرة' },
]

export const PRAYERS = [
  { ar: 'الفجر', t: '5:02' },
  { ar: 'الظهر', t: '12:58' },
  { ar: 'العصر', t: '16:31' },
  { ar: 'المغرب', t: '19:47' },
  { ar: 'العشاء', t: '21:12' },
]
export const NOW_I = 2

export const AYAT = [
  { v: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا', en: 'Whoever is mindful of God, He makes a way out for them from every hardship.', ar: 'ومن يخف الله ويطعه يجعل له من كل ضيق مخرجًا.' },
  { v: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', en: 'Indeed, with hardship comes ease.', ar: 'مع كل شدة تيسير من الله قريب.' },
  { v: 'فَاذْكُرُونِي أَذْكُرْكُمْ', en: 'Remember Me, and I will remember you.', ar: 'اذكر الله يذكرك في الملأ الأعلى.' },
  { v: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', en: 'And say: My Lord, increase me in knowledge.', ar: 'ادعُ الله أن يزيدك علمًا نافعًا.' },
]

// feature meta (language-independent)
export const FEATURES = {
  poseNew: { ic: '🧎', ar: 'صلاة', lead: true, span: true, screen: 'salah' },
  poseChild: { ic: '🧎', ar: 'صلاة', lead: true, span: true, screen: 'salah' },
  poseAdult: { ic: '🧎', ar: 'صلاة', lead: true, span: true, screen: 'salah' },
  rashed: { ic: '💬', ar: 'راشد', span: true, screen: 'rashed' },
  wudu: { ic: '💧', ar: 'وضوء' },
  basics: { ic: '🕋', ar: 'أركان' },
  tarteel: { ic: '📖', ar: 'ترتيل' },
  tajweed: { ic: '📖', ar: 'تجويد' },
  letters: { ic: '🔤', ar: 'أ ب' },
  names: { ic: '✨', ar: '٩٩' },
  quiz: { ic: '🎯', ar: '؟' },
  fajr: { ic: '⏰', ar: 'فجر', screen: 'alarm' },
  map: { ic: '🗺️', ar: 'حلال', screen: 'map' },
  events: { ic: '📅', ar: 'عرفة', screen: 'events' },
  scan: { ic: '🔎', ar: 'مسح', screen: 'scanner' },
  mushaf: { ic: '📗', ar: 'مصحف', screen: 'mushaf' },
  tasbih: { ic: '📿', ar: 'سبحة', screen: 'tasbih' },
}

export const PERSONAS = {
  child: { practice: ['poseChild', 'letters', 'quiz'], daily: ['mushaf', 'tasbih', 'names', 'wudu'] },
  new: { practice: ['poseNew', 'wudu', 'basics', 'tarteel'], daily: ['rashed', 'mushaf', 'tasbih', 'scan', 'map', 'fajr', 'events', 'names'] },
  adult: { practice: ['poseAdult', 'tajweed'], daily: ['rashed', 'mushaf', 'tasbih', 'scan', 'map', 'fajr', 'events', 'names'] },
}

export const SITES = [
  { n: 'موقع الشيخ ابن باز', d: 'binbaz.org.sa' },
  { n: 'الإسلام سؤال وجواب', d: 'islamqa.info' },
  { n: 'إسلام ويب', d: 'islamweb.net' },
  { n: 'موقع الشيخ ابن عثيمين', d: 'binothaimeen.net' },
]

// ingredient knowledge base (haram / doubtful)
export const RULES = [
  {
    id: 'pork', s: 'haram', re: /\b(pork|porcine|swine|bacon|ham|lard|prosciutto|chorizo)\b|خنزير/i,
    n: { en: 'Pork / pig-derived', ar: 'خنزير', de: 'Schwein / vom Schwein', fr: 'Porc / dérivé du porc', es: 'Cerdo / derivado del cerdo', ja: '豚肉・豚由来' },
    w: {
      en: 'Pork and anything from pigs is impermissible.',
      ar: 'الخنزير وما يُشتق منه محرّم.',
      de: 'Schweinefleisch und alles vom Schwein ist unzulässig.',
      fr: 'Le porc et tout ce qui en provient est illicite.',
      es: 'El cerdo y todo lo que provenga de él es ilícito.',
      ja: '豚肉および豚に由来するものはすべて許されません。',
    },
  },
  {
    id: 'alcohol', s: 'haram', re: /\b(alcohol|ethanol|wine|beer|rum|liqueur|brandy)\b|كحول|خمر/i,
    n: { en: 'Alcohol / intoxicant', ar: 'كحول', de: 'Alkohol / Rauschmittel', fr: 'Alcool / enivrant', es: 'Alcohol / embriagante', ja: 'アルコール・酩酊物' },
    w: {
      en: 'Drinking alcohol and added ethanol are impermissible.',
      ar: 'الخمر والكحول المضاف محرّم.',
      de: 'Alkohol zu trinken und zugesetztes Ethanol sind unzulässig.',
      fr: 'Boire de l’alcool et l’éthanol ajouté sont illicites.',
      es: 'Beber alcohol y el etanol añadido son ilícitos.',
      ja: '飲酒および添加されたエタノールは許されません。',
    },
  },
  {
    id: 'gelatin', s: 'doubtful', re: /\b(gelatin|gelatine)\b|جيلاتين|جلاتين/i,
    n: { en: 'Gelatin', ar: 'جيلاتين', de: 'Gelatine', fr: 'Gélatine', es: 'Gelatina', ja: 'ゼラチン' },
    w: {
      en: 'Usually pork or non-halal beef. Fine only from a halal-certified or fish source — verify.',
      ar: 'غالبًا من الخنزير أو بقر غير مذكّى. يُقبل من مصدر موثّق حلال أو سمكي — تحقّق.',
      de: 'Meist vom Schwein oder von nicht halal geschlachtetem Rind. Nur aus halal-zertifizierter Quelle oder von Fisch unbedenklich — prüfe es.',
      fr: 'Le plus souvent de porc ou de bœuf non halal. Acceptable seulement d’une source certifiée halal ou de poisson — vérifiez.',
      es: 'Normalmente de cerdo o de vacuno no halal. Solo es aceptable de origen certificado halal o de pescado: compruébalo.',
      ja: '多くは豚または非ハラール牛の由来です。ハラール認証または魚由来の場合のみ問題ありません。確認してください。',
    },
  },
  {
    id: 'rennet', s: 'doubtful', re: /\b(rennet|rennin)\b|أنفحة|منفحة/i,
    n: { en: 'Rennet (in cheese)', ar: 'أنفحة', de: 'Lab (im Käse)', fr: 'Présure (dans le fromage)', es: 'Cuajo (en el queso)', ja: 'レンネット（チーズ）' },
    w: {
      en: 'Animal rennet only fine if from a halal-slaughtered animal; microbial is fine.',
      ar: 'الأنفحة الحيوانية تُقبل إن كانت من مذكّى؛ والميكروبية لا بأس بها.',
      de: 'Tierisches Lab ist nur von einem halal geschlachteten Tier unbedenklich; mikrobielles Lab ist unbedenklich.',
      fr: 'La présure animale n’est acceptable que d’un animal abattu selon le rite ; la présure microbienne est sans problème.',
      es: 'El cuajo animal solo es aceptable si viene de un animal sacrificado según el rito; el microbiano no tiene problema.',
      ja: '動物性レンネットはハラール屠畜の動物に由来する場合のみ問題ありません。微生物由来は問題ありません。',
    },
  },
  {
    id: 'carmine', s: 'doubtful', re: /\b(carmine|cochineal)\b|E ?120/i,
    n: { en: 'Carmine (E120)', ar: 'قرمز E120', de: 'Karmin (E120)', fr: 'Carmin (E120)', es: 'Carmín (E120)', ja: 'コチニール（E120）' },
    w: {
      en: 'A red colour from insects — treated as doubtful by many.',
      ar: 'لون أحمر من الحشرات — يُعدّ مشبوهًا عند كثيرين.',
      de: 'Ein roter Farbstoff aus Insekten — von vielen als zweifelhaft eingestuft.',
      fr: 'Un colorant rouge tiré d’insectes — considéré comme douteux par beaucoup.',
      es: 'Un colorante rojo obtenido de insectos: muchos lo consideran dudoso.',
      ja: '昆虫から取られる赤色色素で、疑わしいとする見解が多くあります。',
    },
  },
  {
    id: 'mono', s: 'doubtful', re: /\bmono-?\s*(and|&)?\s*-?diglycerides?\b|E ?47[12]/i,
    n: { en: 'Mono/di-glycerides (E471/2)', ar: 'دهون مستحلبة E471', de: 'Mono-/Diglyceride (E471/2)', fr: 'Mono/diglycérides (E471/2)', es: 'Mono/diglicéridos (E471/2)', ja: 'モノ・ジグリセリド（E471/2）' },
    w: {
      en: 'Emulsifiers that can be plant or animal fat — source matters.',
      ar: 'مستحلبات قد تكون دهنًا نباتيًا أو حيوانيًا — المصدر مهم.',
      de: 'Emulgatoren, die aus pflanzlichem oder tierischem Fett stammen können — die Herkunft entscheidet.',
      fr: 'Des émulsifiants qui peuvent venir de graisse végétale ou animale — l’origine compte.',
      es: 'Emulgentes que pueden ser de grasa vegetal o animal: el origen importa.',
      ja: '植物性にも動物性にもなり得る乳化剤で、由来が問題になります。',
    },
  },
  {
    id: 'whey', s: 'doubtful', re: /\bwhey\b|مصل اللبن/i,
    n: { en: 'Whey', ar: 'مصل اللبن', de: 'Molke', fr: 'Petit-lait (lactosérum)', es: 'Suero de leche', ja: 'ホエイ（乳清）' },
    w: {
      en: 'Doubtful only if made with animal rennet — often fine.',
      ar: 'مشبوه فقط إن صُنع بأنفحة حيوانية — غالبًا لا بأس.',
      de: 'Nur zweifelhaft, wenn mit tierischem Lab hergestellt — oft unbedenklich.',
      fr: 'Douteux seulement s’il est fait avec de la présure animale — souvent sans problème.',
      es: 'Dudoso solo si se elabora con cuajo animal: a menudo no hay problema.',
      ja: '動物性レンネットを使う場合のみ疑わしく、多くは問題ありません。',
    },
  },
]

// pick a translated field from a {en, ar, de, fr, es, ja} object, falling back to English
export const pick = (o, lang) => (o && (o[lang] || o.en)) || ''

export const HALAL_RE = /\bhalal\b|حلال/i

export function analyze(text) {
  const found = []
  const seen = new Set()
  for (const r of RULES) if (r.re.test(text) && !seen.has(r.id)) { seen.add(r.id); found.push(r) }
  const bad = found.some((f) => f.s === 'haram')
  const doubt = found.some((f) => f.s === 'doubtful')
  const v = bad ? 'bad' : doubt ? 'warn' : text.trim().length > 3 ? 'ok' : 'unknown'
  return { found, v, cert: HALAL_RE.test(text) }
}
