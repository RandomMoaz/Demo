import { useEffect, useRef } from 'react'

// Aurora — animated gradient background. ReactBits-style (https://reactbits.dev).
export default function Aurora({ colors = ['#48B9A2', '#E8715A', '#CBA765'], className = '', style = {} }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf, t = 0
    const animate = () => {
      t += 0.004
      const x1 = 30 + Math.sin(t) * 20
      const y1 = 20 + Math.cos(t * 0.8) * 15
      const x2 = 70 + Math.cos(t * 0.7) * 20
      const y2 = 80 + Math.sin(t * 0.9) * 15
      el.style.background = `
        radial-gradient(40% 50% at ${x1}% ${y1}%, ${colors[0]}66, transparent 70%),
        radial-gradient(45% 55% at ${x2}% ${y2}%, ${colors[1]}55, transparent 70%),
        radial-gradient(50% 60% at 50% 120%, ${colors[2]}44, transparent 70%)`
      raf = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(raf)
  }, [colors])

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'absolute', inset: 0, filter: 'blur(40px)', opacity: 0.9, ...style }}
      aria-hidden
    />
  )
}
