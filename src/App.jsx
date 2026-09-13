import { useEffect } from 'react'
import { useApp } from './context/AppContext'
import { StatusBar } from './components/Chrome'
import Splash from './screens/Splash'
import Landing from './screens/Landing'
import { Language, Name, Profile, Location } from './screens/Onboarding'
import Home from './screens/Home'
import Rashed from './screens/Rashed'
import { Scanner, Alarm, MapScreen, Salah } from './screens/Features'
import { Mushaf, Tasbih } from './screens/Quran'
import Journey from './screens/Journey'
import Settings from './screens/Settings'
import Events, { EventReminder } from './screens/Events'

export default function App() {
  const { screen, theme, dir, payload, lang } = useApp()

  // keep dir + lang on the document itself
  useEffect(() => {
    document.documentElement.setAttribute('dir', dir || 'ltr')
    document.documentElement.setAttribute('lang', lang || 'en')
    document.body.setAttribute('dir', dir || 'ltr')
  }, [dir, lang])

  const render = () => {
    switch (screen) {
      case 'landing': return <Landing />
      case 'splash': return <Splash />
      case 'language': return <Language />
      case 'name': return <Name />
      case 'profile': return <Profile />
      case 'location': return <Location />
      case 'home': return <Home />
      case 'rashed': return <Rashed initialQuery={payload} />
      case 'scanner': return <Scanner />
      case 'alarm': return <Alarm />
      case 'map': return <MapScreen />
      case 'salah': return <Salah />
      case 'mushaf': return <Mushaf />
      case 'tasbih': return <Tasbih />
      case 'events': return <Events />
      case 'journey': return <Journey />
      case 'more': return <Settings />
      default: return <Home />
    }
  }

  // the landing page is a full website layout, not the phone-style app shell
  if (screen === 'landing') {
    return (
      <div className="site-root" data-theme={theme} lang={lang}>
        <Landing />
      </div>
    )
  }

  return (
    <div className="app" data-theme={theme} dir={dir} lang={lang}>
      {screen !== 'splash' && <StatusBar />}
      {render()}
      <EventReminder />
    </div>
  )
}
