import { useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'

interface BootLoadingScreenProps {
  readonly durationMs: number
  readonly onComplete?: () => void
}

interface FloatingPeach {
  readonly id: number
  readonly positionXPercent: number
  readonly positionYPercent: number
  readonly delayMs: number
  readonly durationMs: number
  readonly sizePx: number
  readonly rotateDeg: number
}

const MIN_FLOATING_PEACH_COUNT = 44
const MAX_FLOATING_PEACH_COUNT = 62
const PEACH_ICON_SRC = '/favicon.ico'

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function createFloatingPeaches(count: number, durationMs: number): FloatingPeach[] {
  const maxDelayMs = Math.max(120, durationMs - 680)

  return Array.from({ length: count }, (_, index) => {
    const positionXPercent = 3 + Math.random() * 94
    const positionYPercent = 4 + Math.random() * 92

    return {
      id: index,
      positionXPercent,
      positionYPercent,
      delayMs: Math.random() * maxDelayMs,
      durationMs: 420 + Math.random() * 920,
      sizePx: 14 + Math.random() * 30,
      rotateDeg: -28 + Math.random() * 56,
    }
  })
}

export default function BootLoadingScreen({ durationMs, onComplete }: BootLoadingScreenProps): JSX.Element {
  const floatingPeachCount = useMemo(
    () => randomInt(MIN_FLOATING_PEACH_COUNT, MAX_FLOATING_PEACH_COUNT),
    [],
  )

  const floatingPeaches = useMemo(
    () => createFloatingPeaches(floatingPeachCount, durationMs),
    [durationMs, floatingPeachCount],
  )

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      onComplete?.()
    }, durationMs)

    return () => {
      globalThis.clearTimeout(timeoutId)
    }
  }, [durationMs, onComplete])

  const overlayStyle: CSSProperties = {
    ['--nectar-intro-duration' as string]: `${durationMs}ms`,
  }

  return (
    <div className="nectar-intro-overlay" style={overlayStyle} role="status" aria-live="polite">
      <div className="nectar-intro-floating-layer" aria-hidden="true">
        {floatingPeaches.map((peach) => {
          const peachStyle: CSSProperties = {
            ['--spawn-x' as string]: `${peach.positionXPercent.toFixed(2)}%`,
            ['--spawn-y' as string]: `${peach.positionYPercent.toFixed(2)}%`,
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
        <div className="nectar-intro-title-wrap">
          <p className="nectar-intro-title">
            <span className="nectar-intro-title-accent">NECTAR</span>
            <span className="nectar-intro-title-main">TP</span>
          </p>

          <div className="nectar-intro-progress" aria-hidden="true">
            <span className="nectar-intro-progress-fill" />
          </div>
        </div>
      </div>
    </div>
  )
}
