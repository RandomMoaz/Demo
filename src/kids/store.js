// The kids section's saved state: profile, progress and today's screen time. Device only (localStorage).
import { useSyncExternalStore } from 'react'
import { normalise, rollDay, dayKey } from './progress'

const KEY = 'mc_kids_v1'
export const BANDS = ['little', 'explorer', 'young']
export const LIMITS = [0, 15, 30, 45, 60] // minutes a day; 0 = no limit

export const defaultProfile = () => ({ name: '', band: 'explorer', limitMin: 0, voice: true, pin: '', active: false, setup: false })

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    return {
      profile: { ...defaultProfile(), ...(raw?.profile || {}) },
      progress: normalise(raw?.progress),
      usage: raw?.usage && typeof raw.usage.ms === 'number' ? raw.usage : { date: dayKey(), ms: 0 },
    }
  } catch {
    return { profile: defaultProfile(), progress: normalise(null), usage: { date: dayKey(), ms: 0 } }
  }
}

let state = read()
state = { ...state, progress: rollDay(state.progress) }
const subs = new Set()
const emit = () => subs.forEach((f) => f())

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage blocked: progress lasts this session */ }
}

export const kidsState = () => state
export const useKids = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, kidsState, kidsState)

export function setProfile(patch) {
  state = { ...state, profile: { ...state.profile, ...patch } }
  save(); emit()
}

/** Apply a progress function from progress.js: update(traceLetter, id). */
export function update(fn, ...args) {
  const before = state.progress
  const after = fn(rollDay(before), ...args)
  state = { ...state, progress: after }
  save(); emit()
  return { stars: after.stars - before.stars, stickers: after.stickers.filter((x) => !before.stickers.includes(x)) }
}

export function resetProgress() {
  state = { ...state, progress: normalise(null), usage: { date: dayKey(), ms: 0 } }
  save(); emit()
}

/** Count screen time for today; a new day starts again from zero. */
export function addUsage(ms, now = new Date()) {
  const today = dayKey(now)
  const usage = state.usage.date === today ? { date: today, ms: state.usage.ms + ms } : { date: today, ms }
  state = { ...state, usage, progress: rollDay(state.progress, now) }
  save(); emit()
}

export const timeUp = (s = state, now = new Date()) =>
  !!s.profile.limitMin && s.usage.date === dayKey(now) && s.usage.ms >= s.profile.limitMin * 60000

/** Read once at start-up: the app reopens in the kids section if a parent left it on. */
export const kidsModeOn = () => read().profile.active
