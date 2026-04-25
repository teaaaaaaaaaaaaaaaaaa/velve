import logo1Raw from './logos/logo1.svg?raw'
import logo2Raw from './logos/logo2.svg?raw'
import logo4Raw from './logos/logo4.svg?raw'
import logo6Raw from './logos/logo6.svg?raw'

import { ImageTrailEffect } from './components/ImageTrailEffect'

const TRAIL_COLORS = ['#431A43', '#9DD3E4', '#CBDA63', '#2B2A2B']

function tintSvg(svg: string, color: string) {
  return svg
    .replace(/fill="black"/gi, `fill="${color}"`)
    .replace(/fill="#000000"/gi, `fill="${color}"`)
    .replace(/fill="#000"/gi, `fill="${color}"`)
}

const trailImages = [logo1Raw, logo2Raw, logo4Raw, logo6Raw].flatMap((svg) =>
  TRAIL_COLORS.map((color) => tintSvg(svg, color))
)

export default function App() {
  return (
    <ImageTrailEffect
      images={trailImages}
      config={{
        mouseThreshold: 96,
        imageLifespan: 420,
        minImageSize: 120,
        maxImageSize: 210,
        minMovementForImage: 14,
      }}
      className="landing-shell"
    >
      <div className="landing-halo landing-halo-left" />
      <div className="landing-halo landing-halo-right" />

      <section className="landing-card" aria-label="Velve coming soon">
        <div className="copy-wrap">
          <h1>Velve is coming soon.</h1>
        </div>
      </section>
    </ImageTrailEffect>
  )
}
