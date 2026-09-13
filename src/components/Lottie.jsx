import Lottie from 'lottie-react'
import rashed from '../assets/rashed.json'
import mosque from '../assets/mosque.json'
import wakeup from '../assets/wakeup.json'
import salam from '../assets/salam.json'

export const ANIM = { rashed, mosque, wakeup, salam }

export function Anim({ name, style, className }) {
  const data = ANIM[name]
  if (!data) return null
  return <Lottie animationData={data} loop autoplay style={{ width: '100%', height: '100%', ...style }} className={className} />
}

export function RashedAvatar({ style, className }) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', ...style }}>
      <Anim name="rashed" />
    </div>
  )
}
