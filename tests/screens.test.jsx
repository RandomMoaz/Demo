import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AppProvider } from '../src/context/AppContext.jsx'
import { Scanner, Alarm, MapScreen, Salah } from '../src/screens/Features.jsx'

// A screen that uses a name it never received crashes the moment the user opens it.
// Rendering each one inside the real provider catches that without a browser.
describe.each([['Scanner', Scanner], ['Alarm', Alarm], ['Map', MapScreen], ['Salah', Salah]])('%s screen', (_name, Screen) => {
  it('renders without throwing', () => {
    const html = renderToString(<AppProvider><Screen /></AppProvider>)
    expect(html.length).toBeGreaterThan(200)
  })
})
