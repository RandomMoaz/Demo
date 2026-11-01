import { describe, it, expect } from 'vitest'
import { validGtin, parseScannedCode } from '../src/lib/scanCodes.js'

describe('validGtin', () => {
  it.each(['3017624010701', '5000159407236', '9780201379624', '036000291452', '96385074', '03017624010701'])('accepts the real code %s', (c) => {
    expect(validGtin(c)).toBe(true)
  })
  it.each(['3017624010702', '5000159407237', '12345678', '', '123', 'abcdefghijklm', '30176240107011', '3017 624010701'])('rejects %j', (c) => {
    expect(validGtin(c)).toBe(false)
  })
})

describe('parseScannedCode', () => {
  const gtin = (s) => parseScannedCode(s)
  it('accepts a plain product code', () => expect(gtin('3017624010701')).toEqual({ kind: 'gtin', gtin: '3017624010701' }))
  it('trims whitespace', () => expect(gtin('  3017624010701\n').kind).toBe('gtin'))
  it('turns a GTIN-14 with a leading zero into the 13-digit code', () => expect(gtin('03017624010701').gtin).toBe('3017624010701'))
  it('reads a GS1 Digital Link', () => expect(gtin('https://id.gs1.org/01/03017624010701/10/ABC').gtin).toBe('3017624010701'))
  it('reads GS1 element strings, with and without brackets', () => {
    expect(gtin('(01)03017624010701(17)261231').gtin).toBe('3017624010701')
    expect(gtin('0103017624010701').gtin).toBe('3017624010701')
  })
  it('reads a gtin / ean / upc / barcode URL parameter', () => {
    for (const k of ['gtin', 'ean', 'upc', 'barcode']) expect(gtin(`https://brand.example/p?${k}=5000159407236&x=1`).gtin).toBe('5000159407236')
  })
  it('never treats a link without a product code as a product', () => {
    expect(gtin('https://brand.example/promo')).toEqual({ kind: 'url', host: 'brand.example' })
  })
  it('does not accept a code with a wrong check digit, even inside a link or element string', () => {
    expect(gtin('3017624010702').kind).toBe('text')
    expect(gtin('0103017624010702').kind).toBe('text')
    expect(gtin('https://id.gs1.org/01/03017624010702').kind).toBe('url')
    expect(gtin('https://x.example/?ean=notanumber').kind).toBe('url')
  })
  it('treats non-http(s) schemes as plain text, never as links', () => {
    for (const s of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://a.b/01/03017624010701', 'file:///etc/passwd']) expect(gtin(s).kind).toBe('text')
  })
  it('handles empty, null, malformed and oversized input without throwing', () => {
    for (const s of ['', '   ', null, undefined, 'https://', 'x'.repeat(5000), 'https://' + 'a'.repeat(5000)]) expect(() => gtin(s)).not.toThrow()
    expect(gtin('x'.repeat(5000)).kind).toBe('text')
    expect(gtin(null).kind).toBe('text')
  })
  it('limits the host name length it reports', () => {
    expect(parseScannedCode('https://' + 'a'.repeat(200) + '.com/').host.length).toBeLessThanOrEqual(80)
  })
})
