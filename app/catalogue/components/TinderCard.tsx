'use client'
import React, { useRef, useEffect } from 'react'
import Image from 'next/image'
import type { CatalogueProduct } from '@/types'
import type { FlashSale } from '../types'
import { Countdown } from './Countdown'

const fmt  = (n: number) => '₹' + n.toLocaleString('en-IN')
const disc = (o: number, s: number | null) => (!s || s >= o) ? null : Math.round(((o - s) / o) * 100) + '% off'
const imgOf = (p: CatalogueProduct) => (p.images.find(i => i.isPrimary) || p.images[0])?.url || ''
const priceOf = (p: CatalogueProduct) => p.salePrice ?? p.originalPrice

// ─── TinderCard ───────────────────────────────────────────────────────────────
// Swipe fixes applied:
//   SW-1  onPointerCancel handler — prevents card freeze on OS interruption
//   SW-2  Velocity/flick detection — fast short swipes now register
//   SW-3  Direction lock — vertical scroll intent cancels horizontal swipe
//   SW-4  Proportional threshold — 25% of card width, not fixed 90px
//   SW-5  Eased back-card response — back cards don't animate until 30% drag
// UX fixes:
//   UX-01 Swipe hint — animated gentle nudge on first card if idle 1.5s
//   UX-05 Out-of-stock variants — greyed out with strikethrough styling
//   UX-06 Swipe-up gesture — opens detail sheet
//   UX-07 WhatsApp pill moved out of position:absolute — no overlap
//   UX-11 Edge tint — subtle green/red gradient edges on the top card
export function TinderCard({
  product,
  stackIndex,
  isTop,
  dragProgress,
  onSwipe,
  onTap,
  onDragProgress,
  cardW,
  cardH,
  flashSale,
  wasSeen,
  isFirstCard,
}: {
  product: CatalogueProduct
  stackIndex: number
  isTop: boolean
  dragProgress: number
  onSwipe: (dir: 1 | -1) => void
  onTap: () => void
  onDragProgress: (p: number) => void
  cardW: number
  cardH: number
  flashSale: FlashSale
  wasSeen: boolean
  isFirstCard: boolean
}) {
  const ref        = useRef<HTMLDivElement>(null)
  const drag       = useRef({ on: false, x0: 0, y0: 0, dx: 0, dy: 0, t0: 0 })
  const dirLock    = useRef<'h' | 'v' | null>(null)  // SW-3 direction lock
  const raf        = useRef(0)
  const hintTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scale  = 1 - stackIndex * 0.05
  const shiftY = stackIndex * 14
  // SW-4: proportional threshold = 25% of card width
  const threshold = cardW * 0.25

  // Back-card drag response: SW-5 — only animate after 30% drag progress
  useEffect(() => {
    const el = ref.current
    if (!el || isTop) return
    const raw = Math.abs(dragProgress)
    const eased = Math.max(0, (raw - 0.3) / 0.7)
    el.style.transform  = `translateY(${shiftY - shiftY * eased}px) scale(${scale + (1 - scale) * eased})`
    el.style.transition = 'transform 0.08s ease'
  }, [isTop, dragProgress, scale, shiftY])

  // UX-01: swipe hint animation — gentle nudge right then back if user idle 1.5s on first card
  useEffect(() => {
    if (!isTop || !isFirstCard || !ref.current) return
    hintTimer.current = setTimeout(() => {
      const el = ref.current
      if (!el || drag.current.on) return
      // Nudge right 40px then snap back
      el.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)'
      el.style.transform  = `translateY(${shiftY}px) scale(${scale}) translateX(40px) rotate(2deg)`
      setTimeout(() => {
        if (!el) return
        el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)'
        el.style.transform  = `translateY(${shiftY}px) scale(${scale})`
      }, 420)
    }, 1500)
    return () => { if (hintTimer.current) clearTimeout(hintTimer.current) }
  }, [isTop, isFirstCard, scale, shiftY])

  const resetCard = () => {
    const el = ref.current; if (!el) return
    el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)'
    el.style.transform  = `translateY(${shiftY}px) scale(${scale})`
    const like = el.querySelector<HTMLElement>('.s-like')
    const nope = el.querySelector<HTMLElement>('.s-nope')
    if (like) like.style.opacity = '0'
    if (nope) nope.style.opacity = '0'
  }

  const onDown = (e: React.PointerEvent) => {
    if (!isTop) return
    // Cancel hint animation if user interacts
    if (hintTimer.current) { clearTimeout(hintTimer.current); hintTimer.current = null }
    drag.current = { on: true, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, t0: Date.now() }
    dirLock.current = null  // SW-3: reset direction lock on each new drag
    ref.current?.setPointerCapture(e.pointerId)
    if (ref.current) ref.current.style.transition = 'none'
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.on) return
    const dx = e.clientX - drag.current.x0
    const dy = e.clientY - drag.current.y0
    drag.current.dx = dx
    drag.current.dy = dy

    // SW-3: Direction lock — determine intent after first 10px of movement
    if (!dirLock.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      dirLock.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
    }

    // If vertical intent, cancel drag and reset card
    if (dirLock.current === 'v') {
      drag.current.on = false
      onDragProgress(0)
      resetCard()
      return
    }

    onDragProgress(Math.max(-1, Math.min(1, dx / 120)))
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      if (!ref.current) return
      ref.current.style.transform = `translate(${dx}px, ${dy * 0.35}px) rotate(${dx * 0.04}deg)`
      const like = ref.current.querySelector<HTMLElement>('.s-like')
      const nope = ref.current.querySelector<HTMLElement>('.s-nope')
      const t = Math.min(Math.abs(dx) / 80, 1)
      if (like) like.style.opacity = dx > 20 ? String(t) : '0'
      if (nope) nope.style.opacity = dx < -20 ? String(t) : '0'
    })
  }

  const onUp = () => {
    if (!drag.current.on) return
    drag.current.on = false
    onDragProgress(0)
    const { dx, dy, t0 } = drag.current
    const el = ref.current; if (!el) return

    // Tap detection — minimal movement
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)'
      el.style.transform  = `translateY(${shiftY}px) scale(${scale})`
      onTap()
      return
    }

    // UX-06: Swipe-up to open detail — upward gesture more vertical than horizontal
    if (dy < -60 && Math.abs(dy) > Math.abs(dx)) {
      el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)'
      el.style.transform  = `translateY(${shiftY}px) scale(${scale})`
      onTap()
      return
    }

    // SW-2: Velocity/flick detection — fast short swipes register
    const elapsed = Math.max(Date.now() - t0, 1)
    const vx = Math.abs(dx) / elapsed   // px/ms
    const isFlick = vx > 0.4 && Math.abs(dx) > 25

    if (Math.abs(dx) > threshold || isFlick) {
      const dir = dx > 0 ? 1 : -1
      el.style.transition = 'transform 0.35s ease, opacity 0.3s ease'
      el.style.transform  = `translate(${dir * (cardW + 300)}px, ${dy * 0.4}px) rotate(${dir * 28}deg)`
      el.style.opacity    = '0'
      setTimeout(() => onSwipe(dir as 1 | -1), 320)
    } else {
      resetCard()
    }
  }

  // SW-1: onPointerCancel — prevents card from getting stuck when OS interrupts
  const onCancel = () => {
    if (!drag.current.on) return
    drag.current.on = false
    onDragProgress(0)
    resetCard()
  }

  const img        = imgOf(product)
  const badge      = disc(product.originalPrice, product.salePrice)
  const flashPrice = flashSale?.saleMap[product.id]
  const flashDisc  = flashPrice ? Math.round(((product.originalPrice - flashPrice) / product.originalPrice) * 100) : null
  // UX-05: sort variants — in-stock first, out-of-stock last
  const sortedVariants = [...product.variants].sort((a, b) =>
    (a.stock > 0 ? 0 : 1) - (b.stock > 0 ? 0 : 1)
  )

  return (
    <div
      ref={ref}
      data-top-card={isTop ? '' : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}   // SW-1
      style={{
        position: 'absolute', width: cardW, height: cardH,
        borderRadius: 16, overflow: 'hidden', flexShrink: 0,
        cursor: isTop ? 'grab' : 'default', userSelect: 'none', touchAction: 'none',
        zIndex: 10 - stackIndex,
        transform: `translateY(${shiftY}px) scale(${scale})`,
        transformOrigin: 'center bottom', transition: 'transform 0.3s ease',
        background: '#1a1008',
        boxShadow: stackIndex === 0
          ? '0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4)'
          : '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {img
        ? <Image src={img} alt={product.name} fill
            style={{ objectFit: 'cover', objectPosition: 'top', pointerEvents: 'none' }}
            sizes="(max-width:480px) calc(100vw - 32px), 448px"
            priority={stackIndex <= 1} draggable={false}/>
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, background: 'linear-gradient(145deg,#2D1B1B,#1A0D0D)' }}>🥻</div>
      }

      {/* Main gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.05) 65%, transparent 100%)', pointerEvents: 'none' }}/>

      {/* UX-11: Edge tint indicators — subtle left/right colour hints so user knows card is swipeable */}
      {isTop && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 48, background: 'linear-gradient(to right, rgba(248,113,113,0.12), transparent)', pointerEvents: 'none', borderRadius: '16px 0 0 16px' }}/>
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 48, background: 'linear-gradient(to left, rgba(74,222,128,0.12), transparent)', pointerEvents: 'none', borderRadius: '0 16px 16px 0' }}/>
        </>
      )}

      {/* LIKED / NOPE stamps */}
      <div className="s-like" style={{ position: 'absolute', top: 36, left: 24, opacity: 0, pointerEvents: 'none', border: '3px solid #4ade80', borderRadius: 6, padding: '6px 18px', color: '#4ade80', fontSize: 22, fontWeight: 800, letterSpacing: 3, transform: 'rotate(-15deg)' }}>LIKED</div>
      <div className="s-nope" style={{ position: 'absolute', top: 36, right: 24, opacity: 0, pointerEvents: 'none', border: '3px solid #f87171', borderRadius: 6, padding: '6px 18px', color: '#f87171', fontSize: 22, fontWeight: 800, letterSpacing: 3, transform: 'rotate(15deg)' }}>NOPE</div>

      {/* UX-03: Already seen badge */}
      {wasSeen && (
        <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '3px 10px' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase' }}>Seen</span>
        </div>
      )}

      {/* Badges — top right */}
      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        {flashPrice && flashSale && (
          <span style={{ background: 'rgba(220,38,38,0.92)', backdropFilter: 'blur(8px)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            ⏱ <Countdown endsAt={flashSale.ends_at}/>
          </span>
        )}
        {flashDisc && <span style={{ background: 'rgba(220,38,38,0.92)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>{flashDisc}% off</span>}
        {!flashPrice && product.isBestseller && <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(201,168,76,0.55)', color: '#C9A84C', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>BESTSELLER</span>}
        {!flashPrice && product.isNew && !product.isBestseller && <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(139,26,43,0.55)', color: '#F8A3AF', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>NEW</span>}
        {!flashPrice && badge && <span style={{ background: 'rgba(220,38,38,0.9)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>{badge}</span>}
      </div>

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px' }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 500, color: '#fff', lineHeight: 1.1, marginBottom: 4, textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>{product.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {product.fabric && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{product.fabric}</span>}
          {product.originRegion && <><span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{product.originRegion}</span></>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 24, fontWeight: 700, color: flashPrice ? '#f87171' : '#C9A84C' }}>{fmt(flashPrice ?? priceOf(product))}</span>
            {(flashPrice || product.salePrice) && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through', marginLeft: 8 }}>{fmt(product.originalPrice)}</span>}
          </div>
          {/* UX-05: colour dots — greyed out for OOS */}
          {sortedVariants.length > 0 && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {sortedVariants.slice(0, 5).map(v => (
                <div
                  key={v.id}
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: v.colourHex || '#8B1A2B',
                    border: '2px solid rgba(255,255,255,0.5)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
                    opacity: v.stock === 0 ? 0.3 : 1,
                    position: 'relative',
                  }}
                >
                  {/* Strikethrough line for OOS */}
                  {v.stock === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '150%', height: 1.5, background: 'rgba(255,255,255,0.7)', transform: 'rotate(-45deg)' }}/>
                    </div>
                  )}
                </div>
              ))}
              {sortedVariants.length > 5 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>+{sortedVariants.length - 5}</span>}
            </div>
          )}
        </div>
        {isTop && (
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 7, textAlign: 'center', letterSpacing: 0.5 }}>
            ← skip · swipe right to save · swipe up for details →
          </p>
        )}
      </div>
    </div>
  )
}
