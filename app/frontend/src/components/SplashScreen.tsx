import { useEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'

interface SplashScreenProps {
  readonly durationMs?: number
  readonly onComplete?: () => void
}

interface ViewportSize {
  readonly width: number
  readonly height: number
}

interface SafeZone {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

interface Point {
  readonly left: number
  readonly top: number
}

interface PeachParticle {
  readonly id: number
  readonly left: number
  readonly top: number
  readonly sizePx: number
  readonly delayMs: number
  readonly durationMs: number
  readonly maxOpacity: number
  readonly driftXPx: number
  readonly driftYPx: number
  readonly tiltDeg: number
}

const DEFAULT_DURATION_MS = 2000
const MIN_PARTICLE_COUNT = 34
const MAX_PARTICLE_COUNT = 44
const MIN_PARTICLE_SIZE_PX = 18
const MAX_PARTICLE_SIZE_PX = 52
const EXCLUSION_ZONE_WIDTH_PX = 400
const EXCLUSION_ZONE_HEIGHT_PX = 300
const MAX_PLACEMENT_ATTEMPTS = 120

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getViewportSize(): ViewportSize {
  if (globalThis.window === undefined) {
    return { width: 1366, height: 768 }
  }

  return {
    width: Math.max(globalThis.window.innerWidth, 320),
    height: Math.max(globalThis.window.innerHeight, 320),
  }
}

function calculateSafeZone(viewport: ViewportSize): SafeZone {
  const centerX = viewport.width / 2
  const centerY = viewport.height / 2
  const zoneWidth = Math.min(EXCLUSION_ZONE_WIDTH_PX, Math.max(280, viewport.width - 40))
  const zoneHeight = Math.min(EXCLUSION_ZONE_HEIGHT_PX, Math.max(220, viewport.height - 40))

  const left = centerX - zoneWidth / 2
  const right = centerX + zoneWidth / 2
  const top = centerY - zoneHeight / 2
  const bottom = centerY + zoneHeight / 2

  return {
    left: clamp(left, 0, viewport.width),
    right: clamp(right, 0, viewport.width),
    top: clamp(top, 0, viewport.height),
    bottom: clamp(bottom, 0, viewport.height),
  }
}

function intersectsSafeZone(point: Point, sizePx: number, safeZone: SafeZone): boolean {
  const particleRight = point.left + sizePx
  const particleBottom = point.top + sizePx

  return (
    point.left < safeZone.right &&
    particleRight > safeZone.left &&
    point.top < safeZone.bottom &&
    particleBottom > safeZone.top
  )
}

function randomPointWithinBounds(viewport: ViewportSize, sizePx: number): Point {
  const maxLeft = Math.max(0, viewport.width - sizePx)
  const maxTop = Math.max(0, viewport.height - sizePx)

  return {
    left: randomFloat(0, maxLeft),
    top: randomFloat(0, maxTop),
  }
}

function fallbackPointOutsideSafeZone(
  viewport: ViewportSize,
  sizePx: number,
  safeZone: SafeZone,
): Point {
  const maxLeft = Math.max(0, viewport.width - sizePx)
  const maxTop = Math.max(0, viewport.height - sizePx)

  const ranges = [
    {
      leftMin: 0,
      leftMax: maxLeft,
      topMin: 0,
      topMax: Math.max(0, safeZone.top - sizePx),
    },
    {
      leftMin: 0,
      leftMax: maxLeft,
      topMin: Math.min(maxTop, safeZone.bottom),
      topMax: maxTop,
    },
    {
      leftMin: 0,
      leftMax: Math.max(0, safeZone.left - sizePx),
      topMin: 0,
      topMax: maxTop,
    },
    {
      leftMin: Math.min(maxLeft, safeZone.right),
      leftMax: maxLeft,
      topMin: 0,
      topMax: maxTop,
    },
  ].filter((range) => range.leftMax >= range.leftMin && range.topMax >= range.topMin)

  if (ranges.length === 0) {
    return { left: 0, top: 0 }
  }

  const chosenRange = ranges[randomInt(0, ranges.length - 1)]

  return {
    left: randomFloat(chosenRange.leftMin, chosenRange.leftMax || chosenRange.leftMin),
    top: randomFloat(chosenRange.topMin, chosenRange.topMax || chosenRange.topMin),
  }
}

function generateParticlePosition(
  viewport: ViewportSize,
  sizePx: number,
  safeZone: SafeZone,
): Point {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
    const point = randomPointWithinBounds(viewport, sizePx)
    if (!intersectsSafeZone(point, sizePx, safeZone)) {
      return point
    }
  }

  return fallbackPointOutsideSafeZone(viewport, sizePx, safeZone)
}

function createParticles(durationMs: number): PeachParticle[] {
  const viewport = getViewportSize()
  const safeZone = calculateSafeZone(viewport)
  const count = randomInt(MIN_PARTICLE_COUNT, MAX_PARTICLE_COUNT)
  const minLoopDurationMs = Math.max(900, Math.floor(durationMs * 0.34))
  const maxLoopDurationMs = Math.max(minLoopDurationMs + 120, Math.floor(durationMs * 0.58))

  return Array.from({ length: count }, (_, index) => {
    const sizePx = randomInt(MIN_PARTICLE_SIZE_PX, MAX_PARTICLE_SIZE_PX)
    const point = generateParticlePosition(viewport, sizePx, safeZone)
    const loopDurationMs = randomInt(minLoopDurationMs, maxLoopDurationMs)
    const evenPhaseOffsetMs = Math.floor((index / count) * loopDurationMs)
    const jitterMs = randomInt(-120, 120)
    const delayMs = clamp(
      -(evenPhaseOffsetMs + jitterMs),
      -loopDurationMs,
      0,
    )

    return {
      id: index,
      left: point.left,
      top: point.top,
      sizePx,
      delayMs,
      durationMs: loopDurationMs,
      maxOpacity: randomFloat(0.72, 1),
      driftXPx: randomFloat(-72, 72),
      driftYPx: randomFloat(-108, 108),
      tiltDeg: randomFloat(-18, 18),
    }
  })
}

function toParticleStyle(particle: PeachParticle): CSSProperties {
  return {
    left: `${particle.left.toFixed(2)}px`,
    top: `${particle.top.toFixed(2)}px`,
    width: `${particle.sizePx}px`,
    height: `${particle.sizePx}px`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ['--splash-max-opacity' as string]: particle.maxOpacity.toFixed(2),
    ['--splash-drift-x' as string]: `${particle.driftXPx.toFixed(2)}px`,
    ['--splash-drift-y' as string]: `${particle.driftYPx.toFixed(2)}px`,
    ['--splash-tilt' as string]: `${particle.tiltDeg.toFixed(2)}deg`,
    animation: `nectar-splash-gunshot ${particle.durationMs}ms linear ${particle.delayMs}ms infinite both`,
  }
}

function SplashGlyph(): JSX.Element {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="splashParticleGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="22" fill="url(#splashParticleGradient)" opacity="0.9" />
      <circle cx="32" cy="32" r="13" fill="#fff7ed" opacity="0.8" />
      <circle cx="24" cy="24" r="4" fill="#ffffff" opacity="0.65" />
    </svg>
  )
}

export default function SplashScreen({ durationMs = DEFAULT_DURATION_MS, onComplete }: SplashScreenProps): JSX.Element {
  const particles = useMemo(() => createParticles(durationMs), [durationMs])
  const progressFillRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const progressFillElement = progressFillRef.current
    if (progressFillElement === null) {
      return
    }

    progressFillElement.style.transform = 'scaleX(0)'

    const start = globalThis.performance.now()
    let animationFrameId = 0

    const renderProgress = (timestamp: number): void => {
      const elapsedMs = timestamp - start
      const ratio = clamp(elapsedMs / durationMs, 0, 1)
      progressFillElement.style.transform = `scaleX(${ratio.toFixed(4)})`

      if (ratio < 1) {
        animationFrameId = globalThis.requestAnimationFrame(renderProgress)
      }
    }

    animationFrameId = globalThis.requestAnimationFrame(renderProgress)

    return () => {
      globalThis.cancelAnimationFrame(animationFrameId)
    }
  }, [durationMs])

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      onComplete?.()
    }, durationMs)

    return () => {
      globalThis.clearTimeout(timeoutId)
    }
  }, [durationMs, onComplete])

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-50" role="status" aria-live="polite">
      <div className="absolute inset-0" aria-hidden="true">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="pointer-events-none absolute select-none"
            style={toParticleStyle(particle)}
          >
            <SplashGlyph />
          </span>
        ))}
      </div>

      <div className="relative z-10 flex h-full w-full items-center justify-center px-4">
        <div className="flex w-full max-w-xl flex-col items-center">
          <h1 className="flex items-baseline text-5xl font-extrabold leading-none tracking-tight xs:text-6xl sm:text-7xl lg:text-8xl">
            <span className="text-orange-500">Nectar</span>
            <span className="ml-2 text-slate-900">TP</span>
          </h1>

          <div
            className="mt-6 h-1.5 w-[min(16rem,82vw)] overflow-hidden rounded-full border border-slate-200 bg-slate-100 xs:w-64"
            aria-hidden="true"
          >
            <div
              ref={progressFillRef}
              className="h-full origin-left scale-x-0 rounded-full bg-orange-500 will-change-transform"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
