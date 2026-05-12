import { useMemo } from 'react'
import type { CSSProperties } from 'react'

interface BootLoadingScreenProps {
  readonly durationMs: number
}

interface FloatingPeach {
  readonly id: number
  readonly offsetX: number
  readonly offsetY: number
  readonly delayMs: number
  readonly durationMs: number
  readonly sizePx: number
  readonly rotateDeg: number
}

const FLOATING_PEACH_COUNT = 24
const PEACH_ICON_SRC = '/favicon.ico'

function createFloatingPeaches(count: number): FloatingPeach[] {
  return Array.from({ length: count }, (_, index) => {
    const angleRad = Math.random() * Math.PI * 2
    const radius = 170 + Math.random() * 300
    const offsetX = Math.cos(angleRad) * radius
    const offsetY = Math.sin(angleRad) * radius * (0.64 + Math.random() * 0.42)

    return {
      id: index,
      offsetX,
      offsetY,
      delayMs: 80 + Math.random() * 2300,
      durationMs: 720 + Math.random() * 980,
      sizePx: 18 + Math.random() * 28,
      rotateDeg: -26 + Math.random() * 52,
    }
  })
}

export default function BootLoadingScreen({ durationMs }: BootLoadingScreenProps): JSX.Element {
  const floatingPeaches = useMemo(() => createFloatingPeaches(FLOATING_PEACH_COUNT), [])

  const overlayStyle: CSSProperties = {
    ['--nectar-intro-duration' as string]: `${durationMs}ms`,
  }

  return (
    <div className="nectar-intro-overlay" style={overlayStyle} role="status" aria-live="polite">
      <div className="nectar-intro-floating-layer" aria-hidden="true">
        {floatingPeaches.map((peach) => {
          const peachStyle: CSSProperties = {
            ['--float-x' as string]: `${peach.offsetX.toFixed(1)}px`,
            ['--float-y' as string]: `${peach.offsetY.toFixed(1)}px`,
            ['--float-delay' as string]: `${peach.delayMs.toFixed(0)}ms`,
            ['--float-duration' as string]: `${peach.durationMs.toFixed(0)}ms`,
            ['--float-size' as string]: `${peach.sizePx.toFixed(0)}px`,
            ['--float-rotate' as string]: `${peach.rotateDeg.toFixed(0)}deg`,
          }

          return (
            <img
              key={peach.id}
              className="nectar-intro-floating-peach"
              style={peachStyle}
              src={PEACH_ICON_SRC}
              alt=""
            />
          )
        })}
      </div>

      <div className="nectar-intro-center">
        <img className="nectar-intro-logo" src={PEACH_ICON_SRC} alt="" aria-hidden="true" />

        <div className="nectar-intro-title-wrap">
          <p className="nectar-intro-title">
            <span className="nectar-intro-title-accent">Nectra</span>
            <span className="nectar-intro-title-main">TP</span>
          </p>
          <p className="nectar-intro-subtitle">Transfer Pricing Intelligence</p>
        </div>

        <div className="nectar-intro-progress" aria-hidden="true">
          <span className="nectar-intro-progress-fill" />
        </div>
      </div>
    </div>
  )
}
