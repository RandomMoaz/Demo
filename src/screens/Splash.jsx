import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import Aurora from '../components/reactbits/Aurora'
import SplitText from '../components/reactbits/SplitText'
import ShinyText from '../components/reactbits/ShinyText'

export default function Splash() {
  const { go } = useApp()
  useEffect(() => {
    const id = setTimeout(() => go('language'), 2800)
    return () => clearTimeout(id)
  }, [go])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, overflow: 'hidden',
      background: 'radial-gradient(700px 500px at 50% 34%, #17281F, transparent 70%), #0B120E' }}>
      <Aurora colors={['#48B9A2', '#E8715A', '#CBA765']} />
      {/* crescent */}
      <svg viewBox="0 0 120 120" width="130" height="130" style={{ position: 'relative' }}>
        <defs>
          <mask id="c"><rect width="120" height="120" fill="#fff" /><circle cx="72" cy="52" r="30" fill="#000" /></mask>
          <radialGradient id="g"><stop offset="0%" stopColor="#F0D98A" /><stop offset="100%" stopColor="#D6B968" /></radialGradient>
        </defs>
        <g style={{ transformOrigin: '60px 58px', animation: 'cfloat 4s ease-in-out infinite' }}>
          <circle cx="60" cy="58" r="33" fill="url(#g)" mask="url(#c)" />
        </g>
        <style>{`@keyframes cfloat{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-6px) rotate(0)}}`}</style>
      </svg>
      <div className="ar" style={{ position: 'relative', fontSize: 44, color: '#E9CE86', textShadow: '0 4px 30px rgba(214,185,104,.35)' }}>
        <SplitText text="السَّلَامُ عَلَيْكُم" delay={60} />
      </div>
      <div className="ar" style={{ position: 'relative', color: '#8FA396', fontSize: 15, textAlign: 'center' }}>
        رفيق المسلم الجديد
        <div style={{ fontFamily: 'Manrope', fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase', color: '#6F8A78', marginTop: 6 }}>
          <ShinyText text="New Muslim Companion" />
        </div>
      </div>
    </div>
  )
}
