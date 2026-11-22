import { createContext, useContext, useState, useCallback } from 'react'
import { t as tr } from '../lib/i18n'
import { kidsModeOn, kidsState } from '../kids/store'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  // a parent who left kids mode on gets the kids section back when the app reopens
  const kidsStart = kidsModeOn()
  const [screen, setScreen] = useState(kidsStart ? 'kids' : 'landing')
  const [payload, setPayload] = useState(null)
  const [lang, setLang] = useState(() => (kidsStart && kidsState().profile.lang) || 'en')
  const [persona, setPersona] = useState(kidsStart ? 'child' : 'new')
  const [name, setName] = useState(() => (kidsStart ? kidsState().profile.name : ''))
  const [loc, setLoc] = useState(null)
  const [theme, setTheme] = useState('day')

  const [history, setHistory] = useState([])
  const go = useCallback((s, p = null) => {
    setScreen((cur) => { setHistory((h) => (cur && cur !== s ? [...h, cur] : h)); return s })
    setPayload(p)
  }, [])
  // return to wherever the user came from (website or app home)
  const back = useCallback(() => {
    setHistory((h) => {
      if (!h.length) { setScreen('home'); return h }
      const prev = h[h.length - 1]
      setScreen(prev)
      return h.slice(0, -1)
    })
  }, [])
  const t = tr(lang)
  const dir = t.dir

  const value = { screen, payload, go, back, lang, setLang, persona, setPersona, name, setName, loc, setLoc, theme, setTheme, t, dir }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
