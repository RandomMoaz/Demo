// Islamic events. Hijri dates via Intl's Umm al-Qura calendar, tabular fallback.

const DAY = 864e5
const HIJRI_EPOCH = Date.UTC(622, 6, 16)

export const HIJRI_MONTHS = {
  en: ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah',
    'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhul-Qadah', 'Dhul-Hijjah'],
  ar: ['محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجّة'],
}

const midnight = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const today = () => midnight(new Date())

/** Gregorian Date -> { y, m, d } in the Hijri (Umm al-Qura) calendar. */
export function toHijri(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).formatToParts(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())))
    const get = (t) => Number(parts.find((p) => p.type === t)?.value)
    const y = get('year'), m = get('month'), d = get('day')
    if (y && m && d) return { y, m, d }
  } catch { /* fall through */ }
  // tabular fallback
  const jd = Math.floor((midnight(date) - HIJRI_EPOCH) / DAY)
  const l = jd + 10632
  const n = Math.floor((l - 1) / 10631)
  let j = l - 10631 * n
  const y = 30 * n + Math.floor((j - 1) / 354.367) + 1
  j -= Math.floor((y - 30 * n - 1) * 354.367)
  const m = Math.min(12, Math.max(1, Math.ceil(j / 29.531)))
  return { y, m, d: Math.max(1, Math.round(j - (m - 1) * 29.531)) }
}

/** Hijri (y, m, d) -> the Gregorian Date it falls on. */
export function fromHijri(hy, hm, hd) {
  let t = HIJRI_EPOCH + Math.round(((hy - 1) * 354.367 + (hm - 1) * 29.531 + (hd - 1)) * DAY)
  for (let i = 0; i < 40; i++) {
    const h = toHijri(new Date(t))
    if (h.y === hy && h.m === hm && h.d === hd) return midnight(new Date(t))
    const delta = (hy - h.y) * 354.367 + (hm - h.m) * 29.531 + (hd - h.d)
    const step = Math.round(delta) || (delta > 0 ? 1 : -1)
    t += step * DAY
  }
  // last resort: walk a small window day by day
  for (let off = -5; off <= 5; off++) {
    const h = toHijri(new Date(t + off * DAY))
    if (h.y === hy && h.m === hm && h.d === hd) return midnight(new Date(t + off * DAY))
  }
  return null
}

