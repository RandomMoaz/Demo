// Journey — gamified daily quests, saved in localStorage. No login.

// quest: { id, ar, en, xp, icon, cat }
const PRAYERS_QUESTS = [
  { id: 'fajr', ar: 'صلاة الفجر', en: 'Pray Fajr', xp: 12, icon: '🌅',
    thawabAr: 'مَن صلّى الفجر في جماعة فهو في ذمّة الله.', thawabEn: 'Whoever prays Fajr in congregation is under the protection of Allah.' },
  { id: 'dhuhr', ar: 'صلاة الظهر', en: 'Pray Dhuhr', xp: 10, icon: '🕌',
    thawabAr: 'الصلوات الخمس كفّارة لما بينهنّ ما اجتُنبت الكبائر.', thawabEn: 'The five prayers erase what is between them, so long as major sins are avoided.' },
  { id: 'asr', ar: 'صلاة العصر', en: 'Pray Asr', xp: 10, icon: '🕌',
    thawabAr: 'مَن حافظ على صلاة العصر فقد حُفظ له عملُه.', thawabEn: 'Guarding the Asr prayer preserves your deeds.' },
  { id: 'maghrib', ar: 'صلاة المغرب', en: 'Pray Maghrib', xp: 10, icon: '🌇',
    thawabAr: 'الصلاة نور، وهي صلة بينك وبين ربّك.', thawabEn: 'Prayer is light, and a direct connection with your Lord.' },
  { id: 'isha', ar: 'صلاة العشاء', en: 'Pray Isha', xp: 10, icon: '🌙',
    thawabAr: 'مَن صلّى العشاء في جماعة فكأنّما قام نصف الليل.', thawabEn: 'Praying Isha in congregation is like standing half the night in prayer.' },
]

export const QUESTS = {
  new: [
    ...PRAYERS_QUESTS,
    { id: 'wudu', ar: 'الوضوء بشكل صحيح', en: 'Make wudu correctly', xp: 6, icon: '💧', thawabAr: 'إسباغ الوضوء يمحو الخطايا وترفع به الدرجات.', thawabEn: 'Perfecting wudu wipes away sins and raises your rank.' },
    { id: 'quran', ar: 'قراءة القرآن', en: 'Read Qur’an', xp: 12, icon: '📖', thawabAr: 'مَن قرأ حرفًا من كتاب الله فله به حسنة، والحسنة بعشر أمثالها.', thawabEn: 'Each letter of the Qur\u2019an brings a reward, multiplied tenfold.' },
    { id: 'memorize', ar: 'حفظ آية جديدة', en: 'Memorize a new ayah', xp: 15, icon: '🧠', thawabAr: 'يُقال لصاحب القرآن: اقرأ وارتقِ.', thawabEn: 'The companion of the Qur\u2019an is told: recite and ascend.' },
    { id: 'dhikr', ar: 'أذكار الصباح/المساء', en: 'Morning/evening adhkar', xp: 8, icon: '📿', thawabAr: 'ألا بذكر الله تطمئنّ القلوب.', thawabEn: 'In the remembrance of Allah hearts find rest.' },
    { id: 'hadith', ar: 'تعلّم حديثًا', en: 'Learn a hadith', xp: 8, icon: '📜', thawabAr: 'مَن سلك طريقًا يلتمس فيه علمًا سهّل الله له طريقًا إلى الجنّة.', thawabEn: 'Whoever travels a path seeking knowledge, Allah eases for them a path to Paradise.' },
    { id: 'learn', ar: 'درس عن الإسلام', en: 'One lesson about Islam', xp: 10, icon: '🎓', thawabAr: 'طلب العلم فريضة على كل مسلم.', thawabEn: 'Seeking knowledge is an obligation upon every Muslim.' },
  ],
  adult: [
    ...PRAYERS_QUESTS,
    { id: 'mosque', ar: 'صلاة في المسجد', en: 'Pray at the mosque', xp: 20, icon: '🕌', thawabAr: 'صلاة الجماعة تفضل صلاة الفذّ بسبعٍ وعشرين درجة.', thawabEn: 'Congregational prayer surpasses praying alone by twenty-seven degrees.' },
    { id: 'quran', ar: 'وِرد القرآن اليومي', en: 'Daily Qur’an portion', xp: 12, icon: '📖', thawabAr: 'مَن قرأ حرفًا من كتاب الله فله به حسنة، والحسنة بعشر أمثالها.', thawabEn: 'Each letter of the Qur\u2019an brings a reward, multiplied tenfold.' },
    { id: 'memorize', ar: 'مراجعة الحفظ', en: 'Review memorization', xp: 12, icon: '🧠', thawabAr: 'يُقال لصاحب القرآن: اقرأ وارتقِ.', thawabEn: 'The companion of the Qur\u2019an is told: recite and ascend.' },
    { id: 'sunnah', ar: 'السنن الرواتب', en: 'Sunnah prayers', xp: 10, icon: '✨', thawabAr: 'مَن صلّى ثنتي عشرة ركعة في اليوم بُني له بيت في الجنة.', thawabEn: 'Twelve sunnah rak\u02bfahs a day: a house is built for you in Paradise.' },
    { id: 'dhikr', ar: 'أذكار الصباح/المساء', en: 'Morning/evening adhkar', xp: 8, icon: '📿', thawabAr: 'ألا بذكر الله تطمئنّ القلوب.', thawabEn: 'In the remembrance of Allah hearts find rest.' },
    { id: 'hadith', ar: 'قراءة حديث وتدبّره', en: 'Read & reflect on a hadith', xp: 8, icon: '📜', thawabAr: 'مَن سلك طريقًا يلتمس فيه علمًا سهّل الله له طريقًا إلى الجنّة.', thawabEn: 'Whoever travels a path seeking knowledge, Allah eases for them a path to Paradise.' },
    { id: 'charity', ar: 'صدقة اليوم', en: 'Give charity', xp: 10, icon: '🤲', thawabAr: 'الصدقة تطفئ الخطيئة كما يطفئ الماء النار.', thawabEn: 'Charity extinguishes sin as water extinguishes fire.' },
    { id: 'fast', ar: 'صيام الاثنين/الخميس', en: 'Fast Mon/Thu', xp: 18, icon: '🌾', thawabAr: 'مَن صام يومًا في سبيل الله باعد الله وجهه عن النار.', thawabEn: 'Fasting a day for Allah\u2019s sake distances you from the Fire.' },
  ],
  child: [
    { id: 'fajr', ar: 'صلاة الفجر', en: 'Pray Fajr', xp: 12, icon: '🌅' },
    { id: 'salah', ar: 'صلّيت اليوم', en: 'I prayed today', xp: 10, icon: '🕌', thawabAr: 'الصلاة أوّل ما يُحاسب عليه العبد يوم القيامة.', thawabEn: 'Prayer is the first thing a servant is asked about on the Day of Judgement.' },
    { id: 'letters', ar: 'تعلّمت حرفًا', en: 'Learned a letter', xp: 8, icon: '🔤', thawabAr: 'تعلّم الحروف أوّل الطريق إلى قراءة كتاب الله.', thawabEn: 'Learning the letters is the first step to reading Allah\u2019s Book.' },
    { id: 'surah', ar: 'سورة قصيرة', en: 'A short surah', xp: 12, icon: '📖', thawabAr: 'خيركم مَن تعلّم القرآن وعلّمه.', thawabEn: 'The best of you are those who learn the Qur\u2019an and teach it.' },
    { id: 'kind', ar: 'عمل طيّب', en: 'A kind deed', xp: 8, icon: '💛', thawabAr: 'تبسّمك في وجه أخيك صدقة.', thawabEn: 'Even your smile toward your brother is charity.' },
    { id: 'dhikr', ar: 'ذكرت الله', en: 'Said dhikr', xp: 6, icon: '📿', thawabAr: 'ألا بذكر الله تطمئنّ القلوب.', thawabEn: 'In the remembrance of Allah hearts find rest.' },
  ],
}

