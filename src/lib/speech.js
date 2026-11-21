// Speech to text through the browser's own speech recognition (Chrome, Edge, Safari).
// In Chrome and Edge the audio is processed by Google's or Microsoft's servers — the UI must say so and ask first.

const Recognition = () => (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null
export const speechSupported = () => !!Recognition()

/**
 * Listen continuously. onText(text, final) gets the running text of the current session; onSession() is called
 * when the browser ends a session (it does after a silence) and a new one starts. onState: 'listening' | 'stopped'
 * | 'denied' | 'nomic' | 'network' | 'unsupported' | 'error'.
 */
export function createListener({ lang = 'ar-SA', onText = () => {}, onSession = () => {}, onState = () => {} } = {}) {
  const R = Recognition()
  let rec = null, wanted = false, restarts = 0

  function begin() {
    rec = new R()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onstart = () => { restarts = 0; onState('listening') }
    rec.onresult = (e) => {
      let text = ''
      let final = true
      for (let i = 0; i < e.results.length; i++) {
        text += `${e.results[i][0].transcript} `
        if (!e.results[i].isFinal) final = false
      }
      onText(text.trim(), final)
    }
    rec.onerror = (e) => {
      const why = { 'not-allowed': 'denied', 'service-not-allowed': 'denied', 'audio-capture': 'nomic', network: 'network' }[e.error]
      if (why) { wanted = false; onState(why) }
      // 'no-speech' and 'aborted' just end the session; onend decides what happens next
    }
    rec.onend = () => {
      rec = null
      if (!wanted) { onState('stopped'); return }
      onSession()
      if (++restarts > 5) { wanted = false; onState('error'); return } // the browser keeps refusing: stop trying
      try { begin() } catch { wanted = false; onState('error') }
    }
    rec.start()
  }

  return {
    start() {
      if (!R) { onState('unsupported'); return }
      if (wanted) return
      wanted = true
      try { begin() } catch { wanted = false; onState('error') }
    },
    stop() {
      wanted = false
      try { rec?.stop() } catch { /* already stopped */ }
    },
    get active() { return wanted },
  }
}
