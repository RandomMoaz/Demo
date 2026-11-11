// Ask the browser where the user is. Fails with a reason the screens can explain:
// insecure | unsupported | denied | unavailable | timeout

const KEY = 'mc_loc_v1'

export function savedLocation() {
  try {
    const l = JSON.parse(localStorage.getItem(KEY))
    return l && isFinite(l.lat) && isFinite(l.lng) ? l : null
  } catch { return null }
}

export function saveLocation(l) {
  try { l ? localStorage.setItem(KEY, JSON.stringify(l)) : localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export function getLocation() {
  return new Promise((resolve, reject) => {
    // browsers only share location with https pages and localhost
    if (!window.isSecureContext) return reject(new Error('insecure'))
    if (!navigator.geolocation) return reject(new Error('unsupported'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable')),
      // Wi-Fi positioning on laptops can be slow; a fix from the last 10 minutes is fine
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    )
  })
}
