import { createContext, useContext, useState, useCallback } from 'react'
import { t as tr } from '../lib/i18n'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [screen, setScreen] = useState('landing')
  const [payload, setPayload] = useState(null)
  const [lang, setLang] = useState('en')
  const [persona, setPersona] = useState('new')
  const [name, setName] = useState('')
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
