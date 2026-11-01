// ZXing logs every failed attempt (a normal event while searching) as a warning with a stack trace.
// Hide only those, so real warnings from our own code still show.
const fromZxing = (args) => args.some((a) => a && typeof a === 'object' && String(a.stack || '').includes('@zxing/library'))
for (const level of ['warn', 'error', 'log']) {
  const original = console[level].bind(console)
  console[level] = (...args) => { if (!fromZxing(args)) original(...args) }
}
