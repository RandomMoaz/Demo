import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { QUESTS, LEVEL_TITLES, levelFromXp, loadJourney, saveJourney, toggleQuest } from '../lib/journey'
import { notifyStatus, askNotifyPermission, notifyQuestDone, notifyLevelUp, scheduleDailyReminder } from '../lib/notify'
import { TabBar } from '../components/Chrome'

export default function Journey() {
  const { t, lang, persona , back} = useApp()
  const isAr = lang === 'ar'
  const [j, setJ] = useState(() => loadJourney())
  const [pulse, setPulse] = useState(null)
  const [toast, setToast] = useState(null)          // thawab shown after completing
  const [notif, setNotif] = useState(() => notifyStatus())
  useEffect(() => { saveJourney(j) }, [j])

  const quests = QUESTS[persona] || QUESTS.new
  const { level, into, need } = levelFromXp(j.totalXp)
  const pct = Math.round((into / need) * 100)
  const title = (isAr ? LEVEL_TITLES.ar : LEVEL_TITLES.other)[Math.min(level - 1, 5)]
  const doneCount = quests.filter((q) => j.day[q.id]).length

  const onToggle = (q) => {
    const wasDone = !!j.day[q.id]
    const beforeLevel = levelFromXp(j.totalXp).level
    setJ((prev) => {
      const next = toggleQuest(prev, q)
      const afterLevel = levelFromXp(next.totalXp).level
      if (!wasDone && afterLevel > beforeLevel) {
        const tt = (isAr ? LEVEL_TITLES.ar : LEVEL_TITLES.other)[Math.min(afterLevel - 1, 5)]
        notifyLevelUp(afterLevel, tt, lang)
      }
      // remind later about anything still unfinished
      const left = quests.filter((x) => !next.day[x.id]).length
      scheduleDailyReminder(left, lang)
      return next
    })
    if (!wasDone) {
      setPulse(q.id); setTimeout(() => setPulse(null), 600)
      setToast({ q })                      // show the thawab of what they just did
      setTimeout(() => setToast(null), 5200)
      notifyQuestDone(q, lang, q.xp)
    }
  }

  const enableNotifications = async () => {
    const res = await askNotifyPermission()
    setNotif(res)
  }

  return (
    <>
      <div className="scroll" dir={t.dir}>
        {/* hero: level + xp + streak */}
        <div style={{ margin: '16px 22px 0', borderRadius: 26, padding: '18px 20px', color: '#fff',
          background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--gold)))',
          boxShadow: 'var(--shadow)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120px 120px at 85% -10%, rgba(255,255,255,.25), transparent 70%)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>{level}</div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .85 }}>{isAr ? 'المستوى' : 'Level'} {level}</div>
              <div className={isAr ? 'ar' : ''} style={{ fontSize: 19, fontWeight: 700 }}>{title}</div>
            </div>
            <div style={{ marginInlineStart: 'auto', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>🔥 {j.streak}</div>
              <div style={{ fontSize: 10.5, opacity: .85 }}>{isAr ? 'يوم متتالٍ' : 'day streak'}</div>
            </div>
          </div>
          {/* xp bar */}
          <div style={{ marginTop: 14, position: 'relative' }}>
            <div style={{ height: 9, borderRadius: 5, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct + '%', borderRadius: 5, background: '#fff', transition: 'width .5s cubic-bezier(.2,.8,.2,1)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, opacity: .9 }}>
              <span>{into} / {need} XP</span>
              <span>{j.totalXp} {isAr ? 'إجمالي' : 'total'}</span>
            </div>
          </div>
        </div>

        {/* today's quests */}
        <div className="sec">
          <div className="sec-h">
            <span className="eyebrow">{isAr ? 'مهام اليوم' : "Today's quests"}</span>
            <span style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--muted)' }}>{doneCount}/{quests.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {quests.map((q) => {
              const done = !!j.day[q.id]
              return (
                <button key={q.id} onClick={() => onToggle(q)} style={{
                  display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'start',
                  background: done ? 'var(--lapis-soft)' : 'var(--surface)',
                  border: '1px solid', borderColor: done ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--line)',
                  borderRadius: 16, padding: '13px 15px', cursor: 'pointer', color: 'var(--ink)',
                  transform: pulse === q.id ? 'scale(1.02)' : 'none', transition: 'transform .25s, background .2s, border-color .2s',
                }}>
                  <span style={{ fontSize: 22, minWidth: 28, flexShrink: 0, textAlign: 'center' }}>{q.icon}</span>
                  <span style={{ flex: 1 }}>
                    <span className={isAr ? 'ar' : ''} style={{ display: 'block', fontSize: 14.5, fontWeight: 600, textDecoration: done ? 'line-through' : 'none', opacity: done ? .6 : 1 }}>{isAr ? q.ar : q.en}</span>
                    <span className="latin" style={{ fontSize: 11.5, color: 'var(--muted)' }}>+{q.xp} XP</span>
                    {(q.thawabAr || q.thawabEn) && (
                      <span className={isAr ? 'ar' : ''} style={{ display: 'block', fontSize: 11.5, color: 'var(--gold)', lineHeight: 1.55, marginTop: 4 }}>
                        {isAr ? q.thawabAr : q.thawabEn}
                      </span>
                    )}
                  </span>
                  <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? 'var(--accent)' : 'transparent', border: done ? 'none' : '2px solid var(--line)', color: '#fff' }}>
                    {done && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </span>
                </button>
              )
            })}
          </div>
          {notif !== 'granted' && notif !== 'unsupported' && (
            <button onClick={enableNotifications} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'start', marginTop: 12,
              background: 'var(--gold-soft)', border: '1px solid color-mix(in srgb, var(--gold) 40%, transparent)',
              borderRadius: 16, padding: '13px 15px', cursor: 'pointer', color: 'var(--ink)',
            }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <span>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>
                  {isAr ? 'ذكّرني بمهام اليوم' : 'Remind me of today’s quests'}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                  {isAr ? 'تنبيه لطيف يساعدك على المداومة وحفظ تتابعك.' : 'A gentle nudge to help you stay consistent.'}
                </span>
              </span>
            </button>
          )}

          <p style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: 14, paddingBottom: 22 }}>
            {isAr ? 'تُحفظ رحلتك على جهازك وتتجدّد المهام كل يوم. أكمل مهمة واحدة على الأقل يوميًا للحفاظ على تتابعك.' :
              'Your journey is saved on this device and quests refresh daily. Complete at least one each day to keep your streak.'}
          </p>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'absolute', left: 16, right: 16, bottom: 84, zIndex: 40,
          background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--gold) 45%, transparent)',
          borderRadius: 18, padding: '14px 16px', boxShadow: 'var(--shadow)',
          animation: 'toastIn .35s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div className="latin" style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700 }}>
            {isAr ? `أحسنت · +${toast.q.xp}` : `Well done · +${toast.q.xp} XP`}
          </div>
          <div className={isAr ? 'ar' : ''} style={{ fontSize: 14, color: 'var(--gold)', lineHeight: 1.7, marginTop: 5 }}>
            {isAr ? toast.q.thawabAr : toast.q.thawabEn}
          </div>
          <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>
        </div>
      )}

      <TabBar />
    </>
  )
}
