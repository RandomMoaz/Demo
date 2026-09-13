// SplitText — staggered character reveal. ReactBits-style (https://reactbits.dev).
export default function SplitText({ text, className = '', style = {}, delay = 40 }) {
  const chars = Array.from(text)
  return (
    <span className={className} style={{ display: 'inline-block', ...style }} aria-label={text}>
      {chars.map((c, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            opacity: 0,
            animation: `splitRise .6s cubic-bezier(.2,.8,.2,1) forwards`,
            animationDelay: `${i * delay}ms`,
          }}
        >
          {c}
        </span>
      ))}
      <style>{`@keyframes splitRise{ from{opacity:0; transform:translateY(14px)} to{opacity:1; transform:none} }`}</style>
    </span>
  )
}
