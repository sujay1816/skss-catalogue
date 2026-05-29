'use client'
import React, { useRef, useEffect } from 'react'
import Image from 'next/image'
import type { CatalogueProduct } from '@/types'
import type { FlashSale } from '../types'
import { Countdown } from './Countdown'

const fmt    = (n: number) => '₹' + n.toLocaleString('en-IN')
const disc   = (o: number, s: number | null) => (s === null || s >= o) ? null : Math.round(((o - s) / o) * 100) + '% off'
const imgOf  = (p: CatalogueProduct) => (p.images.find(i => i.isPrimary) || p.images[0])?.url || ''
const priceOf = (p: CatalogueProduct) => p.salePrice ?? p.originalPrice
// BUG-9 FIX: compute isNew at render-time from createdAt (not from the cached server route)
const isNewProduct = (p: CatalogueProduct) => (Date.now() - new Date(p.createdAt).getTime()) < 30 * 86400000

// FIX-10: distinct haptic for save vs skip
// FIX-14: removed bottom hint text (redundant with UX-B button labels)
// FIX-15: CSS variables for brand colours
export function TinderCard({
  product, stackIndex, isTop, dragProgress,
  onSwipe, onTap, onVideoTap, onDragProgress, cardW, cardH,
  flashSale, wasSeen, isFirstCard, isLoved, onToggleSave,
}: {
  product: CatalogueProduct
  stackIndex: number
  isTop: boolean
  dragProgress: number
  onSwipe: (dir: 1 | -1) => void
  onTap: () => void
  /** Called when the ▶ Video badge is tapped — opens detail focused on the drape video */
  onVideoTap?: () => void
  onDragProgress: (p: number) => void
  cardW: number
  cardH: number
  flashSale: FlashSale
  wasSeen: boolean
  isFirstCard: boolean
  isLoved: boolean
  onToggleSave: () => void
}) {
  const ref       = useRef<HTMLDivElement>(null)
  const drag      = useRef({ on: false, x0: 0, y0: 0, dx: 0, dy: 0, t0: 0 })
  const dirLock   = useRef<'h' | 'v' | null>(null)
  const raf       = useRef(0)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scale     = 1 - stackIndex * 0.05
  const shiftY    = stackIndex * 14
  const threshold = cardW * 0.25

  useEffect(() => {
    const el = ref.current
    if (!el || isTop) return
    const raw   = Math.abs(dragProgress)
    const eased = Math.max(0, (raw - 0.3) / 0.7)
    el.style.transform  = `translateY(${shiftY - shiftY * eased}px) scale(${scale + (1 - scale) * eased})`
    el.style.transition = 'transform 0.08s ease'
  }, [isTop, dragProgress, scale, shiftY])

  useEffect(() => {
    if (!isTop || !isFirstCard || !ref.current) return
    hintTimer.current = setTimeout(() => {
      const el = ref.current
      if (!el || drag.current.on) return
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
    if (hintTimer.current) { clearTimeout(hintTimer.current); hintTimer.current = null }
    drag.current = { on: true, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, t0: Date.now() }
    dirLock.current = null
    ref.current?.setPointerCapture(e.pointerId)
    if (ref.current) ref.current.style.transition = 'none'
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.on) return
    const dx = e.clientX - drag.current.x0
    const dy = e.clientY - drag.current.y0
    drag.current.dx = dx; drag.current.dy = dy

    if (!dirLock.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      dirLock.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
    }
    if (dirLock.current === 'v') { drag.current.on = false; onDragProgress(0); resetCard(); return }

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
    drag.current.on = false; onDragProgress(0)
    const { dx, dy, t0 } = drag.current
    const el = ref.current; if (!el) return

    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)'
      el.style.transform  = `translateY(${shiftY}px) scale(${scale})`
      onTap(); return
    }
    if (dy < -60 && Math.abs(dy) > Math.abs(dx)) {
      el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)'
      el.style.transform  = `translateY(${shiftY}px) scale(${scale})`
      onTap(); return
    }
    const elapsed = Math.max(Date.now() - t0, 1)
    const vx      = Math.abs(dx) / elapsed
    const isFlick = vx > 0.4 && Math.abs(dx) > 25

    if (Math.abs(dx) > threshold || isFlick) {
      const dir = dx > 0 ? 1 : -1
      el.style.transition = 'transform 0.35s ease, opacity 0.3s ease'
      el.style.transform  = `translate(${dir * (cardW + 300)}px, ${dy * 0.4}px) rotate(${dir * 28}deg)`
      el.style.opacity    = '0'
      setTimeout(() => onSwipe(dir as 1 | -1), 320)
    } else resetCard()
  }

  const onCancel = () => {
    if (!drag.current.on) return
    drag.current.on = false; onDragProgress(0); resetCard()
  }

  const img        = imgOf(product)
  const badge      = disc(product.originalPrice, product.salePrice)
  const flashPrice = flashSale?.saleMap[product.id]
  const flashDisc  = flashPrice ? Math.round(((product.originalPrice - flashPrice) / product.originalPrice) * 100) : null
  const sortedVars = [...product.variants].sort((a, b) => (a.stock > 0 ? 0 : 1) - (b.stock > 0 ? 0 : 1))

  return (
    <div
      ref={ref}
      data-top-card={isTop ? '' : undefined}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
      style={{ position: 'absolute', width: cardW, height: cardH, borderRadius: 16, overflow: 'hidden', flexShrink: 0, cursor: isTop ? 'grab' : 'default', userSelect: 'none', touchAction: 'none', zIndex: 10 - stackIndex, transform: `translateY(${shiftY}px) scale(${scale})`, transformOrigin: 'center bottom', transition: 'transform 0.3s ease', background: '#1a1008', boxShadow: stackIndex === 0 ? '0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.4)' }}
    >
      {img
        ? <Image src={img} alt={product.name} fill style={{ objectFit: 'cover', objectPosition: 'top', pointerEvents: 'none' }} sizes="(max-width:480px) calc(100vw - 32px), 448px" priority={stackIndex <= 1} draggable={false}/>
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, background: 'linear-gradient(145deg,#2D1B1B,#1A0D0D)' }}>🥻</div>
      }

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.05) 65%, transparent 100%)', pointerEvents: 'none' }}/>

      {isTop && (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 48, background: 'linear-gradient(to right, rgba(248,113,113,0.12), transparent)', pointerEvents: 'none', borderRadius: '16px 0 0 16px' }}/>
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 48, background: 'linear-gradient(to left, rgba(74,222,128,0.12), transparent)', pointerEvents: 'none', borderRadius: '0 16px 16px 0' }}/>
        </>
      )}

      <div className="s-like" style={{ position: 'absolute', top: 36, left: 24, opacity: 0, pointerEvents: 'none', border: '3px solid #4ade80', borderRadius: 6, padding: '6px 18px', color: '#4ade80', fontSize: 22, fontWeight: 800, letterSpacing: 3, transform: 'rotate(-15deg)' }}>LIKED</div>
      <div className="s-nope" style={{ position: 'absolute', top: 36, right: 24, opacity: 0, pointerEvents: 'none', border: '3px solid #f87171', borderRadius: 6, padding: '6px 18px', color: '#f87171', fontSize: 22, fontWeight: 800, letterSpacing: 3, transform: 'rotate(15deg)' }}>NOPE</div>

      {wasSeen && (
        <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '3px 10px' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase' }}>Seen</span>
        </div>
      )}

      {/* Change 4: ▶ Video badge — only on the top card when a drape video exists */}
      {isTop && product.videoUrl && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation()
            if (onVideoTap) onVideoTap()
            else onTap()
          }}
          aria-label="Watch drape video"
          style={{
            position: 'absolute',
            top: wasSeen ? 44 : 14,
            left: 14,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 20, padding: '4px 10px',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.85)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.65)' }}
        >
          {/* Play icon */}
          <svg width="9" height="10" viewBox="0 0 10 12" fill="#fff">
            <path d="M0 0L10 6L0 12V0Z"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', letterSpacing: 0.5 }}>Video</span>
        </button>
      )}

      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        {flashPrice && flashSale && (
          <span style={{ background: 'rgba(220,38,38,0.92)', backdropFilter: 'blur(8px)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>⏱ <Countdown endsAt={flashSale.ends_at}/></span>
        )}
        {flashDisc && <span style={{ background: 'rgba(220,38,38,0.92)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>{flashDisc}% off</span>}
        {!flashPrice && product.isBestseller && <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(201,168,76,0.55)', color: 'var(--gold, #C9A84C)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>BESTSELLER</span>}
        {!flashPrice && isNewProduct(product) && !product.isBestseller && <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(139,26,43,0.55)', color: '#F8A3AF', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>NEW</span>}
        {!flashPrice && badge && <span style={{ background: 'rgba(220,38,38,0.9)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>{badge}</span>}
      </div>

      {/* FIX-10: heart button with distinct save haptic */}
      {isTop && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation()
            // FIX-10: double-pulse for save, single for remove
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(isLoved ? 10 : [8, 30, 8])
            }
            onToggleSave()
          }}
          style={{ position: 'absolute', bottom: 64, right: 16, width: 36, height: 36, borderRadius: '50%', background: isLoved ? 'rgba(139,26,43,0.7)' : 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: isLoved ? '1.5px solid rgba(248,113,113,0.6)' : '1.5px solid rgba(255,255,255,0.2)', color: isLoved ? '#F87171' : 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
          aria-label={isLoved ? 'Remove from shortlist' : 'Save to shortlist'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isLoved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      )}

      {/* bottom info — FIX-14: hint text removed */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px' }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 500, color: '#fff', lineHeight: 1.1, marginBottom: 4, textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>{product.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {product.fabric && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{product.fabric}</span>}
          {product.originRegion && <><span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{product.originRegion}</span></>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 24, fontWeight: 700, color: flashPrice ? '#f87171' : 'var(--gold, #C9A84C)' }}>{fmt(flashPrice ?? priceOf(product))}</span>
            {(flashPrice !== undefined || product.salePrice !== null) && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through', marginLeft: 8 }}>{fmt(product.originalPrice)}</span>}
          </div>
          {sortedVars.length > 0 && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {sortedVars.slice(0, 5).map(v => (
                <div key={v.id} style={{ width: 14, height: 14, borderRadius: '50%', background: v.colourHex || 'var(--crimson, #8B1A2B)', border: '2px solid rgba(255,255,255,0.5)', boxShadow: '0 1px 4px rgba(0,0,0,0.6)', opacity: v.stock === 0 ? 0.3 : 1, position: 'relative' }}>
                  {v.stock === 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '150%', height: 1.5, background: 'rgba(255,255,255,0.7)', transform: 'rotate(-45deg)' }}/></div>}
                </div>
              ))}
              {sortedVars.length > 5 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>+{sortedVars.length - 5}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
