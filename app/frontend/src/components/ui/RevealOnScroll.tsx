import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

interface RevealOnScrollProps {
  readonly children: ReactNode
  readonly className?: string
  readonly delayMs?: number
  readonly rootMargin?: string
  readonly threshold?: number
  readonly distance?: number
  readonly durationMs?: number
  readonly style?: CSSProperties
}

export default function RevealOnScroll({
  children,
  className = '',
  delayMs = 0,
  rootMargin = '0px 0px -6% 0px',
  threshold = 0.05,
  distance = 10,
  durationMs = 380,
  style,
}: RevealOnScrollProps): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { rootMargin, threshold },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin, threshold])

  const mergedStyle: CSSProperties = {
    transitionProperty: 'opacity, transform',
    transitionDuration: `${durationMs}ms`,
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    transitionDelay: revealed ? `${delayMs}ms` : '0ms',
    opacity: revealed ? 1 : 0,
    transform: revealed ? 'translate3d(0, 0, 0)' : `translate3d(0, ${distance}px, 0)`,
    willChange: 'opacity, transform',
    ...style,
  }

  return (
    <div ref={ref} className={className} style={mergedStyle}>
      {children}
    </div>
  )
}
