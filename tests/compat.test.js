import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? files(p) : /\.(js|jsx)$/.test(n) ? [p] : []
})

describe('browser compatibility guards', () => {
  // Safari before 16.4 cannot even parse a regular expression with lookbehind, and one such regex stops the whole
  // module from loading. Use `(?:^|[^\p{L}])` style prefixes instead.
  it('no source file uses regex lookbehind', () => {
    const offenders = files('src').filter((f) => /\(\?<[=!]/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