/* the events — thawab is what the day is worth */
export const EVENTS = [
  {
    id: 'ramadan', kind: 'hijri', hm: 9, hd: 1, span: 29, ic: '🌙', tone: 'gold',
    name: { en: 'Ramadan', ar: 'رمضان', de: 'Ramadan', fr: 'Ramadan', es: 'Ramadán', ja: 'ラマダーン' },
    what: {
      en: 'The month of fasting: from true dawn to sunset, every day for a month.',
      ar: 'شهر الصيام: من طلوع الفجر إلى غروب الشمس، كل يوم شهرًا كاملًا.',
      de: 'Der Monat des Fastens: von der Morgendämmerung bis zum Sonnenuntergang, einen Monat lang.',
      fr: 'Le mois du jeûne : de l’aube véritable au coucher du soleil, chaque jour durant un mois.',
      es: 'El mes del ayuno: desde el alba verdadera hasta la puesta del sol, cada día durante un mes.',
      ja: '断食の月。夜明けから日没まで、ひと月のあいだ毎日。',
    },
    thawab: {
      en: 'Whoever fasts Ramadan out of faith, seeking the reward, is forgiven what came before of his sins. (Bukhari & Muslim)',
      ar: '«مَن صام رمضان إيمانًا واحتسابًا غُفر له ما تقدّم من ذنبه». (متفق عليه)',
      de: 'Wer den Ramadan aus Glauben und im Streben nach Lohn fastet, dem wird vergeben, was zuvor an Sünden war. (Buchari & Muslim)',
      fr: 'Quiconque jeûne le Ramadan par foi et en espérant la récompense, ses péchés passés lui sont pardonnés. (Boukhari et Mouslim)',
      es: 'Quien ayune el Ramadán con fe y esperando la recompensa, le será perdonado lo que precedió de sus faltas. (Bujari y Muslim)',
      ja: '信仰をもって報奨を求めラマダーンに断食する者は、過去の罪が赦される。（ブハーリー、ムスリム）',
    },
    todo: {
      en: ['Keep suhoor, even a sip of water', 'Break the fast as soon as the sun sets', 'Take a daily portion of the Qur’an'],
      ar: ['لا تترك السحور ولو جرعة ماء', 'عجّل الفطر إذا غابت الشمس', 'اجعل لك وردًا يوميًا من القرآن'],
      de: ['Halte am Suhur fest, sei es ein Schluck Wasser', 'Brich das Fasten, sobald die Sonne untergeht', 'Nimm dir täglich einen Abschnitt des Korans vor'],
      fr: ['Gardez le suhoor, ne serait-ce qu’une gorgée d’eau', 'Rompez le jeûne dès le coucher du soleil', 'Fixez-vous une portion quotidienne du Coran'],
      es: ['Mantén el suhoor, aunque sea un sorbo de agua', 'Rompe el ayuno en cuanto se ponga el sol', 'Ponte una porción diaria del Corán'],
      ja: ['スフールを欠かさずに（一口の水でも）', '日が沈んだらすぐに断食を解く', '毎日のクルアーンの分量を決める'],
    },
  },
  {
    id: 'qadr', kind: 'hijri', hm: 9, hd: 21, span: 9, ic: '✨', tone: 'gold',
    name: { en: 'The last ten nights', ar: 'العشر الأواخر', de: 'Die letzten zehn Nächte', fr: 'Les dix dernières nuits', es: 'Las diez últimas noches', ja: '最後の十夜' },
    what: {
      en: 'Laylat al-Qadr is hidden among them — sought most in the odd nights.',
      ar: 'فيها ليلة القدر، وأُمرنا بالتماسها في الوتر منها.',
      de: 'Laylat al-Qadr ist unter ihnen verborgen — am ehesten in den ungeraden Nächten.',
      fr: 'Laylat al-Qadr y est cachée — recherchée surtout dans les nuits impaires.',
      es: 'Laylat al-Qadr está oculta entre ellas, buscada sobre todo en las noches impares.',
      ja: 'ライラトゥル・カドルがこの中に隠されており、特に奇数の夜に求められます。',
    },
    thawab: {
      en: 'The Night of Decree is better than a thousand months. (Qur’an 97:3) — and whoever stands it in prayer out of faith, seeking the reward, is forgiven.',
      ar: '﴿لَيْلَةُ الْقَدْرِ خَيْرٌ مِّنْ أَلْفِ شَهْرٍ﴾ [القدر: ٣] — «ومَن قامها إيمانًا واحتسابًا غُفر له ما تقدّم من ذنبه».',
      de: 'Die Nacht der Bestimmung ist besser als tausend Monate. (Koran 97:3) — und wer sie im Gebet verbringt, aus Glauben und im Streben nach Lohn, dem wird vergeben.',
      fr: 'La Nuit du Destin est meilleure que mille mois. (Coran 97:3) — et quiconque la passe en prière, par foi et en espérant la récompense, est pardonné.',
      es: 'La Noche del Decreto es mejor que mil meses. (Corán 97:3), y quien la pase en oración con fe y esperando la recompensa, es perdonado.',
      ja: '「みそぎの夜は千の月にまさる」（クルアーン97:3）。信仰と報奨を求めてこの夜を礼拝に過ごす者は赦されます。',
    },
    todo: {
      en: ['Pray the night prayer', 'Say often: Allahumma innaka ‘afuwwun tuhibbu-l-‘afwa fa‘fu ‘anni', 'Give in charity each night'],
      ar: ['قم الليل ولو بشيء يسير', 'أكثر من: «اللهم إنك عفوٌّ تحب العفو فاعفُ عني»', 'تصدّق في كل ليلة منها'],
      de: ['Verrichte das Nachtgebet', 'Sprich oft: Allahumma innaka ‘afuwwun tuhibbu-l-‘afwa fa‘fu ‘anni', 'Gib in jeder Nacht etwas als Almosen'],
      fr: ['Accomplissez la prière de nuit', 'Répétez : Allahumma innaka ‘afuwwun tuhibbu-l-‘afwa fa‘fu ‘anni', 'Donnez en aumône chaque nuit'],
      es: ['Reza la oración de la noche', 'Repite: Allahumma innaka ‘afuwwun tuhibbu-l-‘afwa fa‘fu ‘anni', 'Da limosna cada noche'],
      ja: ['夜の礼拝を行う', '「アッラーフンマ・インナカ・アフウン…」を多く唱える', '毎晩なにかを施す'],
    },
  },
  {
    id: 'fitr', kind: 'hijri', hm: 10, hd: 1, span: 1, ic: '🎉', tone: 'lapis',
    name: { en: 'Eid al-Fitr', ar: 'عيد الفطر', de: 'Eid al-Fitr', fr: 'Aïd al-Fitr', es: 'Eid al-Fitr', ja: 'イード・アルフィトル' },
    what: {
      en: 'The festival that closes Ramadan. Fasting this day is not allowed — it is a day to eat and rejoice.',
      ar: 'عيد ختام رمضان، ولا يجوز صومه؛ فهو يوم أكلٍ وفرح.',
      de: 'Das Fest zum Abschluss des Ramadan. An diesem Tag zu fasten ist nicht erlaubt — er ist zum Essen und Freuen.',
      fr: 'La fête qui clôt le Ramadan. Jeûner ce jour-là n’est pas permis : c’est un jour où l’on mange et se réjouit.',
      es: 'La fiesta que cierra el Ramadán. Ayunar ese día no está permitido: es día de comer y alegrarse.',
      ja: 'ラマダーンを締めくくる祝祭。この日の断食は許されず、食べて喜ぶ日です。',
    },
    thawab: {
      en: 'Zakat al-Fitr is due before the Eid prayer — a purification for the fasting person and food for the poor. (Abu Dawud)',
      ar: 'زكاة الفطر تُؤدّى قبل صلاة العيد — «طُهرةً للصائم وطُعمةً للمساكين». (رواه أبو داود)',
      de: 'Zakat al-Fitr ist vor dem Eid-Gebet fällig — eine Reinigung für den Fastenden und Speise für die Armen. (Abu Dawud)',
      fr: 'La zakat al-Fitr est due avant la prière de l’Aïd : une purification pour le jeûneur et une nourriture pour les pauvres. (Abou Dawoud)',
      es: 'El zakat al-Fitr se paga antes de la oración del Eid: purificación para quien ayunó y alimento para los pobres. (Abu Dawud)',
      ja: 'ザカート・アルフィトルはイードの礼拝前に。断食した者の清めであり、貧しい者の糧です。（アブー・ダーウード）',
    },
    todo: {
      en: ['Pay zakat al-Fitr before the prayer', 'Eat something sweet before going out', 'Say the takbir on the way'],
      ar: ['أخرج زكاة الفطر قبل الصلاة', 'كُل تمرات قبل الخروج', 'كبّر في طريقك إلى المصلّى'],
      de: ['Zahle Zakat al-Fitr vor dem Gebet', 'Iss etwas Süßes, bevor du gehst', 'Sprich unterwegs den Takbir'],
      fr: ['Versez la zakat al-Fitr avant la prière', 'Mangez quelque chose de sucré avant de sortir', 'Dites le takbir en chemin'],
      es: ['Paga el zakat al-Fitr antes de la oración', 'Come algo dulce antes de salir', 'Di el takbir de camino'],
      ja: ['礼拝前にザカート・アルフィトルを納める', '出かける前に甘いものを口にする', '道すがらタクビールを唱える'],
    },
  },
  {
    id: 'shawwal6', kind: 'hijri', hm: 10, hd: 2, span: 27, ic: '🌾', tone: 'lapis',
    name: { en: 'Six days of Shawwal', ar: 'ست من شوّال', de: 'Sechs Tage des Schawwal', fr: 'Six jours de Chawwal', es: 'Seis días de Shawwal', ja: 'シャウワールの六日' },
    what: {
      en: 'Six voluntary fasts any time after Eid, together or apart.',
      ar: 'ستة أيام تطوّعًا بعد العيد، متتابعة أو متفرّقة.',
      de: 'Sechs freiwillige Fastentage nach dem Eid, zusammenhängend oder verteilt.',
      fr: 'Six jeûnes surérogatoires après l’Aïd, à la suite ou séparément.',
      es: 'Seis ayunos voluntarios tras el Eid, seguidos o por separado.',
      ja: 'イード後の自由意志による六日の断食。連続でも別々でも。',
    },
    thawab: {
      en: 'Whoever fasts Ramadan then follows it with six days of Shawwal, it is as though he fasted a lifetime. (Muslim)',
      ar: '«مَن صام رمضان ثم أتبعه ستًّا من شوّال كان كصيام الدهر». (رواه مسلم)',
      de: 'Wer den Ramadan fastet und ihm sechs Tage des Schawwal folgen lässt, ist, als hätte er ein Leben lang gefastet. (Muslim)',
      fr: 'Quiconque jeûne le Ramadan puis le fait suivre de six jours de Chawwal, c’est comme s’il avait jeûné toute une vie. (Mouslim)',
      es: 'Quien ayune el Ramadán y lo siga con seis días de Shawwal, es como si hubiera ayunado toda la vida. (Muslim)',
      ja: 'ラマダーンを断食し、続いてシャウワールの六日を断食する者は、生涯断食したのと同じ。（ムスリム）',
    },
    todo: {
      en: ['Make up any missed Ramadan days first', 'Spread them across the month if that is easier'],
      ar: ['ابدأ بقضاء ما فاتك من رمضان', 'وزّعها على الشهر إن كان أيسر لك'],
      de: ['Hole zuerst versäumte Ramadan-Tage nach', 'Verteile sie über den Monat, wenn das leichter ist'],
      fr: ['Rattrapez d’abord les jours manqués du Ramadan', 'Répartissez-les sur le mois si c’est plus simple'],
      es: ['Recupera primero los días perdidos de Ramadán', 'Repártelos por el mes si te resulta más fácil'],
      ja: ['まずラマダーンの未消化分を補う', '楽なら月内に分散させる'],
    },
  },
  {
    id: 'ten', kind: 'hijri', hm: 12, hd: 1, span: 9, ic: '🕋', tone: 'gold',
    name: { en: 'First ten of Dhul-Hijjah', ar: 'عشر ذي الحجّة', de: 'Die ersten zehn des Dhul-Hiddscha', fr: 'Les dix premiers de Dhoul-Hijja', es: 'Los diez primeros de Dhul-Hiyya', ja: 'ズー・アルヒッジャの最初の十日' },
    what: {
      en: 'The best days of the year for righteous deeds — for everyone, not only the pilgrims.',
      ar: 'أفضل أيام السنة للعمل الصالح — للناس جميعًا لا للحجّاج وحدهم.',
      de: 'Die besten Tage des Jahres für gute Taten — für alle, nicht nur für die Pilger.',
      fr: 'Les meilleurs jours de l’année pour les bonnes œuvres — pour tous, pas seulement les pèlerins.',
      es: 'Los mejores días del año para las buenas obras: para todos, no solo para los peregrinos.',
      ja: '善行にとって一年で最良の日々。巡礼者だけでなく、すべての人にとって。',
    },
    thawab: {
      en: 'There are no days in which righteous deeds are more beloved to Allah than these ten. (Bukhari)',
      ar: '«ما من أيام العمل الصالح فيهنّ أحبّ إلى الله من هذه الأيام العشر». (رواه البخاري)',
      de: 'Es gibt keine Tage, an denen rechtschaffene Taten Allah lieber sind als an diesen zehn. (Buchari)',
      fr: 'Il n’est pas de jours où les bonnes œuvres soient plus aimées d’Allah que ces dix. (Boukhari)',
      es: 'No hay días en los que las buenas obras sean más amadas por Allah que estos diez. (Bujari)',
      ja: 'これら十日ほど、善行がアッラーに愛される日々はない。（ブハーリー）',
    },
    todo: {
      en: ['Increase takbir, tahmid and tahlil', 'Fast what you can of the nine days', 'Give something in charity daily'],
      ar: ['أكثر من التكبير والتحميد والتهليل', 'صم ما تيسّر من التسعة', 'تصدّق كل يوم ولو بالقليل'],
      de: ['Sprich vermehrt Takbir, Tahmid und Tahlil', 'Faste, was dir von den neun Tagen möglich ist', 'Gib täglich etwas als Almosen'],
      fr: ['Multipliez le takbir, le tahmid et le tahlil', 'Jeûnez ce que vous pouvez des neuf jours', 'Donnez chaque jour en aumône'],
      es: ['Aumenta el takbir, el tahmid y el tahlil', 'Ayuna lo que puedas de los nueve días', 'Da limosna cada día'],
      ja: ['タクビール、タハミード、タハリールを多く唱える', '九日のうちできる日を断食する', '毎日なにかを施す'],
    },
  },
  {
    id: 'arafah', kind: 'hijri', hm: 12, hd: 9, span: 1, ic: '🏔️', tone: 'gold', star: true,
    name: { en: 'The Day of Arafah', ar: 'يوم عرفة', de: 'Der Tag von Arafa', fr: 'Le jour d’Arafa', es: 'El día de Arafa', ja: 'アラファの日' },
    what: {
      en: 'The ninth of Dhul-Hijjah. A confirmed sunnah to fast — for everyone except the pilgrim standing at Arafah.',
      ar: 'التاسع من ذي الحجّة، وصومه سنّة مؤكدة لغير الحاجّ الواقف بعرفة.',
      de: 'Der neunte des Dhul-Hiddscha. Zu fasten ist bestätigte Sunna — für alle außer dem Pilger, der in Arafa steht.',
      fr: 'Le neuvième jour de Dhoul-Hijja. Le jeûner est une sunna confirmée, sauf pour le pèlerin se tenant à Arafa.',
      es: 'El noveno de Dhul-Hiyya. Ayunarlo es sunna confirmada, salvo para el peregrino que está en Arafa.',
      ja: 'ズー・アルヒッジャ月の九日。アラファに立つ巡礼者を除き、断食は確立されたスンナです。',
    },
    thawab: {
      en: 'Fasting the Day of Arafah expiates the year before it and the year after it. (Muslim) — and there is no day on which Allah frees more people from the Fire.',
      ar: '«صيام يوم عرفة يُكفّر السنة الماضية والسنة الباقية». (رواه مسلم) — «وما من يوم أكثر من أن يُعتق الله فيه عبدًا من النار من يوم عرفة».',
      de: 'Das Fasten am Tag von Arafa sühnt das Jahr davor und das Jahr danach. (Muslim) — und an keinem Tag befreit Allah mehr Menschen vom Feuer.',
      fr: 'Le jeûne du jour d’Arafa expie l’année précédente et l’année suivante. (Mouslim) — et il n’est pas de jour où Allah affranchit plus de gens du Feu.',
      es: 'Ayunar el día de Arafa expía el año anterior y el siguiente. (Muslim), y no hay día en que Allah libere a más gente del Fuego.',
      ja: 'アラファの日の断食は前年と翌年を贖う。（ムスリム）またアッラーがこの日ほど多くの人を業火から解き放つ日はありません。',
    },
    todo: {
      en: ['Fast the day, if you are not on Hajj', 'The best du‘a is the du‘a of the Day of Arafah — ask much', 'Say: la ilaha illa Allah wahdahu la sharika lah…'],
      ar: ['صم اليوم إن لم تكن حاجًّا', '«خير الدعاء دعاء يوم عرفة» — فأكثر من الدعاء', 'أكثر من: «لا إله إلا الله وحده لا شريك له…»'],
      de: ['Faste den Tag, wenn du nicht auf Hadsch bist', 'Das beste Bittgebet ist das des Tages von Arafa — bitte viel', 'Sprich: la ilaha illa Allah wahdahu la scharika lah…'],
      fr: ['Jeûnez ce jour, si vous n’êtes pas en pèlerinage', 'La meilleure invocation est celle du jour d’Arafa — invoquez beaucoup', 'Dites : la ilaha illa Allah wahdahu la charika lah…'],
      es: ['Ayuna ese día, si no estás en el Hach', 'La mejor súplica es la del día de Arafa: pide mucho', 'Di: la ilaha illa Allah wahdahu la sharika lah…'],
      ja: ['巡礼中でなければこの日を断食する', '最良の祈願はアラファの日の祈願。多く祈る', '「ラー・イラーハ・イッラッラー…」を多く唱える'],
    },
  },
  {
    id: 'adha', kind: 'hijri', hm: 12, hd: 10, span: 1, ic: '🐑', tone: 'lapis',
    name: { en: 'Eid al-Adha', ar: 'عيد الأضحى', de: 'Eid al-Adha', fr: 'Aïd al-Adha', es: 'Eid al-Adha', ja: 'イード・アルアドハー' },
    what: {
      en: 'The day of sacrifice, and the greatest day of the year. Fasting it is not allowed.',
      ar: 'يوم النحر، وهو أعظم أيام السنة، ولا يجوز صومه.',
      de: 'Der Tag des Opfers und der größte Tag des Jahres. Zu fasten ist nicht erlaubt.',
      fr: 'Le jour du sacrifice, le plus grand jour de l’année. Le jeûner n’est pas permis.',
      es: 'El día del sacrificio y el día más grande del año. Ayunarlo no está permitido.',
      ja: '犠牲の日であり、一年で最も偉大な日。断食は許されません。',
    },
    thawab: {
      en: 'The greatest of days before Allah is the Day of Sacrifice. (Abu Dawud) — the udhiyah is a sunnah for whoever can afford it.',
      ar: '«إنّ أعظم الأيام عند الله يوم النحر». (رواه أبو داود) — والأضحية سنّة مؤكدة لمن قدر عليها.',
      de: 'Der größte Tag bei Allah ist der Tag des Opfers. (Abu Dawud) — die Udhiya ist Sunna für den, der sie sich leisten kann.',
      fr: 'Le plus grand des jours auprès d’Allah est le jour du Sacrifice. (Abou Dawoud) — l’oudhiya est une sunna pour qui en a les moyens.',
      es: 'El más grande de los días ante Allah es el día del Sacrificio. (Abu Dawud); la udhiya es sunna para quien pueda.',
      ja: 'アッラーの御許で最も偉大な日は犠牲の日。（アブー・ダーウード）余裕のある者にとってウドヒヤはスンナです。',
    },
    todo: {
      en: ['Pray the Eid prayer', 'Offer the udhiyah if you are able, and share it', 'Keep the takbir through the days of Tashriq'],
      ar: ['صلِّ صلاة العيد', 'ضحِّ إن استطعت وأطعم منها', 'أدم التكبير في أيام التشريق'],
      de: ['Verrichte das Eid-Gebet', 'Bringe die Udhiya dar, wenn du kannst, und teile davon', 'Halte den Takbir während der Taschriq-Tage'],
      fr: ['Accomplissez la prière de l’Aïd', 'Offrez l’oudhiya si vous le pouvez, et partagez-en', 'Maintenez le takbir durant les jours de Tachriq'],
      es: ['Reza la oración del Eid', 'Ofrece la udhiya si puedes, y repártela', 'Mantén el takbir durante los días de Tashriq'],
      ja: ['イードの礼拝を行う', '可能ならウドヒヤを捧げ、分け与える', 'タシュリークの日々もタクビールを続ける'],
    },
  },
  {
    id: 'muharram', kind: 'hijri', hm: 1, hd: 1, span: 1, ic: '🌘', tone: 'lapis',
    name: { en: 'Islamic New Year', ar: 'رأس السنة الهجرية', de: 'Islamisches Neujahr', fr: 'Nouvel An islamique', es: 'Año Nuevo islámico', ja: 'イスラーム暦の新年' },
    what: {
      en: 'The first of Muharram — one of the four sacred months.',
      ar: 'أول محرّم، وهو أحد الأشهر الحُرُم الأربعة.',
      de: 'Der erste des Muharram — einer der vier heiligen Monate.',
      fr: 'Le premier de Mouharram — l’un des quatre mois sacrés.',
      es: 'El primero de Muharram, uno de los cuatro meses sagrados.',
      ja: 'ムハッラム月の一日。四つの聖なる月のひとつです。',
    },
    thawab: {
      en: 'The best fasting after Ramadan is in Allah’s month, Muharram. (Muslim)',
      ar: '«أفضل الصيام بعد رمضان شهر الله المحرّم». (رواه مسلم)',
      de: 'Das beste Fasten nach dem Ramadan ist im Monat Allahs, dem Muharram. (Muslim)',
      fr: 'Le meilleur jeûne après le Ramadan est celui du mois d’Allah, Mouharram. (Mouslim)',
      es: 'El mejor ayuno después del Ramadán es el del mes de Allah, Muharram. (Muslim)',
      ja: 'ラマダーンの次に優れた断食は、アッラーの月ムハッラムの断食。（ムスリム）',
    },
    todo: {
      en: ['Fast what you can of Muharram', 'Take stock: what will you build this year?'],
      ar: ['صم ما تيسّر من محرّم', 'حاسب نفسك: ما الذي ستبنيه هذا العام؟'],
      de: ['Faste, was dir vom Muharram möglich ist', 'Zieh Bilanz: Was willst du dieses Jahr aufbauen?'],
      fr: ['Jeûnez ce que vous pouvez de Mouharram', 'Faites le point : que voulez-vous bâtir cette année ?'],
      es: ['Ayuna lo que puedas de Muharram', 'Haz balance: ¿qué vas a construir este año?'],
      ja: ['ムハッラムのうちできる日を断食する', '振り返る。今年は何を築くか'],
    },
  },
  {
    id: 'ashura', kind: 'hijri', hm: 1, hd: 9, span: 2, ic: '💧', tone: 'gold',
    name: { en: 'Tasu‘a & Ashura', ar: 'تاسوعاء وعاشوراء', de: 'Tasu‘a & Aschura', fr: 'Tasou‘a et Achoura', es: 'Tasu‘a y Ashura', ja: 'タースーアーとアーシューラー' },
    what: {
      en: 'The ninth and tenth of Muharram — fasted together, following the Prophet’s ﷺ intention.',
      ar: 'التاسع والعاشر من محرّم، يُصامان معًا موافقةً لعزم النبي ﷺ.',
      de: 'Der neunte und zehnte des Muharram — zusammen gefastet, dem Vorsatz des Propheten ﷺ folgend.',
      fr: 'Le neuvième et le dixième de Mouharram — jeûnés ensemble, suivant l’intention du Prophète ﷺ.',
      es: 'El noveno y el décimo de Muharram, ayunados juntos siguiendo la intención del Profeta ﷺ.',
      ja: 'ムハッラム月の九日と十日。預言者ﷺの意図に倣い、あわせて断食します。',
    },
    thawab: {
      en: 'Fasting the Day of Ashura — I hope from Allah that it expiates the year before it. (Muslim)',
      ar: '«صيام يوم عاشوراء أحتسب على الله أن يُكفّر السنة التي قبله». (رواه مسلم)',
      de: 'Das Fasten am Aschura-Tag — ich erhoffe von Allah, dass es das Jahr davor sühnt. (Muslim)',
      fr: 'Le jeûne du jour d’Achoura — j’espère d’Allah qu’il expie l’année qui l’a précédé. (Mouslim)',
      es: 'El ayuno del día de Ashura: espero de Allah que expíe el año anterior. (Muslim)',
      ja: 'アーシューラーの日の断食は、前年を贖うことをアッラーに望む。（ムスリム）',
    },
    todo: {
      en: ['Fast the ninth and the tenth together', 'If you only manage one, fast the tenth'],
      ar: ['صم التاسع والعاشر معًا', 'فإن لم تستطع إلا يومًا فصم العاشر'],
      de: ['Faste den neunten und zehnten zusammen', 'Schaffst du nur einen, faste den zehnten'],
      fr: ['Jeûnez le neuvième et le dixième ensemble', 'Si vous n’en pouvez qu’un, jeûnez le dixième'],
      es: ['Ayuna el noveno y el décimo juntos', 'Si solo puedes uno, ayuna el décimo'],
      ja: ['九日と十日をあわせて断食する', '一日しかできないなら十日を断食する'],
    },
  },
  {
    id: 'white', kind: 'monthly', hd: 13, span: 3, ic: '🌕', tone: 'lapis',
    name: { en: 'The white days', ar: 'الأيام البيض', de: 'Die weißen Tage', fr: 'Les jours blancs', es: 'Los días blancos', ja: '白い日々' },
    what: {
      en: 'The 13th, 14th and 15th of every Hijri month, when the moon is full.',
      ar: 'الثالث عشر والرابع عشر والخامس عشر من كل شهر هجري، حين يكتمل القمر.',
      de: 'Der 13., 14. und 15. jedes Hidschri-Monats, wenn der Mond voll ist.',
      fr: 'Les 13, 14 et 15 de chaque mois hégirien, quand la lune est pleine.',
      es: 'Los días 13, 14 y 15 de cada mes hiyrí, cuando la luna está llena.',
      ja: 'ヒジュラ暦の毎月13・14・15日、月が満ちる頃。',
    },
    thawab: {
      en: 'Fasting three days of each month is like fasting for a lifetime. (Bukhari & Muslim)',
      ar: '«صيام ثلاثة أيام من كل شهر صيام الدهر كله». (متفق عليه)',
      de: 'Drei Tage jedes Monats zu fasten ist wie ein Leben lang zu fasten. (Buchari & Muslim)',
      fr: 'Jeûner trois jours par mois équivaut à jeûner toute une vie. (Boukhari et Mouslim)',
      es: 'Ayunar tres días de cada mes es como ayunar toda la vida. (Bujari y Muslim)',
      ja: '毎月三日の断食は、生涯の断食に等しい。（ブハーリー、ムスリム）',
    },
    todo: {
      en: ['Fast all three if you can, or one', 'Keep suhoor — there is blessing in it'],
      ar: ['صم الثلاثة إن استطعت، أو يومًا منها', 'لا تدع السحور فإن فيه بركة'],
      de: ['Faste alle drei, wenn du kannst, sonst einen', 'Halte am Suhur fest — darin liegt Segen'],
      fr: ['Jeûnez les trois si vous pouvez, sinon un seul', 'Gardez le suhoor : il y a une bénédiction dedans'],
      es: ['Ayuna los tres si puedes, o uno', 'Mantén el suhoor: hay bendición en él'],
      ja: ['できれば三日、無理なら一日でも断食する', 'スフールを欠かさない。そこに祝福がある'],
    },
  },
  {
    id: 'monthu', kind: 'weekday', days: [1, 4], ic: '🌾', tone: 'lapis',
    name: { en: 'Monday & Thursday', ar: 'الاثنين والخميس', de: 'Montag & Donnerstag', fr: 'Lundi et jeudi', es: 'Lunes y jueves', ja: '月曜と木曜' },
    what: {
      en: 'The two days the Prophet ﷺ kept fasting through the year.',
      ar: 'اليومان اللذان كان النبي ﷺ يتحرّى صومهما طوال العام.',
      de: 'Die beiden Tage, an denen der Prophet ﷺ das ganze Jahr über fastete.',
      fr: 'Les deux jours que le Prophète ﷺ s’appliquait à jeûner toute l’année.',
      es: 'Los dos días que el Profeta ﷺ procuraba ayunar durante todo el año.',
      ja: '預言者ﷺが一年を通じて断食に努めた二つの日。',
    },
    thawab: {
      en: 'Deeds are presented on Monday and Thursday, and I like my deeds to be presented while I am fasting. (Tirmidhi)',
      ar: '«تُعرض الأعمال يوم الاثنين والخميس، فأحبّ أن يُعرض عملي وأنا صائم». (رواه الترمذي)',
      de: 'Die Taten werden montags und donnerstags vorgelegt, und ich habe es gern, dass meine Taten vorgelegt werden, während ich faste. (Tirmidhi)',
      fr: 'Les œuvres sont présentées le lundi et le jeudi, et j’aime que mes œuvres soient présentées alors que je jeûne. (Tirmidhi)',
      es: 'Las obras se presentan el lunes y el jueves, y me gusta que mis obras se presenten mientras ayuno. (Tirmidi)',
      ja: '行いは月曜と木曜に差し出される。私は断食しているあいだに自分の行いが差し出されることを好む。（ティルミズィー）',
    },
    todo: {
      en: ['Pick one of the two to begin with', 'Set the intention the night before'],
      ar: ['ابدأ بأحدهما', 'انوِ الصيام من الليل'],
      de: ['Beginne mit einem der beiden', 'Fasse die Absicht am Abend zuvor'],
      fr: ['Commencez par l’un des deux', 'Formulez l’intention la veille au soir'],
      es: ['Empieza por uno de los dos', 'Haz la intención la noche anterior'],
      ja: ['まずはどちらか一方から', '前夜に意図を立てる'],
    },
  },
  {
    id: 'jumuah', kind: 'weekday', days: [5], ic: '🕌', tone: 'gold',
    name: { en: 'Friday', ar: 'يوم الجمعة', de: 'Freitag', fr: 'Vendredi', es: 'Viernes', ja: '金曜日' },
    what: {
      en: 'The best day on which the sun rises — and it holds an hour in which du‘a is answered.',
      ar: 'خير يوم طلعت عليه الشمس، وفيه ساعة لا يُردّ فيها الدعاء.',
      de: 'Der beste Tag, an dem die Sonne aufgeht — und er birgt eine Stunde, in der das Bittgebet erhört wird.',
      fr: 'Le meilleur jour sur lequel le soleil se lève — il renferme une heure où l’invocation est exaucée.',
      es: 'El mejor día sobre el que sale el sol, y encierra una hora en la que la súplica es respondida.',
      ja: '太陽が昇る最良の日。祈願が応えられる一刻が含まれています。',
    },
    thawab: {
      en: 'Whoever reads Surah al-Kahf on Friday, a light shines for him between the two Fridays. (al-Hakim & al-Bayhaqi)',
      ar: '«مَن قرأ سورة الكهف يوم الجمعة أضاء له من النور ما بين الجمعتين». (رواه الحاكم والبيهقي)',
      de: 'Wer freitags die Sure al-Kahf liest, dem leuchtet ein Licht zwischen den beiden Freitagen. (al-Hakim & al-Baihaqi)',
      fr: 'Quiconque lit la sourate al-Kahf le vendredi, une lumière brille pour lui entre les deux vendredis. (al-Hakim et al-Bayhaqi)',
      es: 'Quien lea la sura al-Kahf el viernes, una luz brillará para él entre los dos viernes. (al-Hakim y al-Bayhaqi)',
      ja: '金曜に洞窟章（アル・カフフ）を読む者には、二つの金曜のあいだ光が輝く。（ハーキム、バイハキー）',
    },
    todo: {
      en: ['Read Surah al-Kahf', 'Send much peace upon the Prophet ﷺ', 'Seek the hour of response, late in the afternoon'],
      ar: ['اقرأ سورة الكهف', 'أكثر من الصلاة على النبي ﷺ', 'تحرَّ ساعة الإجابة في آخر النهار'],
      de: ['Lies die Sure al-Kahf', 'Sende viel Segen über den Propheten ﷺ', 'Suche die Stunde der Erhörung am späten Nachmittag'],
      fr: ['Lisez la sourate al-Kahf', 'Priez abondamment sur le Prophète ﷺ', 'Recherchez l’heure d’exaucement en fin d’après-midi'],
      es: ['Lee la sura al-Kahf', 'Envía mucha oración por el Profeta ﷺ', 'Busca la hora de respuesta al final de la tarde'],
      ja: ['洞窟章を読む', '預言者ﷺに多くの祝福を送る', '午後遅くの応答の一刻を求める'],
    },
  },
]

