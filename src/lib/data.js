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
    // Arabic pattern tolerates OCR mix-ups between dotted/undotted letters (خ/ح/ج, ن/ب/ت/ث, ز/ر)
    id: 'pork', s: 'haram', re: /\b(pork|porcine|swine|bacon|ham|lard|prosciutto|chorizo|pancetta|gammon|pig|hog|porc|schwein|schweinefleisch|cerdo)\b|[خحج][نبتث][زر][يى]ر/i,
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
    id: 'alcohol', s: 'haram', re: /\b(alcohol|alcool|alkohol|ethanol|wine|beer|rum|liqueur|brandy|vodka|whisky|whiskey|tequila|champagne|sake|mirin|sherry|gin)\b|كحول|خمر|نبيذ|ويسكي|بيرة|فودكا/i,
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
    id: 'gelatin', s: 'doubtful', certOk: true, re: /\b(gelatin|gelatine|gélatine|gelatina)\b|جيلاتين|جلاتين/i,
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
    id: 'rennet', s: 'doubtful', certOk: true, re: /\b(rennet|rennin)\b|أنفحة|منفحة/i,
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
    id: 'mono', s: 'doubtful', re: /\bmono-?\s*(and|&)?\s*-?diglycerides?\b|\bE ?471\b/i,
    n: { en: 'Mono/di-glycerides (E471)', ar: 'دهون مستحلبة E471', de: 'Mono-/Diglyceride (E471)', fr: 'Mono/diglycérides (E471)', es: 'Mono/diglicéridos (E471)', ja: 'モノ・ジグリセリド（E471）' },
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
  {
    id: 'shellac', s: 'doubtful', re: /\b(shellac|confectioner'?s glaze)\b|E ?904/i,
    n: { en: 'Shellac (E904)', ar: 'شمع اللاك E904' },
    w: { en: 'A resin secreted by insects; some scholars permit it, others treat it as doubtful.', ar: 'مادة راتنجية تفرزها الحشرات؛ أجازها بعض العلماء وتوقّف فيها آخرون.' },
  },
  {
    id: 'cysteine', s: 'doubtful', re: /\bL-?\s?cysteine\b|E ?920/i,
    n: { en: 'L-cysteine (E920)', ar: 'إل-سيستين E920' },
    w: { en: 'Often made from animal hair or feathers (sometimes human or pig) — source matters.', ar: 'كثيرًا ما تُستخرج من شعر أو ريش الحيوان (وأحيانًا من الخنزير) — المصدر مهم.' },
  },
  {
    id: 'glycerin', s: 'doubtful', re: /\b(glycerin|glycerine|glycerol)\b|E ?422|جلسرين|غليسرين/i,
    n: { en: 'Glycerin (E422)', ar: 'جلسرين E422' },
    w: { en: 'Can be plant-based or animal-based — source matters.', ar: 'قد يكون نباتيًا أو حيوانيًا — المصدر مهم.' },
  },
  {
    id: 'blood', s: 'haram', re: /\b(blood|blood plasma)\b|(^|\s)دم(\s|$)/i,
    n: { en: 'Blood / blood plasma', ar: 'دم' },
    w: { en: 'Blood is impermissible.', ar: 'الدم المسفوح محرّم.' },
  },
  {
    id: 'meat', s: 'doubtful', certOk: true, re: /\b(beef|chicken|lamb|mutton|turkey|veal|duck|meat)\b|لحم|دجاج|بقر|غنم|ضأن/i,
    n: { en: 'Meat or poultry', ar: 'لحم أو دواجن' },
    w: { en: 'Halal only if slaughtered according to Islamic rules — look for halal certification.', ar: 'لا يحلّ إلا إن كان مذكّى على الطريقة الشرعية — ابحث عن شهادة حلال.' },
  },
  {
    id: 'animalfat', s: 'doubtful', certOk: true, re: /\b(tallow|suet|dripping|animal (fat|fats|shortening|oil))\b|شحم|دهون حيوانية/i,
    n: { en: 'Animal fat', ar: 'دهن حيواني' },
    w: { en: 'Could come from pork or from non-halal slaughter — verify the source.', ar: 'قد يكون من الخنزير أو من ذبيحة غير مذكّاة — تحقّق من المصدر.' },
  },
  {
    id: 'enzymes', s: 'doubtful', certOk: true, re: /\b(pepsin|lipase|pancreatin|trypsin|animal enzymes?)\b/i,
    n: { en: 'Enzymes (possibly animal)', ar: 'إنزيمات (قد تكون حيوانية)' },
    w: { en: 'Can be animal-derived (sometimes from pigs) or microbial — verify the source.', ar: 'قد تكون حيوانية (أحيانًا من الخنزير) أو ميكروبية — تحقّق من المصدر.' },
  },
  {
    id: 'inosinate', s: 'doubtful', re: /\bE ?(627|631|635)\b|\b(disodium (inosinate|guanylate|5'?-ribonucleotides?)|inosinate)\b/i,
    n: { en: 'Flavour enhancer (E627/E631/E635)', ar: 'محسّن نكهة E631' },
    w: { en: 'Often made from meat or fish — source matters.', ar: 'كثيرًا ما يُستخرج من اللحم أو السمك — المصدر مهم.' },
  },
  {
    id: 'bonephos', s: 'doubtful', re: /\bE ?542\b|\bbone (phosphate|char|meal)\b/i,
    n: { en: 'Bone phosphate (E542)', ar: 'فوسفات العظام E542' },
    w: { en: 'Made from animal bones — source matters.', ar: 'يُصنع من عظام الحيوان — المصدر مهم.' },
  },
  {
    id: 'collagen', s: 'doubtful', certOk: true, re: /\bcollagen\b|كولاجين/i,
    n: { en: 'Collagen', ar: 'كولاجين' },
    w: { en: 'Usually from pork or non-halal beef — verify the source.', ar: 'غالبًا من الخنزير أو بقر غير مذكّى — تحقّق من المصدر.' },
  },
  {
    id: 'fatty', s: 'doubtful', re: /\bE ?(470[ab]?|472[a-f]?|473|474|475|477|481|482|491|492|493|494|495|570)\b|\b(stearic acid|magnesium stearate|sorbitan (mono|tri)stearate)\b/i,
    n: { en: 'Fatty-acid derivatives (E470–E495, E570)', ar: 'مشتقات الأحماض الدهنية' },
    w: { en: 'Can be plant or animal fat — source matters.', ar: 'قد تكون من دهن نباتي أو حيواني — المصدر مهم.' },
  },
  {
    id: 'vanilla', s: 'doubtful', re: /\bvanilla extract\b|مستخلص الفانيليا/i,
    n: { en: 'Vanilla extract', ar: 'مستخلص الفانيليا' },
    w: { en: 'Usually made with alcohol as the solvent — check if alcohol-free.', ar: 'يُستخلص عادةً بالكحول — تحقّق إن كان خاليًا منه.' },
  },
  {
    id: 'winevinegar', s: 'doubtful', re: /WINEVINEGAR/,
    n: { en: 'Wine vinegar', ar: 'خل النبيذ' },
    w: { en: 'Scholars differ on vinegar made from wine — treat as doubtful.', ar: 'اختلف العلماء في خلّ الخمر — يُعدّ مشبوهًا.' },
  },
]

// pick a translated field from a {en, ar, de, fr, es, ja} object, falling back to English
export const pick = (o, lang) => (o && (o[lang] || o.en)) || ''

export const HALAL_RE = /\bhalal\b|حلال/i

// phrases that look risky but are fine — removed before matching
const ALC_FREE = /\balcohol[- ]free\b|\bnon[- ]?alcoholic\b|\b0(\.0)?\s?% alcohol\b|خالٍ? من الكحول|بدون كحول/gi
const SAFE = /\b(fish|marine|vegetable|plant|halal) gelatin(e)?\b|\b(vegetable|microbial|plant)[- ]?(based )?rennet\b|\b(vegetable|plant)(-based)? glycerin(e)?\b|\bblood orange\b/gi
const NOT_HALAL = /\b(non|not)[- ]?halal\b|غير حلال/i

/** trusted=false means the text may be unreadable or in an unknown language, so "clean" is not a safe answer */
export function analyze(text, { trusted = true } = {}) {
  const clean = String(text || '').replace(ALC_FREE, ' ').replace(SAFE, ' ')
    .replace(/\b(wine|sherry|balsamic) vinegar\b/gi, ' WINEVINEGAR ')
  // a "halal" claim in the text only relaxes the slaughter/source rules (certOk); haram items always count
  const cert = HALAL_RE.test(clean) && !NOT_HALAL.test(clean)
  const found = []
  for (const r of RULES) if (r.re.test(clean) && !(r.certOk && cert)) found.push(r)
  const bad = found.some((f) => f.s === 'haram')
  const doubt = found.some((f) => f.s === 'doubtful')
  const v = bad ? 'bad' : doubt ? 'warn' : clean.trim().length > 3 && trusted ? 'ok' : 'unknown'
  return { found, v, cert }
}
