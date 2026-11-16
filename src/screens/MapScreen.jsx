import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { getLocation } from '../lib/location'
import { localeOf, prayerName } from '../lib/alarms'
import {
  fetchPlaces, arrange, countKinds, searchBox, boxWasClamped, coveredBox, distanceKm, MIN_SEARCH_ZOOM,
  formatDistance, walkMinutes, osmUrl, safeUrl, safeEmail,
} from '../lib/places'
import { geocode, addressQuery, suggest, addRecent, loadRecent, saveRecent } from '../lib/geocode'
import { mapText, ocrLangFor } from '../lib/mapText'
import { fetchMosquesFast, viewBounds, pickCached, addCached, loadCache, saveCache, boxHas } from '../lib/placeCache'
import { openState } from '../lib/openingHours'
import { warmQlever } from '../lib/qlever'
import { prayerTimes, nextPrayer } from '../lib/prayerTimes'
import { MODES, fetchRoute, trackRoute, pickMode, metres, instruction, formatMetres } from '../lib/route'
import PhotoReader from '../components/PhotoReader'
import CertificateCheck from '../components/CertificateCheck'
import { RouteSheet, NavBanner } from '../components/RouteView'

let leaflet
const loadLeaflet = () => (leaflet ||= Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
  .then(([m]) => m.default || m)
  .catch((e) => { leaflet = null; throw e }))
if (typeof window !== 'undefined') {
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 3000))
  idle(() => loadLeaflet().catch(() => {}), { timeout: 6000 })
}

const TILE_HOST = 'https://tile.openstreetmap.org'
const TILES = `${TILE_HOST}/{z}/{x}/{y}.png`
const ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
const CITY_ZOOM = 12
const FAST_AFTER_MS = 1200
const KIND_KEYS = ['all', 'mosque', 'food', 'shop']