/* ---------------- when does it next fall? ---------------- */

/** The next (or currently running) occurrence of an event. */
export function nextOccurrence(ev, from = today()) {
  const t0 = from.getTime()

  if (ev.kind === 'weekday') {
    let best = null
    for (const wd of ev.days) {
      const delta = (wd - from.getDay() + 7) % 7
      const d = new Date(t0 + delta * DAY)
      if (!best || d < best) best = d
    }
    const wdDays = Math.round((best - t0) / DAY)
    return { start: best, end: best, days: wdDays, running: wdDays === 0 }
  }

  const h = toHijri(from)
  const tries = []
  if (ev.kind === 'monthly') {
    // this month and the next two
    for (let i = 0; i < 3; i++) {
      let m = h.m + i, y = h.y
      while (m > 12) { m -= 12; y += 1 }
      tries.push([y, m, ev.hd])
    }
  } else {
    tries.push([h.y, ev.hm, ev.hd], [h.y + 1, ev.hm, ev.hd])
  }

  for (const [y, m, d] of tries) {
    const start = fromHijri(y, m, d)
    if (!start) continue
    const end = new Date(start.getTime() + ((ev.span || 1) - 1) * DAY)
    if (end.getTime() >= t0) {
      // distance to the START — negative while a multi-day event is already running
      const days = Math.round((start.getTime() - t0) / DAY)
      return { start, end, days, running: days <= 0 }
    }
  }
  return null
}

/** Every event, soonest first, with its next date attached. */
export function upcoming(from = today()) {
  return EVENTS
    .map((ev) => ({ ev, ...(nextOccurrence(ev, from) || {}) }))
    .filter((x) => x.start)
    .sort((a, b) => a.days - b.days || (b.ev.star ? 1 : 0) - (a.ev.star ? 1 : 0))
}

/** Does this event START today? (what a reminder fires on) */
export const startsToday = (occ) => !!occ && occ.days === 0

/** Is this event under way today, whenever it began? */
export const isToday = (occ) => !!occ && occ.days <= 0 && occ.end.getTime() >= today().getTime()

/** Hijri date as a readable string, e.g. "9 Dhul-Hijjah 1447". */
export function hijriLabel(date, lang = 'en') {
  const h = toHijri(date)
  const months = HIJRI_MONTHS[lang === 'ar' ? 'ar' : 'en']
  return lang === 'ar' ? `${h.d} ${months[h.m - 1]} ${h.y}هـ` : `${h.d} ${months[h.m - 1]} ${h.y} AH`
}
