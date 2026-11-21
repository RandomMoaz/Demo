import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useKids, addUsage, timeUp, setProfile } from './store'
import { kidsText } from './text'
import { Noor, Celebrations } from './ui'
import KidsHome from './screens/KidsHome'
import KidsLetters from './screens/KidsLetters'
import KidsPrayer from './screens/KidsPrayer'
import KidsQuiz from './screens/KidsQuiz'
import KidsWudu from './screens/KidsWudu'
import KidsNames from './screens/KidsNames'
import KidsSurahs from './screens/KidsSurahs'
import KidsStars from './screens/KidsStars'
import KidsParents, { ParentGate, ParentSettings } from './screens/KidsParents'
import './kids.css'

const SCREENS = {
  kids: KidsHome, 'kids-letters': KidsLetters, 'kids-prayer': KidsPrayer, 'kids-quiz': KidsQuiz, 'kids-wudu': KidsWudu,
  'kids-names': KidsNames, 'kids-surahs': KidsSurahs, 'kids-stars': KidsStars, 'kids-parents': KidsParents,
}
const TICK_MS = 15000

/** Count screen time while the app is visible. */
function useScreenTime() {
  useEffect(() => {
    let last = Date.now()
    const tick = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible') addUsage(Math.min(now - last, TICK_MS * 2))
      last = now
    }
    const id = setInterval(tick, TICK_MS)
    const vis = () => { if (document.visibilityState === 'visible') last = Date.now() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); tick() }
  }, [])
}

function TimesUp() {
  const { lang } = useApp()
  const k = kidsText(lang)
  const [gate, setGate] = useState(false)
  const [open, setOpen] = useState(false)
  if (open) return <ParentSettings onDone={() => { setOpen(false); setGate(false) }} />
  return (
    <div className="k-scroll pad k-center">
      {gate ? <ParentGate onPass={() => setOpen(true)} /> : (
        <>
          <Noor size={130} />
          <h1 className="k-result">{k.timesUp.title}</h1>
          <p className="k-lead">{k.timesUp.text}</p>
          <button type="button" className="k-btn ghost" onClick={() => setGate(true)}>{k.tabs.parents}</button>
        </>
      )}
    </div>
  )
}

export default function KidsApp() {
  const { screen, dir, lang } = useApp()
  const s = useKids()
  useScreenTime()
  const Screen = SCREENS[screen] || KidsHome // nothing outside the kids section is reachable from here
  let body
  if (!s.profile.setup) body = <ParentSettings setup onDone={() => setProfile({ setup: true })} />
  else if (timeUp(s)) body = <TimesUp />
  else body = <Screen />
  return (
    <div className={`kids band-${s.profile.band}`} dir={dir} lang={lang}>
      {body}
      <Celebrations />
    </div>
  )
}
