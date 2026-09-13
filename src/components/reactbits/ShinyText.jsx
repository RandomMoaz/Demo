// ShinyText — sweeping shine across text. ReactBits-style (https://reactbits.dev).
export default function ShinyText({ text, className = '', style = {}, speed = 4 }) {
  return (
    <span className={`shiny-text ${className}`} style={style}>
      {text}
      <style>{`
        .shiny-text{
          background: linear-gradient(120deg,
            currentColor 40%,
            #fff8dc 50%,
            currentColor 60%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shine ${speed}s linear infinite;
        }
        @keyframes shine{ 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
    </span>
  )
}
