/* Text normalisation for ingredient lists (pure, no DOM). The original text is never modified;
   callers keep it next to the normalised copy. */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function normalizeText(raw) {
  let s = String(raw ?? '').normalize('NFKC')
  s = s.replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))          // Arabic-Indic digits -> 0-9
  s = s.replace(/[\u064B-\u065F\u0670\u0640]/g, '')              // Arabic diacritics and tatweel
  s = s.replace(/[،؛;•·|\n\r\t]+/g, ',')                          // every separator becomes a comma
  s = s.replace(/[[{]/g, '(').replace(/[\]}]/g, ')')             // all brackets become parentheses
  s = s.replace(/\d+(?:[.,]\d+)?\s*%/g, ' ')                      // percentages are not ingredients
  s = s.replace(/\(\s*\)/g, ' ')                                  // parentheses emptied by the step above
  s = s.toLowerCase()
  s = s.replace(/:\s*,+/g, ': ').replace(/^[\s,]+/, '').replace(/,\s*,+/g, ',')    // tidy separators
  s = s.replace(/\s*,\s*/g, ', ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')        // one canonical spacing
  return s.replace(/\s+/g, ' ').replace(/[\s,]+$/, '').trim()
}

/** Lower-case, drop the Arabic definite article, so "الخنزير" and "خنزير" compare equal. */
export function normalizeWord(w) {
  return String(w ?? '').toLowerCase().replace(/^(?:وال|بال|لل|ال)(?=[\u0621-\u064A]{2,})/, '').trim()
}