function warm(origin, cors = true) {
  if (typeof document === 'undefined' || document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return
  const l = document.createElement('link')
  l.rel = 'preconnect'; l.href = origin
  if (cors) l.crossOrigin = 'anonymous' // fetch() requests use a CORS connection; tile images do not
  document.head.appendChild(l)
}

const SVG = {
  mosque: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c-1 1.6-4.5 3-4.5 6.5h9c0-3.5-3.5-4.9-4.5-6.5z"/><path d="M6 20v-8h12v8"/><path d="M10.5 20v-3a1.5 1.5 0 0 1 3 0v3"/><path d="M3.5 20h17"/><path d="M3.5 20V9.5M3.5 9.5l.8-1.8.8 1.8"/></svg>',
  food: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7a2 2 0 0 0 2 2v9"/><path d="M11 3v7a2 2 0 0 1-2 2"/><path d="M9 3v5"/><path d="M17 21V3c-2 1.2-3 3.6-3 7h3"/></svg>',
  shop: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
}
const Icon = ({ kind }) => <span className="mp-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SVG[kind] }} />

const pinIcon = (L, kind, on) => L.divIcon({
  className: 'mp-pin-wrap',
  html: `<span class="mp-pin mp-${kind}${on ? ' on' : ''}">${SVG[kind]}</span>`,
  iconSize: on ? [44, 52] : [34, 42], iconAnchor: on ? [22, 50] : [17, 40],
})

const meIcon = (L, heading) => L.divIcon({
  className: 'mp-me-wrap',
  html: `<span class="mp-me">${heading == null ? '' : `<i class="mp-me-dir" style="transform:rotate(${Math.round(heading)}deg)"></i>`}</span>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
})

const Back = ({ onClick }) => (
  <button className="back-ic" onClick={onClick} aria-label="back">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
)

function onMyClock(p, me) {
  if (me) return distanceKm(me, p) < 300
  return Math.abs(-new Date().getTimezoneOffset() / 60 - p.lng / 15) <= 1.5
}

function hoursText(st, s, locale, now) {
  if (!st) return ''
  if (st.open && !st.change) return s.oh.h24
  if (!st.change) return st.open ? s.oh.open : s.oh.closed
  const t = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(st.change)
  if (st.open) return st.change - now <= 3600000 ? s.oh.soon(t) : s.oh.closes(t)
  if (st.change.toDateString() === now.toDateString()) return s.oh.opens(t)
  return s.oh.opensOn(new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(st.change), t)
}

export default function MapScreen() {
  const { t, lang, back, loc, setLoc } = useApp()
  const s = mapText(lang)
  const locale = localeOf(lang)

  const [places, setPlaces] = useState([])
  const [origin, setOrigin] = useState(loc)
  const [filter, setFilter] = useState('all')
  const [openOnly, setOpenOnly] = useState(false)
  const [selId, setSelId] = useState(null)
  const [status, setStatus] = useState({ k: loc ? 'loading' : 'start' })
  const [moved, setMoved] = useState(false)
  const [zoom, setZoom] = useState(loc ? 15 : 2)
  const [sheet, setSheet] = useState(false) // list expanded
  const [q, setQ] = useState('')
  const [alts, setAlts] = useState([]) // other matches for the last search
  const [photo, setPhoto] = useState(null) // null | { msg }
  const [ready, setReady] = useState(false)
  const [now, setNow] = useState(() => new Date()) // ticks each minute, for "open now"
  const [typing, setTyping] = useState(false) // the search box has focus
  const [sugs, setSugs] = useState({ text: '', rows: [] }) // suggestions, and the text they are for
  const [sugIdx, setSugIdx] = useState(-1)
  const [recent, setRecent] = useState(loadRecent)
  const [route, setRoute] = useState(null)
  // live navigation: { following, muted, prog, arrived, rerouting }
  const [track, setTrack] = useState(null)

  const elRef = useRef(null)
  const map = useRef(null)
  const Lref = useRef(null)
  const layer = useRef(null)
  const me = useRef(null)
  const tiles = useRef(null)
  const lastBox = useRef(null)
  const moving = useRef(false)
  const pendingFit = useRef(null) // a zoom-out to apply when the current flight lands
  const earlyFit = useRef(null) // results that came in before the map itself was ready
  const markers = useRef(new Map())
  const selRef = useRef(null)
  const placesAbort = useRef(null)
  const geoAbort = useRef(null)
  const sugAbort = useRef(null)
  const picked = useRef('')
  const inputRef = useRef(null)
  const onMove = useRef(() => {})
  const sheetRef = useRef(null)
  const routeLayer = useRef(null)
  const routeAbort = useRef(null)
  const onFix = useRef(() => {}) // each GPS fix while navigating
  const onDrag = useRef(() => {})
  const nv = useRef({ watch: null, wake: null, prevAt: 0, off: 0, last: 0, spoken: {} }) // navigation bookkeeping
  const swipe = useRef(null) // where a drag on the sheet handle started
  const routeRef = useRef(null)
  routeRef.current = route

  const shown = useMemo(() => {
    const list = arrange(places, { filter, from: origin }).map((p) => (p.hours && onMyClock(p, loc) ? { ...p, oh: openState(p.hours, now) } : p))
    return openOnly ? list.filter((p) => p.oh?.open) : list
  }, [places, filter, origin, openOnly, now, loc])
  const counts = useMemo(() => countKinds(places), [places])
  const sel = selId ? shown.find((p) => p.id === selId) : null

  useEffect(() => {
    let dead = false
    warm(TILE_HOST, false)
    const el = elRef.current
    if (loc && el) searchAt(loc, viewBounds(loc, 15, { x: el.clientWidth || 400, y: el.clientHeight || 700 }))
    else warmQlever({ lang })
    loadLeaflet().then((L) => {
      if (dead || !elRef.current) return
      Lref.current = L
      const m = L.map(elRef.current, { zoomControl: false, worldCopyJump: true, minZoom: 2 })
      m.attributionControl.setPrefix(false)
      m.setView(loc ? [loc.lat, loc.lng] : [24, 25], loc ? 15 : 2)
      routeLayer.current = L.layerGroup().addTo(m) // under the pins
      layer.current = L.layerGroup().addTo(m)
      m.on('movestart', () => { moving.current = true })
      m.on('moveend', () => { moving.current = false; onMove.current() })
      m.on('dragstart', () => onDrag.current())
      m.on('click', () => { if (!routeRef.current) setSelId(null) })
      map.current = m
      if (loc) showMe(loc)
      setReady(true)
      setTimeout(() => m.invalidateSize(), 120)
      if (earlyFit.current) { const a = earlyFit.current; earlyFit.current = null; fitNearest(...a) }
    }).catch(() => { if (!dead) setStatus({ k: 'error', e: 'net' }) })
    const tick = setInterval(() => setNow(new Date()), 60000)
    return () => {
      dead = true
      clearInterval(tick)
      placesAbort.current?.abort(); geoAbort.current?.abort(); sugAbort.current?.abort(); routeAbort.current?.abort()
      stopWatching()
      map.current?.remove(); map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // base map (its colours follow the app theme through CSS)
  useEffect(() => {
    const L = Lref.current, m = map.current
    if (!L || !m || tiles.current) return
    tiles.current = L.tileLayer(TILES, {
      maxZoom: 19, attribution: ATTR,
      keepBuffer: 4,
      updateWhenZooming: false,
    }).addTo(m)
  }, [ready])

  useEffect(() => {
    const el = sheetRef.current, stage = el?.parentElement
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => stage.style.setProperty('--mp-peek', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pinList = route ? [route.place] : shown
  useEffect(() => {
    const L = Lref.current, g = layer.current
    if (!L || !g) return
    g.clearLayers()
    markers.current = new Map()
    for (const p of pinList) {
      const on = p.id === selRef.current
      const mk = L.marker([p.lat, p.lng], { icon: pinIcon(L, p.kind, on), title: p.name || s.unnamed[p.kind], keyboard: true, zIndexOffset: on ? 1000 : 0, riseOnHover: true })
      mk.on('click', () => select(p, false)) // markers do not bubble clicks to the map
      markers.current.set(p.id, { mk, kind: p.kind })
      g.addLayer(mk)
    }
  }, [pinList.map((p) => p.id).join(), ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const routeData = route?.res?.[route.mode]?.data
  useEffect(() => {
    const L = Lref.current, g = routeLayer.current, m = map.current
    if (!L || !g || !m) return
    g.clearLayers()
    if (!routeData) return
    const walk = route.mode === 'walk'
    L.polyline(routeData.line, { weight: walk ? 10 : 11, lineCap: 'round', lineJoin: 'round', interactive: false, className: 'mp-route-casing' }).addTo(g)
    L.polyline(routeData.line, { weight: walk ? 7 : 7, dashArray: walk ? '0.1 12' : null, lineCap: 'round', lineJoin: 'round', interactive: false, className: `mp-route-path m-${route.mode}` }).addTo(g)
    if (!nv.current.watch) fitRoute(routeData) // while navigating the camera follows the user instead
  }, [routeData, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const L = Lref.current
    if (!L) return
    for (const [id, on] of [[selRef.current, false], [selId, true]]) {
      const e = id && markers.current.get(id)
      if (e) { e.mk.setIcon(pinIcon(L, e.kind, on)); e.mk.setZIndexOffset(on ? 1000 : 0) }
    }
    selRef.current = selId
  }, [selId])

  // suggestions while typing, a moment after the last key
  useEffect(() => {
    const text = q.trim()
    sugAbort.current?.abort()
    setSugIdx(-1)
    if (!typing || text.length < 3 || text === picked.current) { setSugs({ text: '', rows: [] }); return }
    const ctrl = new AbortController()
    sugAbort.current = ctrl
    const c = map.current?.getCenter()
    const timer = setTimeout(() => {
      suggest(text, { lang, near: c && map.current.getZoom() >= 4 ? { lat: c.lat, lng: c.wrap().lng } : loc, signal: ctrl.signal })
        .then((rows) => { if (!ctrl.signal.aborted) setSugs({ text, rows }) })
        .catch(() => { if (!ctrl.signal.aborted) setSugs({ text: '', rows: [] }) })
    }, 220)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [q, typing, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  onMove.current = () => {
    const m = map.current
    if (!m) return
    setZoom(m.getZoom())
    if (routeRef.current) return // looking at a route: no searching
    if (pendingFit.current) { const fit = pendingFit.current; pendingFit.current = null; fit(); return }
    const box = lastBox.current
    if (!box) { // nothing searched yet: zooming into a city is enough
      if (m.getZoom() >= MIN_SEARCH_ZOOM) searchHere()
      else setStatus((st) => (st.k === 'start' || st.k === 'zoom' || st.k === 'locErr' ? st : { k: 'zoom' }))
      return
    }
    const c = m.getCenter().wrap()
    const mLat = (box.n - box.s) * 0.25, mLng = (box.e - box.w) * 0.25
    const inside = c.lat > box.s + mLat && c.lat < box.n - mLat && c.lng > box.w + mLng && c.lng < box.e - mLng
    setMoved(!inside)
  }

  function showMe(l, heading = null) {
    const L = Lref.current, m = map.current
    if (!L || !m) return
    if (me.current) { me.current.setLatLng([l.lat, l.lng]); me.current.setIcon(meIcon(L, heading)); return }
    me.current = L.marker([l.lat, l.lng], { icon: meIcon(L, heading), interactive: false, keyboard: false, zIndexOffset: 2000 }).addTo(m)
  }

  // the whole route in view, above the sheet
  function fitRoute(data) {
    const L = Lref.current, m = map.current
    if (!L || !m || !data) return
    const sheetH = sheetRef.current?.offsetHeight || 200
    m.fitBounds(L.latLngBounds(data.line), { paddingTopLeft: [40, 40], paddingBottomRight: [40, sheetH + 24], maxZoom: 17 })
  }

  const setRes = (id, mode, v) => setRoute((r) => (r && r.place.id === id ? { ...r, res: { ...r.res, [mode]: v } } : r))

  async function openRoute(p) {
    routeAbort.current?.abort()
    const ctrl = new AbortController()
    routeAbort.current = ctrl
    setSelId(p.id); setSheet(true); setAlts([])
    let from = loc
    if (!from) {
      setRoute({ place: p, mode: 'walk', res: {} }) // the sheet shows "finding the route" while we ask
      try {
        from = await getLocation()
        if (ctrl.signal.aborted) return
        setLoc(from); showMe(from)
      } catch {
        if (!ctrl.signal.aborted) setRoute({ place: p, mode: 'walk', res: {}, needLoc: true })
        return
      }
    }
    setRoute({ place: p, mode: pickMode(from, p), from, res: Object.fromEntries(MODES.map((m) => [m, { st: 'loading' }])) })
    for (const m of MODES) {
      fetchRoute(from, p, m, { signal: ctrl.signal }).then(
        (data) => setRes(p.id, m, { st: 'ok', data }),
        (e) => { if (e?.name !== 'AbortError') setRes(p.id, m, { st: 'err', err: e?.message }) },
      )
    }
  }

  function closeRoute() {
    routeAbort.current?.abort()
    endNav(false)
    setRoute(null)
  }

  function speak(text, force = false) {
    if ((!force && track?.muted) || typeof window === 'undefined' || !window.speechSynthesis || !text) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = locale
      window.speechSynthesis.speak(u)
    } catch { /* no voice on this device */ }
  }

  function stopWatching() {
    const n = nv.current
    if (n.watch != null && typeof navigator !== 'undefined') navigator.geolocation?.clearWatch(n.watch)
    n.watch = null
    n.wake?.release?.().catch?.(() => {})
    n.wake = null
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
  }

  /** Start: follow the user's GPS, keep the screen on, speak the turns. */
  function startNav() {
    const data = route?.res[route.mode]?.data
    if (!data || !navigator.geolocation) return
    nv.current = { ...nv.current, prevAt: 0, off: 0, last: 0, spoken: { step: 0 } }
    setTrack({ following: true, muted: false, prog: null, arrived: false, rerouting: false })
    setSheet(false)
    nv.current.watch = navigator.geolocation.watchPosition(
      (f) => onFix.current(f),
      (e) => { if (e.code === 1) { endNav(); setRoute((r) => r && { ...r, needLoc: true }) } },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )
    navigator.wakeLock?.request('screen').then((l) => { nv.current.wake = l }, () => {})
    speak(instruction(data.steps[0], s.nav), true)
    const at = loc || route.from
    if (at) map.current?.setView([at.lat, at.lng], 17)
  }

  function endNav(refit = true) {
    const was = nv.current.watch != null
    stopWatching()
    setTrack(null)
    if (was && refit) fitRoute(routeRef.current?.res[routeRef.current.mode]?.data)
  }

  function reroute(pos) {
    const r = route
    nv.current.last = Date.now()
    setTrack((t) => t && { ...t, rerouting: true })
    fetchRoute(pos, r.place, r.mode, { signal: routeAbort.current?.signal }).then((data) => {
      nv.current.prevAt = 0; nv.current.off = 0; nv.current.spoken = {}
      setRes(r.place.id, r.mode, { st: 'ok', data })
      setTrack((t) => t && { ...t, rerouting: false })
    }, () => setTrack((t) => t && { ...t, rerouting: false }))
  }

  onFix.current = (fix) => {
    const m = map.current, r = route, t = track
    if (!m || !r || !t) return
    const pos = { lat: fix.coords.latitude, lng: fix.coords.longitude }
    const heading = Number.isFinite(fix.coords.heading) && (fix.coords.speed ?? 1) > 0.4 ? fix.coords.heading : null
    showMe(pos, heading)
    if (t.following) m.setView([pos.lat, pos.lng], Math.max(m.getZoom(), 17), { animate: true })
    if (t.arrived) return
    if (metres(pos, r.place) < 25) {
      setTrack((x) => x && { ...x, arrived: true })
      speak(s.nav.arrived)
      stopWatching()
      return
    }
    const data = r.res[r.mode]?.data
    if (!data || t.rerouting) return
    const n = nv.current
    const pr = trackRoute(data, pos, n.prevAt)
    n.prevAt = pr.at
    const offLimit = r.mode === 'walk' ? 35 : 60
    n.off = pr.off > offLimit ? n.off + 1 : 0
    if (n.off >= 2 && Date.now() - n.last > 8000) { reroute(pos); return }
    setTrack((x) => x && { ...x, prog: pr })
    // speak each turn twice: when it becomes the next one, and again just before it
    const step = data.steps[pr.step]
    const near = r.mode === 'walk' ? 30 : 90
    if (pr.step !== n.spoken.step) {
      n.spoken = { step: pr.step, near: false }
      if (pr.toStep > near) speak(s.nav.inDist(formatMetres(pr.toStep, locale), instruction(step, s.nav)))
    }
    if (!n.spoken.near && pr.toStep <= near) { n.spoken.near = true; speak(instruction(step, s.nav)) }
  }

  // dragging the map while navigating stops the camera following, until "Re-centre"
  onDrag.current = () => { if (track?.following) setTrack((x) => x && { ...x, following: false }) }

  function recenter() {
    setTrack((x) => x && { ...x, following: true })
    const c = me.current?.getLatLng()
    if (c) map.current?.setView(c, Math.max(map.current.getZoom(), 17))
  }

  function fitNearest(found, center, bounds) {
    const L = Lref.current, m = map.current
    if (!L || !m) { earlyFit.current = [found, center, bounds]; return }
    if (!found.length || found.some((p) => boxHas(bounds, p))) return
    const near = arrange(found, { from: center }).slice(0, 3)
    const target = L.latLngBounds([[center.lat, center.lng], ...near.map((p) => [p.lat, p.lng])])
    const fit = () => m.fitBounds(target, { padding: [60, 60], maxZoom: m.getZoom() })
    if (moving.current) pendingFit.current = fit // wait for the flight to land
    else fit()
  }

  async function searchAt(center, bounds, { retry = true, fast = null } = {}) {
    const box = searchBox(bounds, center)
    placesAbort.current?.abort()
    const ctrl = new AbortController()
    placesAbort.current = ctrl
    lastBox.current = box
    pendingFit.current = null
    setMoved(false); setSelId(null)
    setOrigin(loc || center)
    const show = (found) => {
      setPlaces(found)
      setStatus({ k: 'done', clamped: boxWasClamped(bounds, box) })
      fitNearest(found, center, bounds)
    }

    const cached = pickCached(loadCache(), box, lang)
    if (cached) { show(cached.places); if (cached.fresh) return }
    else if (!fast) { setPlaces([]); setStatus({ k: 'loading' }) }

    let full = false
    const fastP = fast ? Promise.resolve(fast)
      : cached ? Promise.resolve([])
        : new Promise((r) => setTimeout(r, FAST_AFTER_MS))
          .then(() => (full || ctrl.signal.aborted ? [] : fetchMosquesFast(box, { lang, signal: ctrl.signal })))
          .catch(() => [])
    fastP.then((ms) => {
      if (full || fast || ctrl.signal.aborted || !ms.length) return
      setPlaces(ms); setStatus({ k: 'partial' }); fitNearest(ms, center, bounds)
    })

    const started = Date.now()
    try {
      const found = await fetchPlaces(box, { lang, signal: ctrl.signal })
      full = true
      if (ctrl.signal.aborted) return
      saveCache(addCached(loadCache(), { box: coveredBox(box, found), lang, at: Date.now(), places: found }))
      show(found)
    } catch (e) {
      if (e?.name === 'AbortError' || ctrl.signal.aborted) return // a newer search replaced this one, or the screen closed
      if (cached) return // keep showing what we remembered
      const ms = await fastP
      if (e?.message === 'busy' && retry && Date.now() - started < 10000) {
        await new Promise((r) => setTimeout(r, 2500))
        if (!ctrl.signal.aborted) searchAt(center, bounds, { retry: false, fast: ms })
        return
      }
      full = true
      if (ms.length) { setPlaces(ms); setStatus({ k: 'partialErr' }); return } // mosques found, food failed
      lastBox.current = null
      setStatus({ k: 'error', e: e?.message === 'busy' ? 'busy' : 'net' })
    }
  }

  function searchHere() {
    const m = map.current
    if (!m) return
    if (m.getZoom() < MIN_SEARCH_ZOOM) { setStatus({ k: 'zoom' }); setMoved(false); return }
    const raw = m.getCenter(), c = raw.wrap(), shift = raw.lng - c.lng
    const b = m.getBounds()
    searchAt({ lat: c.lat, lng: c.lng }, { s: b.getSouth(), n: b.getNorth(), w: b.getWest() - shift, e: b.getEast() - shift })
  }

  /** Fly somewhere and search it at the same time. */
  function flyAndSearch(center, z) {
    const m = map.current
    if (!m) return
    m.flyTo([center.lat, center.lng], z, { duration: 0.9 })
    if (z < MIN_SEARCH_ZOOM) { placesAbort.current?.abort(); lastBox.current = null; setStatus({ k: 'zoom' }); return }
    searchAt(center, viewBounds(center, z, m.getSize()))
  }

  function locate() {
    setStatus({ k: 'locating' })
    getLocation().then((l) => {
      setLoc(l); showMe(l)
      flyAndSearch(l, 15)
    }, (e) => setStatus({ k: 'locErr', e: e.message }))
  }

  async function find(text) {
    const query = String(text ?? q).trim()
    const m = map.current
    if (!query || !m) return
    geoAbort.current?.abort()
    const ctrl = new AbortController()
    geoAbort.current = ctrl
    setAlts([]); setSelId(null)
    const known = sugs.text === query && sugs.rows.length ? sugs.rows : null
    setSugs({ text: '', rows: [] })
    if (known) { picked.current = known[0].label; goToResult(known[0]); setAlts(known.slice(1, 5)); return }
    setStatus({ k: 'finding' })
    try {
      const b = m.getBounds()
      const rows = await geocode(query, { lang, near: { s: b.getSouth(), n: b.getNorth(), w: b.getWest(), e: b.getEast() }, signal: ctrl.signal })
      if (ctrl.signal.aborted) return
      if (!rows.length) { setStatus({ k: 'noPlace' }); return }
      goToResult(rows[0])
      setAlts(rows.slice(1, 5))
    } catch (e) {
      if (e?.name !== 'AbortError') setStatus({ k: 'error', e: e?.message === 'busy' ? 'busy' : 'net' })
    }
  }

  function goToResult(r) {
    const m = map.current, L = Lref.current
    if (!m || !L) return
    const list = addRecent(recent, r)
    setRecent(list); saveRecent(list)
    let z = 15
    if (r.bounds) {
      z = Math.min(16, m.getBoundsZoom(L.latLngBounds([r.bounds.s, r.bounds.w], [r.bounds.n, r.bounds.e])))
      if (r.city) z = Math.max(z, CITY_ZOOM)
    }
    flyAndSearch({ lat: r.lat, lng: r.lng }, z)
  }

  function pick(r) {
    picked.current = r.label
    setQ(r.label); setSugs({ text: '', rows: [] }); setAlts([]); setSelId(null)
    inputRef.current?.blur()
    goToResult(r)
  }

  function select(p, fly = true) {
    setSelId(p.id)
    setSheet(true)
    const m = map.current
    if (!fly || !m) return
    // keep the pin above the sheet: aim a little below it
    const z = Math.max(m.getZoom(), 16)
    const pt = m.project([p.lat, p.lng], z).add([0, m.getSize().y * 0.22])
    m.flyTo(m.unproject(pt, z), z, { duration: 0.6 })
  }

  function zoomBy(d) { map.current?.setZoom((map.current.getZoom() || 2) + d) }

  const statusText = (() => {
    switch (status.k) {
      case 'start': return s.start
      case 'zoom': return s.zoomHint
      case 'locating': return s.locating
      case 'finding': return s.finding
      case 'loading': return s.loading
      case 'partial': return s.partial(counts.mosque)
      case 'partialErr': return s.partialErr(counts.mosque)
      case 'noPlace': return s.noPlace
      case 'error': return s.err[status.e] || s.err.net
      case 'locErr': return s.locErr[status.e] || s.locErr.unavailable
      case 'done': return places.length ? s.found(counts.all, counts.mosque, counts.food, counts.shop) : s.none
      default: return ''
    }
  })()
  const busy = ['locating', 'finding', 'loading', 'partial'].includes(status.k)
  const hasList = ['done', 'partial', 'partialErr'].includes(status.k)
  const label = (p) => p.name || s.unnamed[p.kind]
  const meta = (p) => [
    p.type ? (s.type[p.type] || s.kind[p.kind]) : s.kind[p.kind],
    p.denom ? s.denom[p.denom] : null,
    p.cuisine.length ? p.cuisine.join(', ') : null,
  ].filter(Boolean).join(' · ')
  const dist = (p) => (Number.isFinite(p.km) ? formatDistance(p.km, locale) : '')
  const ohText = (p) => hoursText(p.oh, s, locale, now)
  const nearest = useMemo(() => {
    if (!loc || !hasList || !places.length) return []
    return ['mosque', 'food']
      .map((k) => ({ k, p: arrange(places, { filter: k, from: loc })[0] }))
      .filter((x) => x.p && x.p.km < 25)
  }, [places, loc, hasList])
  const drop = typing && !photo ? (q.trim() ? sugs.rows : recent) : []
  const dropTitle = q.trim() ? s.suggestions : s.recent

  return (
    <div className="mp" dir={t.dir}>
      <div className="feat-top">
        <Back onClick={back} />
        <div><div className="h1">{s.title}</div><div className="h2">{s.sub}</div></div>
        <span className="ar-tag">مساجد</span>
      </div>

      <div className="mp-stage">
        <div ref={elRef} className="mp-map" dir="ltr" role="region" aria-label={s.title} />

        {/* while navigating: the next turn, big, at the top */}
        {route && track && (
          <div className="mp-top"><NavBanner s={s} route={route} track={track} locale={locale} /></div>
        )}

        {!route && <div className="mp-top">
          <form className="mp-search" role="search" onSubmit={(e) => { e.preventDefault(); if (sugIdx >= 0 && drop[sugIdx]) pick(drop[sugIdx]); else { inputRef.current?.blur(); find() } }}>
            <svg className="mp-search-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input ref={inputRef} type="search" enterKeyHint="search" value={q} placeholder={s.searchPh} aria-label={s.searchPh}
              role="combobox" aria-expanded={drop.length > 0} aria-controls="mp-drop" aria-autocomplete="list"
              aria-activedescendant={sugIdx >= 0 ? `mp-drop-${sugIdx}` : undefined}
              onChange={(e) => { picked.current = ''; setQ(e.target.value) }}
              onFocus={() => { setTyping(true); warm('https://photon.komoot.io'); warm('https://nominatim.openstreetmap.org') }}
              onBlur={() => setTyping(false)}
              onKeyDown={(e) => {
                if (!drop.length) return
                if (e.key === 'ArrowDown') { e.preventDefault(); setSugIdx((i) => (i + 1) % drop.length) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSugIdx((i) => (i <= 0 ? drop.length - 1 : i - 1)) }
                else if (e.key === 'Escape') { setSugs({ text: '', rows: [] }); inputRef.current?.blur() }
              }} />
            {q && <button type="button" className="mp-x" aria-label={s.clear} onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(''); setAlts([]); picked.current = ''; inputRef.current?.focus() }}>×</button>}
            <button type="button" className={`mp-cam${photo ? ' on' : ''}`} aria-label={s.photo} title={s.photo} aria-expanded={!!photo} onClick={() => setPhoto(photo ? null : {})}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </button>
          </form>

          {drop.length > 0 && (
            <ul id="mp-drop" className="mp-drop" role="listbox" aria-label={dropTitle}>
              <li className="mp-drop-h" role="presentation">{dropTitle}</li>
              {drop.map((r, i) => (
                <li key={`${r.id}|${r.label}`} id={`mp-drop-${i}`} role="option" aria-selected={i === sugIdx}>
                  <button type="button" tabIndex={-1} className={`mp-drop-row${i === sugIdx ? ' on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}>
                    {!q.trim() && <span className="mp-drop-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SVG.clock }} />}
                    <span><b>{r.label}</b>{r.sub && <small>{r.sub}</small>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {photo && (
            <div className="mp-photo" role="dialog" aria-label={s.photoTitle}>
              <div className="mp-photo-h"><b>{s.photoTitle}</b><button type="button" className="mp-x" aria-label={s.close} onClick={() => setPhoto(null)}>×</button></div>
              <p className="cam-note">{s.photoHint}</p>
              <PhotoReader s={s} psm="11" defaultLang={ocrLangFor(lang)} pickLabel={s.photoPick}
                onText={({ raw }) => {
                  const found = addressQuery(raw)
                  if (!found) { setPhoto({ msg: s.photoFail, err: true }); return }
                  setQ(found); setPhoto(null); find(found)
                }}
                onFail={() => setPhoto({ msg: s.photoFail, err: true })} />
              {photo.msg && <p className={`cam-note${photo.err ? ' err' : ''}`}>{photo.msg}</p>}
            </div>
          )}

          <div className="mp-chips" role="group" aria-label={s.all}>
            {KIND_KEYS.map((k) => (
              <button key={k} type="button" aria-pressed={filter === k} className={`mp-chip k-${k}${filter === k ? ' on' : ''}`} onClick={() => { setFilter(k); setSelId(null) }}>
                {k !== 'all' && <Icon kind={k} />}
                {s[k]}{hasList && <span className="mp-n">{counts[k]}</span>}
              </button>
            ))}
            <button type="button" aria-pressed={openOnly} className={`mp-chip k-open${openOnly ? ' on' : ''}`} onClick={() => { setOpenOnly(!openOnly); setSelId(null) }}>
              <Icon kind="clock" />{s.openNow}
            </button>
          </div>

          {moved && !busy && (
            <button type="button" className="mp-here" onClick={searchHere} disabled={zoom < MIN_SEARCH_ZOOM}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
              {zoom < MIN_SEARCH_ZOOM ? s.zoomIn : s.here}
            </button>
          )}
        </div>}

        <div className="mp-fabs">
          {track && !track.following && !track.arrived && (
            <button type="button" className="mp-fab recenter" onClick={recenter}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l7 19-7-4-7 4z" /></svg>
              <span>{s.nav.recenter}</span>
            </button>
          )}
          <button type="button" className="mp-fab" aria-label={s.zoomInBtn} onClick={() => zoomBy(1)}>+</button>
          <button type="button" className="mp-fab" aria-label={s.zoomOutBtn} onClick={() => zoomBy(-1)}>−</button>
          {!track && (
            <button type="button" className="mp-fab loc" aria-label={s.myLoc} title={s.myLoc} onClick={locate} disabled={status.k === 'locating'}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
            </button>
          )}
        </div>

        {/* bottom sheet: summary, list, the chosen place, or the route to it */}
        <section ref={sheetRef} className={`mp-sheet${sheet ? ' open' : ''}${route ? ' is-route' : ''}`} aria-label={s.list}>
          {/* tap to open/close, or swipe it up or down */}
          <button type="button" className="mp-handle" aria-expanded={sheet} aria-label={sheet ? s.hideList : s.list}
            onPointerDown={(e) => { swipe.current = { y: e.clientY, moved: false }; e.currentTarget.setPointerCapture?.(e.pointerId) }}
            onPointerUp={(e) => {
              const st = swipe.current
              if (!st) return
              const dy = e.clientY - st.y
              if (Math.abs(dy) > 18) { st.moved = true; setSheet(dy < 0); if (dy > 0 && !route) setSelId(null) }
            }}
            onClick={() => {
              const moved = swipe.current?.moved
              swipe.current = null
              if (moved) return
              setSheet(!sheet); if (sheet && !route) setSelId(null)
            }}><i /></button>

          {route ? (
            <RouteSheet s={s} locale={locale} route={route} track={track} label={label}
              onMode={(m) => setRoute((r) => ({ ...r, mode: m }))} onStart={startNav} onEnd={() => endNav()}
              onClose={closeRoute} onRetry={() => openRoute(route.place)}
              onMute={() => setTrack((x) => { if (!x.muted) try { window.speechSynthesis?.cancel() } catch { /* ignore */ } return { ...x, muted: !x.muted } })} />
          ) : sel ? (
            <Detail p={sel} s={s} lang={lang} locale={locale} label={label} meta={meta} dist={dist} ohText={ohText}
              clockOk={onMyClock(sel, loc)} now={now} onBack={() => setSelId(null)} onRoute={() => openRoute(sel)} />
          ) : (
            <>
              <div className="mp-status" role="status" aria-live="polite">
                {busy && <span className="mp-spin" aria-hidden="true" />}
                <span>{statusText}</span>
              </div>
              {status.k === 'done' && status.clamped && places.length > 0 && <p className="mp-hint">{s.clamped}</p>}
              {(status.k === 'start' || status.k === 'locErr' || status.k === 'zoom') && !loc && (
                <div className="mp-cta">
                  <button type="button" className="btn" onClick={locate}>{s.useLoc}</button>
                  <span>{s.orSearch}</span>
                </div>
              )}
              {(status.k === 'error' || status.k === 'partialErr') && <button type="button" className="btn ghost mp-retry" onClick={() => (lastBox.current || zoom >= MIN_SEARCH_ZOOM ? searchHere() : find())}>{s.retry}</button>}
              {alts.length > 0 && (
                <div className="mp-alts">
                  <span>{s.also}</span>
                  {alts.map((r) => (
                    <button key={r.id} type="button" className="mp-alt" onClick={() => { setAlts([]); setQ(r.label); picked.current = r.label; goToResult(r) }}>
                      <b>{r.label}</b>{r.sub && <small>{r.sub}</small>}
                    </button>
                  ))}
                </div>
              )}
              {nearest.length > 0 && (
                <div className="mp-quick">
                  {nearest.map(({ k, p }) => (
                    <button key={k} type="button" className={`mp-quick-b k-${p.kind}`} onClick={() => openRoute(p)}>
                      <span className={`mp-badge k-${p.kind}`}><Icon kind={p.kind} /></span>
                      <span><small>{s.nearest[k]} · <span className="num">{formatDistance(p.km, locale)}</span></small><b dir="auto">{label(p)}</b></span>
                    </button>
                  ))}
                </div>
              )}
              {hasList && places.length > 0 && !sheet && (
                <button type="button" className="mp-more" onClick={() => setSheet(true)}>{s.list} ({shown.length})</button>
              )}
              {sheet && hasList && (
                <ul className="mp-list">
                  {!shown.length && <li className="mp-empty">{!places.length ? s.none : openOnly ? s.noneOpen : s.noneKind}</li>}
                  {shown.map((p) => (
                    <li key={p.id}>
                      <button type="button" className={`mp-row k-${p.kind}`} onClick={() => select(p)}>
                        <span className={`mp-badge k-${p.kind}`}><Icon kind={p.kind} /></span>
                        <span className="mp-row-main">
                          <b dir="auto">{label(p)}</b>
                          <small>{meta(p)}</small>
                          <span className="mp-tags">
                            {p.halal && <em className={`mp-halal h-${p.halal}`}>{s.halal[p.halal]}</em>}
                            {p.oh && <em className={`mp-oh ${p.oh.open ? 'is-open' : 'is-shut'}`}>{ohText(p)}</em>}
                          </span>
                        </span>
                        <span className="mp-row-d num">{dist(p)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function Detail({ p, s, lang, locale, label, meta, dist, ohText, clockOk, now, onBack, onRoute }) {
  const web = safeUrl(p.website)
  const mail = safeEmail(p.email)
  const tel = p.phone ? p.phone.split(';')[0].replace(/[^\d+]/g, '') : ''
  const time = (d) => (d ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d) : '—')
  const prayers = useMemo(() => {
    if (p.kind !== 'mosque' || !clockOk) return null
    const list = prayerTimes(p.lat, p.lng, now).filter((x) => !x.info && x.date)
    return list.length === 5 ? { list, next: nextPrayer(list, now).key } : null
  }, [p.id, p.kind, clockOk, now.getHours(), now.getMinutes()]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mp-detail">
      <button type="button" className="mp-backlist" onClick={onBack}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        {s.backList}
      </button>
      <div className="mp-d-head">
        <span className={`mp-badge lg k-${p.kind}`}><Icon kind={p.kind} /></span>
        <div>
          <h2 className="mp-d-name" dir="auto">{label(p)}</h2>
          {p.local && <div className="mp-d-local" dir="auto">{p.local}</div>}
          <div className="mp-d-meta">{meta(p)}</div>
          <span className="mp-tags">
            {p.halal && <em className={`mp-halal h-${p.halal}`}>{s.halal[p.halal]}</em>}
            {p.oh && <em className={`mp-oh ${p.oh.open ? 'is-open' : 'is-shut'}`}>{ohText(p)}</em>}
          </span>
        </div>
      </div>
      {Number.isFinite(p.km) && (
        <div className="mp-d-dist num">{dist(p)} {s.away}{p.km < 4 ? ` · ${s.walk(walkMinutes(p.km))}` : ''}</div>
      )}
      {p.address && <div className="mp-d-line">{p.address}</div>}
      {p.hours && <div className="mp-d-line"><b>{s.hours}:</b> <span dir="ltr">{p.hours}</span></div>}
      {p.features.length > 0 && (
        <ul className="mp-feats">
          {p.features.map((f) => <li key={f}>{s.feat[f]}</li>)}
        </ul>
      )}

      <div className="mp-acts">
        <button type="button" className="btn" onClick={onRoute}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8z" /></svg>
          {s.directions}
        </button>
        {tel && <a className="btn ghost" href={`tel:${tel}`}>{s.call}</a>}
        {web && <a className="btn ghost" href={web} target="_blank" rel="noopener noreferrer">{s.website}</a>}
        {mail && <a className="btn ghost" href={`mailto:${mail}`}>{s.email}</a>}
      </div>

      {prayers && (
        <section className="mp-prayers" aria-label={s.prayers}>
          <h3>{s.prayers}</h3>
          <ol>
            {prayers.list.map((x) => (
              <li key={x.key} className={x.key === prayers.next ? 'on' : ''}>
                <span>{prayerName(x.key, lang)}</span>
                <b className="num">{time(x.date)}</b>
                {x.key === prayers.next && <small>{s.next}</small>}
              </li>
            ))}
          </ol>
          <p className="fine">{s.prayersNote}</p>
        </section>
      )}

      {p.kind !== 'mosque' && (
        <>
          <p className="fine">{s.tagged}</p>
          <CertificateCheck key={p.id} s={s} placeName={p.name} locale={locale} ocrLang={ocrLangFor(lang)} />
        </>
      )}
      <a className="mp-fix" href={osmUrl(p)} target="_blank" rel="noopener noreferrer">{s.fix}</a>
    </div>
  )
}
