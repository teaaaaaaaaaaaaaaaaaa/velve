import { gsap } from 'gsap'
import { PropsWithChildren, useEffect, useMemo, useRef } from 'react'

type TrailConfig = {
  mouseThreshold?: number
  imageLifespan?: number
  minImageSize?: number
  maxImageSize?: number
  minMovementForImage?: number
  inDuration?: number
  outDuration?: number
  baseRotation?: number
  maxRotationFactor?: number
  speedSmoothingFactor?: number
  staggerOut?: number
}

type Props = PropsWithChildren<{
  images: string[]
  className?: string
  config?: TrailConfig
}>

const DEFAULT_CONFIG: Required<TrailConfig> = {
  mouseThreshold: 100,
  imageLifespan: 420,
  minImageSize: 120,
  maxImageSize: 200,
  minMovementForImage: 14,
  inDuration: 520,
  outDuration: 760,
  baseRotation: 20,
  maxRotationFactor: 2.6,
  speedSmoothingFactor: 0.24,
  staggerOut: 28,
}

type ActiveAsset = {
  el: HTMLDivElement
  removeAt: number
}

function isInlineSvg(value: string) {
  return value.trim().startsWith('<svg')
}

export function ImageTrailEffect({ images, children, className = '', config }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const activeTrailRef = useRef<ActiveAsset[]>([])
  const poolRef = useRef<HTMLDivElement[]>([])
  const imageIndexRef = useRef(0)

  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])

  const stateRef = useRef({
    isPointerInside: false,
    mouseX: 0,
    mouseY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    prevMouseX: 0,
    prevMouseY: 0,
    lastMoveTime: Date.now(),
    smoothedSpeed: 0,
    raf: 0,
  })

  useEffect(() => {
    const node = containerRef.current
    if (!node || images.length === 0) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches

    if (prefersReducedMotion || !supportsHover) {
      return
    }

    const nextImageSrc = () => {
      const src = images[imageIndexRef.current % images.length]
      imageIndexRef.current += 1
      return src
    }

    const recycleImage = (el: HTMLDivElement) => {
      gsap.killTweensOf(el)
      el.remove()
      el.innerHTML = ''
      el.style.opacity = '0'
      el.style.transform = 'translate(-50%, -50%) scale(0)'
      if (poolRef.current.length < 24) {
        poolRef.current.push(el)
      }
    }

    const acquireImage = () => {
      const pooled = poolRef.current.pop()
      if (pooled) return pooled

      const wrapper = document.createElement('div')
      wrapper.className = 'trail-image'
      return wrapper
    }

    const calcSpeed = () => {
      const now = Date.now()
      const dt = now - stateRef.current.lastMoveTime
      if (dt <= 0) return stateRef.current.smoothedSpeed

      const dist = Math.hypot(
        stateRef.current.mouseX - stateRef.current.prevMouseX,
        stateRef.current.mouseY - stateRef.current.prevMouseY
      )

      const rawSpeed = Math.min(dist / dt, 1)
      const smoothed =
        stateRef.current.smoothedSpeed +
        (rawSpeed - stateRef.current.smoothedSpeed) * cfg.speedSmoothingFactor

      stateRef.current.smoothedSpeed = smoothed
      stateRef.current.lastMoveTime = now
      stateRef.current.prevMouseX = stateRef.current.mouseX
      stateRef.current.prevMouseY = stateRef.current.mouseY

      return smoothed
    }

    const spawnTrail = (speed: number) => {
      const rect = node.getBoundingClientRect()
      const x = stateRef.current.mouseX - rect.left
      const y = stateRef.current.mouseY - rect.top

      const sizeFactor = Math.min(speed * 1.8, 1)
      const size = cfg.minImageSize + (cfg.maxImageSize - cfg.minImageSize) * sizeFactor
      const rotationFactor = 1 + sizeFactor * (cfg.maxRotationFactor - 1)
      const rotation = (Math.random() - 0.5) * cfg.baseRotation * rotationFactor

      const asset = nextImageSrc()
      const el = acquireImage()
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.style.width = `${size}px`
      el.style.opacity = '0'
      el.style.transform = 'translate(-50%, -50%) scale(0)'

      if (isInlineSvg(asset)) {
        el.innerHTML = asset
        const svg = el.querySelector('svg')
        if (svg) {
          svg.style.width = '100%'
          svg.style.height = 'auto'
          svg.style.display = 'block'
        }
      } else {
        el.innerHTML = `<img src="${asset}" alt="" draggable="false" />`
      }

      node.appendChild(el)

      gsap.set(el, { rotation })
      gsap.to(el, {
        opacity: 1,
        scale: 1,
        duration: cfg.inDuration / 1000,
        ease: 'power2.out',
      })

      activeTrailRef.current.push({
        el,
        removeAt: Date.now() + cfg.imageLifespan,
      })
    }

    const cullOld = () => {
      const now = Date.now()
      const expired = activeTrailRef.current.filter((item) => now >= item.removeAt)

      expired.forEach(({ el }, index) => {
        gsap.to(el, {
          opacity: 0,
          scale: 0,
          duration: cfg.outDuration / 1000,
          delay: (index * cfg.staggerOut) / 1000,
          ease: 'power4.inOut',
          onComplete: () => recycleImage(el),
        })
      })

      activeTrailRef.current = activeTrailRef.current.filter((item) => now < item.removeAt)
    }

    const tryEmit = () => {
      const movedSinceLast = Math.hypot(
        stateRef.current.mouseX - stateRef.current.lastMouseX,
        stateRef.current.mouseY - stateRef.current.lastMouseY
      )
      const movedAtAll = Math.hypot(
        stateRef.current.mouseX - stateRef.current.prevMouseX,
        stateRef.current.mouseY - stateRef.current.prevMouseY
      )

      if (movedSinceLast < cfg.mouseThreshold || movedAtAll < cfg.minMovementForImage) {
        return
      }

      stateRef.current.lastMouseX = stateRef.current.mouseX
      stateRef.current.lastMouseY = stateRef.current.mouseY
      const speed = calcSpeed()
      spawnTrail(speed)
    }

    const tick = () => {
      if (stateRef.current.isPointerInside) {
        tryEmit()
      }
      cullOld()
      stateRef.current.raf = window.requestAnimationFrame(tick)
    }

    const onPointerMove = (event: PointerEvent) => {
      stateRef.current.mouseX = event.clientX
      stateRef.current.mouseY = event.clientY
    }

    const onPointerEnter = (event: PointerEvent) => {
      stateRef.current.isPointerInside = true
      stateRef.current.mouseX = event.clientX
      stateRef.current.mouseY = event.clientY
      stateRef.current.lastMouseX = event.clientX
      stateRef.current.lastMouseY = event.clientY
      stateRef.current.prevMouseX = event.clientX
      stateRef.current.prevMouseY = event.clientY
      stateRef.current.lastMoveTime = Date.now()
      stateRef.current.smoothedSpeed = 0
    }

    const onPointerLeave = () => {
      stateRef.current.isPointerInside = false
    }

    node.addEventListener('pointermove', onPointerMove, { passive: true })
    node.addEventListener('pointerenter', onPointerEnter, { passive: true })
    node.addEventListener('pointerleave', onPointerLeave, { passive: true })
    stateRef.current.raf = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(stateRef.current.raf)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerenter', onPointerEnter)
      node.removeEventListener('pointerleave', onPointerLeave)
      activeTrailRef.current.forEach(({ el }) => recycleImage(el))
      activeTrailRef.current = []
      poolRef.current.forEach((el) => el.remove())
      poolRef.current = []
    }
  }, [cfg, images])

  return (
    <div ref={containerRef} className={`trail-shell ${className}`.trim()}>
      {children}
    </div>
  )
}
