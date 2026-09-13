// Rashed — offline answer engine. Matches a question against a small knowledge base.
import { SITES } from './data'

const SITE_BY_D = Object.fromEntries(SITES.map((s) => [s.d, s]))
const ALL = SITES.map((s) => s.d)

/* normalise harakat and أ/إ/آ/ة spelling variants */
const HARAKAT = /[ً-ْٰـ]/g
export function norm(s = '') {
  return String(s).toLowerCase().trim()
    .replace(HARAKAT, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
}
const isLatin = (s) => /^[a-z0-9\s'-]+$/i.test(s)

/* k keywords · q question · s search phrase · a answer · steps · sites · next */
export const TOPICS = [
  {
    id: 'shahada',
    k: ['shahada', 'become muslim', 'becoming muslim', 'convert', 'revert', 'accept islam', 'new muslim', 'testimony of faith',
      'الشهاده', 'كيف اسلم', 'اريد ان اسلم', 'الدخول في الاسلام', 'اعتنق', 'مسلم جديد'],
    q: { en: 'How does someone become Muslim?', ar: 'كيف يدخل الإنسان في الإسلام؟' },
    a: {
      en: 'A person enters Islam by saying the shahada — "Ash-hadu an la ilaha illa Allah, wa ash-hadu anna Muhammadan rasul Allah" — believing it and understanding what it means. No ceremony, witness or paperwork is needed for it to be valid, though many say it at a mosque so the community can welcome them and help them learn. Accepting Islam wipes out what came before it, so you begin with a clean slate; the next steps are ghusl, then learning wudu and the prayer.',
      ar: 'يدخل الإنسان في الإسلام بالنطق بالشهادتين: «أشهد أن لا إله إلا الله، وأشهد أن محمدًا رسول الله» مع الإيمان بها وفهم معناها. ولا يُشترط لصحّتها حضور شهود ولا إجراء رسمي، وإن كان كثيرون ينطقون بها في المسجد ليعرفهم إخوانهم ويعينوهم. والإسلام يَجُبّ ما قبله، فتبدأ صفحة بيضاء؛ ثم الاغتسال، ثم تعلّم الوضوء والصلاة.',
    },
    sites: ['islamqa.info', 'binbaz.org.sa', 'islamweb.net'],
    next: ['wudu', 'salah', 'name_change'],
  },
  {
    id: 'pillars',
    k: ['pillars of islam', 'five pillars', 'pillars of iman', 'articles of faith', 'basics of islam', 'what do muslims believe',
      'اركان الاسلام', 'اركان الايمان', 'الاركان الخمسه', 'مباني الاسلام'],
    q: { en: 'What are the pillars of Islam and iman?', ar: 'ما أركان الإسلام وأركان الإيمان؟' },
    a: {
      en: 'Islam is built on five: the shahada, the five daily prayers, zakat, fasting Ramadan, and Hajj for whoever is able to make the journey. Faith (iman) has six articles: belief in God, His angels, His books, His messengers, the Last Day, and divine decree — its good and its bad.',
      ar: 'بُني الإسلام على خمسٍ: شهادة أن لا إله إلا الله وأنّ محمدًا رسول الله، وإقام الصلاة، وإيتاء الزكاة، وصوم رمضان، وحجّ البيت لمن استطاع إليه سبيلًا. وأركان الإيمان ستّة: أن تؤمن بالله وملائكته وكتبه ورسله واليوم الآخر، وبالقدر خيره وشرّه.',
    },
    sites: ['binbaz.org.sa', 'islamweb.net', 'islamqa.info'],
    next: ['salah', 'zakat', 'fasting'],
  },
  {
    id: 'wudu',
    k: ['wudu', 'wudhu', 'ablution', 'wash before prayer', 'purification', 'break wudu', 'nullify wudu',
      'الوضوء', 'كيف اتوضا', 'صفه الوضوء', 'نواقض الوضوء', 'الطهاره'],
    q: { en: 'How do I perform wudu?', ar: 'كيف أتوضأ؟' },
    s: 'صفة الوضوء وفروضه',
    a: {
      en: 'Wudu is the washing done before prayer. Four parts are obligatory in the Qur’an — the face, the arms to the elbows, wiping the head, and the feet to the ankles — and the rest is the practice of the Prophet ﷺ. It stays valid until something breaks it, such as using the toilet, passing wind, or deep sleep.',
      ar: 'الوضوء طهارةٌ تسبق الصلاة، وفروضه في القرآن أربعة: غسل الوجه، وغسل اليدين إلى المرفقين، ومسح الرأس، وغسل الرجلين إلى الكعبين، وما سواها من سنن النبي ﷺ. ويبقى الوضوء صحيحًا حتى ينتقض بنحو قضاء الحاجة أو خروج الريح أو النوم العميق.',
    },
    steps: {
      en: ['Intend it in your heart and say Bismillah', 'Wash both hands three times', 'Rinse the mouth three times, then the nose three times', 'Wash the face three times', 'Wash the right arm to the elbow three times, then the left', 'Wipe the head once with wet hands, and the ears with it', 'Wash the right foot to the ankle three times, then the left'],
      ar: ['انوِ بقلبك وقل: بسم الله', 'اغسل كفّيك ثلاثًا', 'تمضمض ثلاثًا ثم استنشق ثلاثًا', 'اغسل وجهك ثلاثًا', 'اغسل يدك اليمنى إلى المرفق ثلاثًا ثم اليسرى', 'امسح رأسك مرة واحدة ومعه أذناك', 'اغسل رجلك اليمنى إلى الكعب ثلاثًا ثم اليسرى'],
    },
    sites: ['binbaz.org.sa', 'islamqa.info', 'binothaimeen.net'],
    next: ['tayammum', 'ghusl', 'salah'],
  },
  {
    id: 'ghusl',
    k: ['ghusl', 'full bath', 'janabah', 'major impurity',
      'الغسل', 'الجنابه', 'كيف اغتسل', 'غسل الجنابه'],
    q: { en: 'How is ghusl performed?', ar: 'كيف أغتسل من الجنابة؟' },
    s: 'صفة غسل الجنابة',
    a: {
      en: 'Ghusl is the full-body washing required after marital relations, a wet dream, and at the end of menstruation or post-natal bleeding. Its essential part is that water reaches the whole body once, with the intention. The complete way is: wash the hands, wash the private parts, perform wudu, pour water over the head three times working it into the roots of the hair, then wash the rest of the body.',
      ar: 'الغسل طهارةٌ تعمّ البدن، ويجب بالجماع والإنزال وانقطاع الحيض والنفاس. وركنه أن يصل الماء إلى جميع البدن مرّة مع النيّة. وصفته الكاملة: يغسل يديه، ثم فرجه، ثم يتوضأ، ثم يُفيض الماء على رأسه ثلاثًا يُروي بها أصول الشعر، ثم يغسل سائر جسده.',
    },
    sites: ['binbaz.org.sa', 'islamqa.info'],
    next: ['wudu', 'menses'],
  },
  {
    id: 'tayammum',
    k: ['tayammum', 'no water', 'dry ablution',
      'التيمم', 'لا يوجد ماء', 'كيف اتيمم'],
    q: { en: 'How do I perform tayammum?', ar: 'كيف أتيمم عند فقد الماء؟' },
    a: {
      en: 'Tayammum replaces wudu and ghusl when there is no water, or when using it would harm you because of illness or severe cold. Strike clean earth or dust once with both palms, wipe your face, then wipe the backs of your hands. It is valid for as long as the excuse lasts, and ends when water becomes available.',
      ar: 'التيمم بدلٌ عن الوضوء والغسل عند عدم الماء، أو عند الضرر باستعماله لمرضٍ أو بردٍ شديد. وصفته: تضرب بيديك التراب الطاهر ضربةً واحدة، ثم تمسح وجهك، ثم تمسح ظاهر كفّيك. ويبقى صحيحًا ما دام العذر قائمًا، وينتهي بوجود الماء.',
    },
    sites: ['binbaz.org.sa', 'islamqa.info'],
    next: ['wudu', 'salah'],
  },
  {
    id: 'salah',
    k: ['pray', 'prayer', 'salah', 'salat', 'how to pray', 'rakah', 'rakat', 'sujud', 'ruku', 'learn to pray',
      'الصلاه', 'كيف اصلي', 'صفه الصلاه', 'ركعات', 'الركوع', 'السجود'],
    q: { en: 'How do I pray?', ar: 'كيف أصلي؟' },
    s: 'صفة الصلاة كاملة',
    a: {
      en: 'There are five obligatory prayers a day: Fajr is 2 rak‘ahs, Dhuhr 4, Asr 4, Maghrib 3, and Isha 4. Before you begin you need wudu, clean clothes and place, your body covered, the time to have entered, and to face the qiblah. A rak‘ah is: takbir and recitation standing, then bowing, standing up again, and two prostrations — and the prayer ends with the tashahhud and the salam to each side.',
      ar: 'الصلوات المفروضة خمسٌ في اليوم: الفجر ركعتان، والظهر أربع، والعصر أربع، والمغرب ثلاث، والعشاء أربع. ويُشترط قبلها الوضوء وطهارة الثوب والمكان وستر العورة ودخول الوقت واستقبال القبلة. وصفة الركعة: تكبيرٌ وقراءةٌ في القيام، ثم ركوع، ثم اعتدال، ثم سجدتان — وتُختم الصلاة بالتشهد والتسليم عن اليمين والشمال.',
    },
    sites: ['binbaz.org.sa', 'binothaimeen.net', 'islamqa.info'],
    next: ['prayer_times', 'missed_prayer', 'jumuah'],
  },
  {
    id: 'prayer_times',
    k: ['prayer time', 'prayer times', 'when to pray', 'fajr', 'dhuhr', 'zuhr', 'asr', 'maghrib', 'isha', 'qibla', 'qiblah', 'direction of prayer',
      'مواقيت الصلاه', 'وقت الصلاه', 'متي اصلي', 'القبله', 'اتجاه القبله', 'الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'],
    q: { en: 'What are the prayer times?', ar: 'مواقيت الصلاة الخمس' },
    a: {
      en: 'The times follow the sun, so they shift a little every day. Fajr runs from true dawn until sunrise; Dhuhr from just after the sun passes its peak until an object’s shadow equals its own length; Asr from then until sunset; Maghrib from sunset until the red twilight fades; and Isha from then until midnight, and in necessity until Fajr. You face the qiblah — the direction of the Ka‘bah in Makkah.',
      ar: 'مواقيت الصلاة تابعةٌ للشمس فتتغيّر قليلًا كل يوم. فالفجر من طلوع الفجر الصادق إلى شروق الشمس، والظهر من زوال الشمس إلى أن يصير ظلّ الشيء مثله، والعصر من ذلك إلى غروب الشمس، والمغرب من الغروب إلى مغيب الشفق الأحمر، والعشاء من ذلك إلى منتصف الليل وللضرورة إلى الفجر. وتستقبل القبلة، وهي جهة الكعبة بمكة.',
    },
    sites: ['binbaz.org.sa', 'islamweb.net'],
    next: ['salah', 'missed_prayer'],
  },
  {
    id: 'missed_prayer',
    k: ['missed', 'missed prayer', 'missed prayers', 'make up prayer', 'qada', 'overslept', 'slept through', 'late for prayer', 'before i was muslim',
      'قضاء الصلاه', 'فاتتني', 'فاتني', 'نمت عن الصلاه', 'ترك الصلاه'],
    q: { en: 'What do I do about missed prayers?', ar: 'حكم قضاء الصلاة الفائتة' },
    a: {
      en: 'If you slept through a prayer or forgot it, pray it as soon as you remember — the Prophet ﷺ said that is its time, and there is no blame in it. The prayers of your life before Islam are not made up at all: accepting Islam wipes out what came before. For prayers deliberately abandoned after Islam, scholars differ on making them up, so put your own case to one directly.',
      ar: 'من نام عن صلاةٍ أو نسيها فليصلّها إذا ذكرها، فقد قال النبي ﷺ إنّ ذلك وقتها ولا كفّارة لها غير ذلك. وأمّا ما مضى قبل الإسلام فلا يُقضى؛ فالإسلام يَجُبّ ما قبله. وأمّا من تركها عمدًا بعد إسلامه ففي قضائها خلافٌ بين أهل العلم، فيُسأل عالمٌ في حالته.',
    },
    sites: ['binbaz.org.sa', 'islamqa.info', 'binothaimeen.net'],
    next: ['salah', 'prayer_times'],
  },
  {
    id: 'jumuah',
    k: ['jumuah', 'jumma', 'friday prayer', 'khutbah',
      'الجمعه', 'صلاه الجمعه', 'الخطبه'],
    q: { en: 'What is the Friday prayer?', ar: 'صلاة الجمعة وأحكامها' },
    a: {
      en: 'Jumu‘ah is obligatory on adult Muslim men in congregation, and it takes the place of Dhuhr that day — a khutbah followed by two rak‘ahs. Ghusl, clean clothes, perfume and coming early are all from the sunnah, and once the khatib begins you listen rather than talk. Women may attend but it is not obligatory on them.',
      ar: 'صلاة الجمعة واجبةٌ على الرجال المسلمين البالغين في جماعة، وتقوم مقام الظهر ذلك اليوم، وهي خطبةٌ ثم ركعتان. ومن السنّة الاغتسال ولبس أحسن الثياب والتطيّب والتبكير، فإذا شرع الخطيب أنصت المصلّي ولم يتكلّم. وللنساء الحضور ولا تجب عليهنّ.',
    },
    sites: ['binbaz.org.sa', 'islamweb.net'],
    next: ['salah', 'mosque'],
  },
  {
    id: 'mosque',
    k: ['mosque', 'masjid', 'etiquette', 'visit a mosque', 'shoes',
      'المسجد', 'اداب المسجد', 'دخول المسجد', 'تحيه المسجد'],
    q: { en: 'What are the manners of the mosque?', ar: 'آداب دخول المسجد' },
    a: {
      en: 'Enter with the right foot and the du‘a for entering, leave your shoes at the rack, and pray two rak‘ahs of tahiyyat al-masjid before sitting. Keep your voice and your phone down, fill the gaps in the rows, and don’t walk in front of someone praying. If you are new, say so — people are usually glad to show you where to stand.',
      ar: 'يُستحب دخول المسجد بالرجل اليمنى مع دعاء الدخول، وتُترك النعال في مكانها، ويصلّي الداخل ركعتين تحيةً للمسجد قبل أن يجلس. ويخفض صوته وهاتفه، ويسدّ الفُرَج في الصفوف، ولا يمرّ بين يدي المصلّي. وإن كنت حديث عهدٍ بالإسلام فأخبر من بجوارك، فأهل المسجد يفرحون بإعانتك.',
    },
    sites: ['islamweb.net', 'islamqa.info'],
    next: ['jumuah', 'salah'],
  },
  {
    id: 'quran',
    k: ['quran', 'qur an', 'koran', 'read quran', 'memorise', 'memorize', 'surah', 'ayah', 'tajweed', 'recite', 'translation',
      'القران', 'قراءه القران', 'حفظ القران', 'سوره', 'ايه', 'التجويد', 'الترتيل', 'ترجمه القران'],
    q: { en: 'How should I start reading the Qur’an?', ar: 'كيف أبدأ قراءة القرآن وتعلّمه؟' },
    a: {
      en: 'Start with al-Fatihah, because you need it in every prayer, then the short surahs at the end of the Mushaf and work backwards. Read slowly and out loud where you can — the Qur’an was meant to be heard — and listen to a reciter for the same passage to fix the sounds. A translation carries the meaning but is not the Qur’an itself, so keep the Arabic beside it even while you are still learning the letters.',
      ar: 'ابدأ بالفاتحة فإنّها لا تصحّ الصلاة إلّا بها، ثم قصار السور من آخر المصحف وارجع إلى ما قبلها. واقرأ متأنّيًا جاهرًا ما استطعت فالقرآن أُنزل ليُسمَع، واستمع لقارئٍ متقنٍ للموضع نفسه ليستقيم لسانك. والترجمة نقلٌ للمعنى وليست قرآنًا، فأبقِ النصّ العربيّ إلى جوارها ولو كنت في أول تعلّم الحروف.',
    },
    sites: ['binbaz.org.sa', 'islamweb.net', 'islamqa.info'],
    next: ['dua', 'names_of_allah'],
  },
  {
    id: 'fasting',
    k: ['fast', 'fasting', 'ramadan', 'suhoor', 'iftar', 'sawm',
      'الصيام', 'الصوم', 'رمضان', 'السحور', 'الافطار', 'مفطرات'],
    q: { en: 'How does fasting in Ramadan work?', ar: 'أحكام صيام رمضان' },
    a: {
      en: 'Fasting Ramadan is obligatory on every adult Muslim who is able. You abstain from food, drink and marital relations from true dawn until sunset, and break the fast as soon as the sun sets. Suhoor before dawn is a sunnah and a help. Illness, travel, menstruation, pregnancy and nursing are excuses to break it, and those days are made up later.',
      ar: 'صوم رمضان فرضٌ على كل مسلمٍ بالغٍ قادر. يمسك الصائم عن الطعام والشراب والجماع من طلوع الفجر إلى غروب الشمس، ويعجّل الفطر إذا غابت الشمس. والسحور سنّةٌ وبركة. والمرض والسفر والحيض والحمل والرضاع أعذارٌ للفطر، وتُقضى تلك الأيام بعد ذلك.',
    },
    sites: ['binbaz.org.sa', 'islamqa.info', 'islamweb.net'],
    next: ['arafah', 'ashura', 'zakat'],
  },
  {
    id: 'arafah',
    k: ['arafah', 'arafat', 'day of arafah', 'dhul hijjah',
      'عرفه', 'يوم عرفه', 'صيام يوم عرفه', 'فضل صيام يوم عرفه'],
    q: { en: 'What is the virtue of fasting the Day of Arafah?', ar: 'فضل صيام يوم عرفة' },
    a: {
      en: 'Fasting the Day of Arafah — the ninth of Dhul-Hijjah — is a confirmed sunnah for anyone not on Hajj, and the Prophet ﷺ said it expiates the year before it and the year after it (Muslim). A pilgrim standing at Arafah does not fast that day, so that he keeps his strength for the du‘a.',
      ar: 'صيام يوم عرفة — التاسع من ذي الحجة — سنّة مؤكدة لغير الحاجّ، وقد أخبر النبي ﷺ أنه يُكفّر ذنوب سنة ماضية وسنة قادمة (رواه مسلم). أمّا الحاجّ الواقف بعرفة فلا يُشرع له صومه ليتقوّى على الذكر والدعاء.',
    },
    sites: ['binbaz.org.sa', 'islamqa.info', 'islamweb.net', 'binothaimeen.net'],
    next: ['fasting', 'hajj'],
  },
  {
    id: 'ashura',
    k: ['ashura', 'muharram',
      'عاشوراء', 'محرم', 'صيام عاشوراء'],
    q: { en: 'What is the fast of Ashura?', ar: 'فضل صيام عاشوراء' },
    a: {
      en: 'Ashura is the tenth of Muharram. The Prophet ﷺ fasted it and said he hoped it expiates the year before it, and he intended to fast the ninth along with it — so fasting the ninth and tenth together is what is recommended.',
      ar: 'عاشوراء هو اليوم العاشر من محرم، صامه النبي ﷺ وأخبر أنه يحتسب على الله أن يُكفّر السنة التي قبله، وعزم على صيام التاسع معه — فالمستحبّ صيام التاسع والعاشر.',
    },
    sites: ['binbaz.org.sa', 'islamqa.info'],
    next: ['fasting', 'arafah'],
  },
  {
    id: 'zakat',
    k: ['zakat', 'zakah', 'charity', 'nisab', 'sadaqah', 'zakat al fitr',
      'الزكاه', 'النصاب', 'زكاه المال', 'زكاه الفطر', 'الصدقه'],
    q: { en: 'How much zakat do I pay?', ar: 'أحكام زكاة المال والنصاب' },
    a: {
      en: 'Zakat is 2.5% of the wealth you have held for a full lunar year, once it reaches the nisab — the value of 85 grams of gold or 595 grams of silver. It is owed on cash, savings, gold and trade goods, not on the home you live in or the things you use. The Qur’an names the eight kinds of people it goes to (9:60). Zakat al-Fitr is separate: a measure of staple food per person at the end of Ramadan.',
      ar: 'الزكاة ربع العشر (٢٫٥٪) مما حال عليه الحول من المال إذا بلغ النصاب، وهو ما يعادل ٨٥ جرامًا من الذهب أو ٥٩٥ جرامًا من الفضة. وتجب في النقود والمدّخرات والذهب وعروض التجارة، لا في مسكنك وحوائجك الأصلية. وقد سمّى الله مصارفها الثمانية في سورة التوبة (٦٠). وزكاة الفطر مستقلّة عنها: صاعٌ من طعام عن كل نفسٍ في آخر رمضان.',
    },
    sites: ['binbaz.org.sa', 'islamqa.info', 'islamweb.net'],
    next: ['fasting', 'riba'],
  },
  {
    id: 'hajj',
    k: ['hajj', 'umrah', 'pilgrimage', 'kaaba', 'ihram', 'tawaf', 'makkah', 'mecca',
      'الحج', 'العمره', 'الكعبه', 'الاحرام', 'الطواف', 'مكه'],
    q: { en: 'What are Hajj and Umrah?', ar: 'أحكام الحج والعمرة' },
    a: {
      en: 'Hajj is the pilgrimage to Makkah in Dhul-Hijjah, obligatory once in a lifetime on whoever is physically and financially able to make the journey safely. Umrah is the shorter visit and can be done at any time of year. Both begin with ihram at a fixed point and centre on the tawaf around the Ka‘bah and the sa‘y between Safa and Marwah.',
      ar: 'الحج قصد مكة في ذي الحجة، وهو فرضٌ في العمر مرّة على المستطيع ببدنه وماله وأمن طريقه. والعمرة أخفّ منه وتصحّ في كل وقتٍ من السنة. وكلاهما يبدأ بالإحرام من الميقات، ومدارهما على الطواف بالكعبة والسعي بين الصفا والمروة.',
    },
    sites: ['binbaz.org.sa', 'islamweb.net'],
    next: ['arafah', 'pillars'],
  },
  {
    id: 'halal_food',
    k: ['halal', 'haram food', 'pork', 'gelatin', 'gelatine', 'rennet', 'carmine', 'e120', 'whey', 'meat', 'slaughter', 'ingredient', 'ingredients', 'can i eat', 'is it halal',
      'حلال', 'حرام', 'خنزير', 'جيلاتين', 'انفحه', 'قرمز', 'لحم', 'ذبيحه', 'مكونات', 'اكل'],
    q: { en: 'Which foods are halal and which are haram?', ar: 'أحكام الأطعمة الحلال والحرام والمكوّنات المشبوهة' },
    a: {
      en: 'The default for food is permission — what is forbidden is named: pork and everything from the pig, blood, carrion, anything slaughtered without God’s name, and intoxicants. In practice the things to watch on a label are gelatin, animal rennet in cheese, carmine (E120), and mono- and di-glycerides (E471/2), because each can be plant or animal. The meat of the People of the Book has detail the scholars discuss, so read it there.',
      ar: 'الأصل في الأطعمة الحِلّ، والمحرّم منصوصٌ عليه: الخنزير وما تفرّع عنه، والدم، والميتة، وما أُهلّ لغير الله به، والمسكرات. والذي يُنتبه له في المكوّنات عادةً: الجيلاتين، والأنفحة الحيوانية في الجبن، والقرمز (E120)، والمستحلبات (E471/2)، لأنّ كلًّا منها قد يكون نباتيًا وقد يكون حيوانيًا. وفي ذبائح أهل الكتاب تفصيلٌ عند أهل العلم فارجع إليه.',
    },
    sites: ['islamqa.info', 'binbaz.org.sa', 'islamweb.net', 'binothaimeen.net'],
    next: ['alcohol', 'riba'],
  },
  {
    id: 'alcohol',
    k: ['alcohol', 'ethanol', 'wine', 'beer', 'vanilla extract', 'intoxicant',
      'كحول', 'خمر', 'مسكر', 'نبيذ', 'بيره'],
    q: { en: 'Is alcohol in food or products haram?', ar: 'حكم الكحول في الأطعمة والمنتجات' },
    a: {
      en: 'Drinking any intoxicant is forbidden, in a little as much as in a lot — the Prophet ﷺ said that whatever intoxicates in a large amount, a small amount of it is forbidden. Scholars distinguish that from the traces of ethanol used as a solvent in flavourings, perfume or medicine, which most treat differently because they do not intoxicate and are not drunk as wine. That distinction is exactly the kind of detail to read in full at the source.',
      ar: 'شرب المسكر حرامٌ قليله وكثيره، قال ﷺ: «ما أسكر كثيره فقليله حرام». وفرّق أهل العلم بين ذلك وبين آثار الكحول المستخدم مذيبًا في النكهات والعطور والأدوية، فأكثرهم يعطيه حكمًا آخر لأنه لا يُسكر ولا يُشرب شرب الخمر. وهذا من التفصيل الذي يُقرأ كاملًا في المصدر.',
    },
    sites: ['islamqa.info', 'islamweb.net', 'binbaz.org.sa'],
    next: ['halal_food'],
  },
  {
    id: 'riba',
    k: ['riba', 'interest', 'mortgage', 'loan', 'bank', 'credit card', 'insurance', 'investment',
      'الربا', 'الفائده', 'قرض', 'البنك', 'التمويل', 'التامين', 'بطاقه ائتمان'],
    q: { en: 'Is bank interest riba?', ar: 'حكم الفوائد البنكية والربا' },
    a: {
      en: 'Riba — a fixed increase paid for the use of money — is prohibited in the Qur’an in the strongest terms, and that covers the interest on a conventional loan or savings account, whether you pay it or receive it. What to do about a mortgage you already hold, a credit card you clear every month, or interest already sitting in an account are real questions with detailed answers, and a new Muslim in that position should put the specifics to a scholar rather than to a summary.',
      ar: 'الربا — وهو الزيادة المشروطة في مقابل الأجل أو المال — محرّمٌ بنصّ القرآن وبأشدّ الوعيد، ويدخل فيه فوائد القروض والحسابات البنكية أخذًا وإعطاءً. وأمّا التصرّف في قرضٍ عقاريٍّ قائم، أو بطاقةٍ تُسدَّد كل شهر، أو فوائد متراكمة في حساب، فمسائل لها تفصيل، ومن كان في هذه الحال فليعرض تفاصيلها على عالمٍ لا على جوابٍ مختصر.',
    },
    sites: ['islamqa.info', 'binbaz.org.sa', 'islamweb.net'],
    next: ['zakat', 'halal_food'],
  },
  {
    id: 'hijab',
    k: ['hijab', 'headscarf', 'awrah', 'modesty', 'dress', 'clothing', 'what to wear',
      'الحجاب', 'اللباس', 'العوره', 'ستر', 'الزينه'],
    q: { en: 'What are the rules of dress in Islam?', ar: 'أحكام لباس المسلم والحجاب' },
    a: {
      en: 'Both men and women are asked to dress modestly, and not in what is see-through or clinging. For a man the minimum is from the navel to the knee; for a woman, covering in front of men who are not her mahram, which the majority of scholars take to include the hair. Where the ruling on the face and hands falls is a known difference between them, and how a new Muslim moves towards it is itself a question they answer.',
      ar: 'الرجل والمرأة مأموران بالحشمة في اللباس وتَرْكِ ما يصف أو يشفّ. فأقلّ ما يستره الرجل من السرّة إلى الركبة، والمرأة تستر بدنها أمام غير محارمها، ويدخل في ذلك الشعر عند جمهور أهل العلم. وأمّا الوجه والكفّان ففيهما خلافٌ معروف بينهم. ومن أسلمت حديثًا وأرادت التدرّج فلها في كلام أهل العلم جواب.',
    },
    sites: ['islamqa.info', 'binbaz.org.sa', 'islamweb.net'],
    next: ['family', 'shahada'],
  },
  {
    id: 'family',
    k: ['parents', 'family', 'non muslim family', 'mother', 'father', 'tell my family', 'marriage', 'spouse', 'husband', 'wife',
      'الوالدين', 'الاسره', 'امي', 'ابي', 'اهلي', 'الزواج', 'بر الوالدين'],
    q: { en: 'How do I treat my non-Muslim family?', ar: 'بر الوالدين غير المسلمين ومعاملة الأهل' },
    a: {
      en: 'Kindness to parents is obligatory whether or not they are Muslim. The Qur’an addresses this exact case: even if they press you to associate others with God — which you do not obey them in — "keep company with them in this world in kindness" (31:15). Be patient with the first reaction, keep visiting and helping them, and let them see the change in your character before they hear the argument.',
      ar: 'برّ الوالدين واجبٌ سواءٌ كانا مسلمَين أم لا. وقد نصّ القرآن على هذه الحال بعينها: فإن جاهداك على الشرك فلا تطعهما، ومع ذلك ﴿وَصَاحِبْهُمَا فِي الدُّنْيَا مَعْرُوفًا﴾ (لقمان: ١٥). فاصبر على ما يكون منهما أول الأمر، ودُم على زيارتهما وخدمتهما، وليروا أثر الإسلام في خُلقك قبل أن يسمعوا منك الحجّة.',
    },
    sites: ['islamqa.info', 'binbaz.org.sa', 'islamweb.net'],
    next: ['shahada', 'dua'],
  },
  {
    id: 'name_change',
    k: ['change my name', 'new name', 'muslim name', 'name after converting',
      'تغيير الاسم', 'اسم المسلم الجديد', 'تسميه'],
    q: { en: 'Do I have to change my name when I become Muslim?', ar: 'هل يلزم من أسلم تغيير اسمه؟' },
    a: {
      en: 'No. A convert keeps their name, and stays attributed to their father — that part is required, not optional. A name is only changed if its meaning is bad or implies worship of other than God; the Prophet ﷺ changed names of that kind and left the rest as they were.',
      ar: 'لا يلزم ذلك. فمن أسلم يبقى على اسمه، ويبقى منسوبًا إلى أبيه، وهذا واجبٌ لا خيار فيه. وإنما يُغيَّر الاسم إذا كان معناه قبيحًا أو فيه تعبيدٌ لغير الله؛ فقد غيّر النبي ﷺ أسماءً من هذا النوع وأقرّ ما سواها.',
    },
    sites: ['islamqa.info', 'binbaz.org.sa'],
    next: ['shahada', 'family'],
  },
  {
    id: 'dua',
    k: ['dua', 'supplication', 'dhikr', 'zikr', 'tasbih', 'remembrance', 'adhkar', 'istighfar',
      'الدعاء', 'الذكر', 'الاذكار', 'التسبيح', 'الاستغفار'],
    q: { en: 'How do I make du‘a?', ar: 'آداب الدعاء وأوقات الإجابة' },
    a: {
      en: 'Ask God directly, in any language, at any time — there is no intermediary. Begin by praising Him and sending peace on the Prophet ﷺ, ask with certainty that you will be answered, and repeat it. The times most hoped for are in prostration, in the last third of the night, between the adhan and the iqamah, and in the last hour of Friday.',
      ar: 'ادعُ الله مباشرةً، بأيّ لغةٍ وفي أيّ وقت، فليس بينك وبينه واسطة. وابدأ بحمده والصلاة على نبيّه ﷺ، وادعُ وأنت موقنٌ بالإجابة، وكرّر الدعاء. ومن أرجى الأوقات: السجود، وثلث الليل الآخر، وبين الأذان والإقامة، وآخر ساعة من يوم الجمعة.',
    },
    sites: ['binbaz.org.sa', 'islamweb.net', 'islamqa.info'],
    next: ['names_of_allah', 'quran'],
  },
  {
    id: 'names_of_allah',
    k: ['99 names', 'names of allah', 'asma ul husna', 'beautiful names',
      'اسماء الله الحسني', 'التسعه والتسعين', 'اسماء الله'],
    q: { en: 'What are the 99 names of Allah?', ar: 'أسماء الله الحسنى ومعانيها' },
    a: {
      en: 'The Prophet ﷺ said that God has ninety-nine names, and whoever takes them in — learning them, believing in them and living by what they mean — enters Paradise. They are not a single printed list handed down in one hadith; the well-known list was compiled by scholars from the Qur’an and the sunnah, which is why versions of it differ slightly.',
      ar: 'قال النبي ﷺ إنّ لله تسعةً وتسعين اسمًا، من أحصاها دخل الجنة — والإحصاء حفظها وفهم معانيها والتعبّد لله بها. وليست قائمةً مسرودةً في حديثٍ واحد، وإنما جمعها أهل العلم من الكتاب والسنّة، ولذلك اختلفت رواياتها قليلًا.',
    },
    sites: ['binbaz.org.sa', 'islamweb.net'],
    next: ['dua', 'quran'],
  },
  {
    id: 'menses',
    k: ['period', 'menstruation', 'menses', 'hayd', 'nifas', 'pregnant',
      'الحيض', 'الدوره', 'النفاس', 'العاده الشهريه'],
    q: { en: 'What does a woman do during her period?', ar: 'أحكام الحائض في الصلاة والصيام' },
    a: {
      en: 'During menstruation and post-natal bleeding a woman does not pray and does not fast. The prayers are not made up afterwards — that is a mercy, not a debt — but the days of fasting are. When the bleeding ends she makes ghusl and resumes. Whether she may recite from memory or hold the Mushaf is a difference among the scholars.',
      ar: 'الحائض والنفساء لا تصلّي ولا تصوم. ولا تقضي الصلاة بعد الطهر — وهذا تخفيفٌ لا دَين — وتقضي أيام الصوم. فإذا انقطع الدم اغتسلت وعادت إلى عبادتها. وأمّا قراءتها عن ظهر قلبٍ أو مسّها المصحف ففيه خلافٌ بين أهل العلم.',
    },
    sites: ['islamqa.info', 'binbaz.org.sa', 'islamweb.net'],
    next: ['ghusl', 'fasting'],
  },
]

const BY_ID = Object.fromEntries(TOPICS.map((tp) => [tp.id, tp]))

/* score by keywords hit; longer keywords are worth more */
function score(topic, q) {
  let s = 0
  for (const kw of topic.k) {
    const k = norm(kw)
    if (!k) continue
    const hit = isLatin(k) ? new RegExp(`(^| )${k}( |$)`).test(q) : q.includes(k)
    if (hit) s += Math.max(4, k.length)
  }
  // the canonical question — tapped as a chip, or typed verbatim — always wins
  for (const l of ['en', 'ar']) if (q === norm(topic.q[l])) s += 100
  return s
}

const MIN_SCORE = 4

export function match(query) {
  const q = norm(query)
  if (!q) return null
  let best = null
  let bestScore = 0
  for (const tp of TOPICS) {
    const s = score(tp, q)
    if (s > bestScore) { bestScore = s; best = tp }
  }
  return bestScore >= MIN_SCORE ? { topic: best, score: bestScore } : null
}

/* search each site with the topic's Arabic phrasing — these sites are in Arabic */
function sourceList(domains, phrase) {
  return domains.map((d) => ({
    ...(SITE_BY_D[d] || { n: d, d }),
    url: `https://www.google.com/search?q=${encodeURIComponent(`site:${d} ${phrase}`)}`,
  }))
}

/** answer offline; text is null when nothing matches, caller supplies the fallback */
export function answer(query, lang = 'en') {
  const L = lang === 'ar' ? 'ar' : 'en'
  const m = match(query)
  if (!m) {
    return {
      id: null,
      matched: false,
      text: null,
      steps: null,
      sources: sourceList(ALL, query),
      followups: ['salah', 'wudu', 'quran'].map((id) => BY_ID[id].q[L]),
    }
  }
  const tp = m.topic
  return {
    id: tp.id,
    matched: true,
    text: tp.a[L],
    steps: tp.steps ? tp.steps[L] : null,
    sources: sourceList(tp.sites, tp.s || tp.q.ar),
    followups: (tp.next || []).map((id) => BY_ID[id] && BY_ID[id].q[L]).filter(Boolean),
  }
}

/** Opening suggestion chips. */
export function starters(lang = 'en', ids = ['shahada', 'wudu', 'salah', 'quran']) {
  const L = lang === 'ar' ? 'ar' : 'en'
  return ids.map((id) => BY_ID[id].q[L])
}