export const LEVEL_TITLES = {
  ar: ['مبتدئ', 'سالك', 'مثابر', 'مجتهد', 'قدوة', 'راسخ'],
  other: ['Beginner', 'Seeker', 'Steadfast', 'Devoted', 'Role model', 'Firm'],
}

export function xpForLevel(level) { return 40 + level * 30 }         // xp needed to reach next level
export function levelFromXp(totalXp) {
  let level = 1, xp = totalXp
  while (xp >= xpForLevel(level)) { xp -= xpForLevel(level); level++ }
  return { level, into: xp, need: xpForLevel(level) }
}

const KEY = 'mc_journey_v1'
const todayStr = () => new Date().toISOString().slice(0, 10)

export function loadJourney() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      totalXp: raw.totalXp || 0,
      streak: raw.streak || 0,
      lastActive: raw.lastActive || null,
      day: raw.day === todayStr() ? raw.done || {} : {}, // reset checkmarks each day
      dayDate: todayStr(),
    }
  } catch { return { totalXp: 0, streak: 0, lastActive: null, day: {}, dayDate: todayStr() } }
}

export function saveJourney(j) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      totalXp: j.totalXp, streak: j.streak, lastActive: j.lastActive, day: j.day, dayDate: todayStr(),
    }))
  } catch { /* storage unavailable */ }
}

// toggle a quest done/undone; returns updated journey + xp delta
export function toggleQuest(j, quest) {
  const done = { ...j.day }
  let totalXp = j.totalXp
  let streak = j.streak
  let lastActive = j.lastActive
  if (done[quest.id]) {
    delete done[quest.id]
    totalXp = Math.max(0, totalXp - quest.xp)
  } else {
    done[quest.id] = true
    totalXp += quest.xp
    // streak: first completion of the day advances it
    if (lastActive !== todayStr()) {
      const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
      streak = lastActive === y ? streak + 1 : 1
      lastActive = todayStr()
    }
  }
  return { ...j, day: done, totalXp, streak, lastActive }
}
