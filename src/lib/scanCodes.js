/* Pure helpers for scanned codes (no DOM, no camera) so they can be unit-tested. */

const GTIN_LENGTHS = [8, 12, 13, 14]

/** GTIN check digit (EAN-8 / UPC-A / EAN-13 / GTIN-14). Rejects misreads before any network call. */
export function validGtin(code) {
  if (!/^\d+$/.test(code) || !GTIN_LENGTHS.includes(code.length)) return false
  const d = code.split('').map(Number)
  const check = d.pop()
  let sum = 0
  for (let i = d.length - 1, w = 3; i >= 0; i--, w = 4 - w) sum += d[i] * w
  return (10 - (sum % 10)) % 10 === check
}

/** GTIN-14 is a 13-digit EAN with a leading indicator digit; product databases use the 13-digit form. */
function toLookupCode(g) {
  return g.length === 14 && g[0] === '0' ? g.slice(1) : g
}

const MAX_LEN = 2048 // a QR can hold far more; a product code never needs it
const GTIN_PARAMS = ['gtin', 'ean', 'upc', 'barcode']

/**
 * Classify what a scan contains.
 *   { kind: 'gtin', gtin }   a valid product code (plain, GS1 Digital Link, or a gtin= style URL)
 *   { kind: 'url', host }    a web link that carries no product code; never opened or fetched
 *   { kind: 'text' }         anything else
 */
export function parseScannedCode(raw) {
  const s = String(raw ?? '').trim()
  if (!s || s.length > MAX_LEN) return { kind: 'text' }

  if (validGtin(s)) return { kind: 'gtin', gtin: toLookupCode(s) }

  // GS1 element strings: "(01)03017624010701(17)261231" or "0103017624010701..."
  const el = s.match(/^\(01\)(\d{14})/) || s.match(/^01(\d{14})/)
  if (el && validGtin(el[1])) return { kind: 'gtin', gtin: toLookupCode(el[1]) }

  // only http(s) links are treated as links; javascript:, data:, etc. fall through to "text"
  if (/^https?:\/\//i.test(s)) {
    let u
    try { u = new URL(s) } catch { return { kind: 'text' } }
    const dl = u.pathname.match(/\/01\/(\d{14})(?:\/|$)/) // GS1 Digital Link
    if (dl && validGtin(dl[1])) return { kind: 'gtin', gtin: toLookupCode(dl[1]) }
    for (const key of GTIN_PARAMS) {
      const v = u.searchParams.get(key)
      if (v && validGtin(v.trim())) return { kind: 'gtin', gtin: toLookupCode(v.trim()) }
    }
    return { kind: 'url', host: u.hostname.slice(0, 80) }
  }
  return { kind: 'text' }
}
