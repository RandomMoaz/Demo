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

// The camera also reads QR codes; the user must be able to see that before opening it.
import BarcodeCam from '../src/components/BarcodeCam.jsx'
import { I18N } from '../src/lib/i18n.js'

describe('QR support is visible', () => {
  it.each(['ar', 'en'])('the camera panel says QR before it is opened (%s)', (lang) => {
    expect(renderToString(<BarcodeCam lang={lang} onCode={() => {}} />)).toContain('QR')
  })
  it('every language names QR on the scanner tab', () => {
    const langs = Object.keys(I18N)
    expect(langs.length).toBeGreaterThanOrEqual(6)
    for (const l of langs) expect(I18N[l].tabBarcode, l).toContain('QR')
  })
})
