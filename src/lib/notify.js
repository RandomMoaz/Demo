// Notifications via the browser API. Opt-in; nothing fires without permission.

const KEY = 'mc_notify_v1'

export function notifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notifyStatus() {
  if (!notifySupported()) return 'unsupported'
  return Notification.permission // 'granted' | 'denied' | 'default'
}

export async function askNotifyPermission() {
  if (!notifySupported()) return 'unsupported'
  try {
    const res = await Notification.requestPermission()
    localStorage.setItem(KEY, res)
    return res
  } catch { return 'denied' }
}

function show(title, body, tag) {
  if (notifyStatus() !== 'granted') return
  try {
    new Notification(title, {
      body,
      tag,
      badge: undefined,
      icon: undefined,
      silent: false,
    })
  } catch { /* ignore */ }
}

/** celebrate a completed quest, showing its thawab */
export function notifyQuestDone(quest, lang = 'en', xp = 0) {
  const isAr = lang === 'ar'
  const title = isAr ? `أحسنت! +${xp} نقطة` : `Well done! +${xp} XP`
  const body = isAr ? (quest.thawabAr || quest.ar) : (quest.thawabEn || quest.en)
  show(title, body, 'quest-' + quest.id)
}

/** celebrate a level up */
export function notifyLevelUp(level, title, lang = 'en') {
  const isAr = lang === 'ar'
  show(
    isAr ? `المستوى ${level} — ${title}` : `Level ${level} — ${title}`,
    isAr ? 'استمرّ، فأحبّ الأعمال إلى الله أدومها وإن قلّ.' :
           'Keep going — the most beloved deeds to Allah are the consistent ones, even if small.',
    'levelup'
  )
}

/** remind about unfinished quests later in the day */
export function scheduleDailyReminder(remainingCount, lang = 'en', delayMs = 1000 * 60 * 60 * 3) {
  if (notifyStatus() !== 'granted' || remainingCount <= 0) return null
  const isAr = lang === 'ar'
  const id = setTimeout(() => {
    show(
      isAr ? 'رحلتك اليوم' : 'Your journey today',
      isAr ? `بقيت ${remainingCount} مهمة. لا تقطع تتابعك — عمل قليل دائم خير من كثير منقطع.`
           : `${remainingCount} quest${remainingCount === 1 ? '' : 's'} left. Keep your streak — small and steady beats much and broken.`,
      'daily-reminder'
    )
  }, delayMs)
  return id
}

/** a nudge when the streak is at risk (nothing done yet today) */
export function notifyStreakAtRisk(streak, lang = 'en') {
  if (streak <= 0) return
  const isAr = lang === 'ar'
  show(
    isAr ? `تتابعك ${streak} يومًا 🔥` : `${streak}-day streak 🔥`,
    isAr ? 'أكمل مهمة واحدة اليوم للحفاظ عليه.' : 'Complete one quest today to keep it alive.',
    'streak'
  )
}

/** an Islamic event has arrived */
export function notifyEvent(name, thawab, tag) {
  show(name, thawab, tag || 'event')
}
