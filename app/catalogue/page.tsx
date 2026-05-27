'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import type { CatalogueProduct, WishlistItem } from '@/types'

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || ''
const WA_NUMBER      = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
const UNDO_MS        = 3500
const THRESHOLD      = 100

// ── utils ─────────────────────────────────────────────────────────────────────
const fmt  = (n: number) => '₹' + n.toLocaleString('en-IN')
const disc = (o: number, s: number | null) => (!s || s >= o) ? null : Math.round(((o - s) / o) * 100) + '% off'
const imgOf = (p: CatalogueProduct) => (p.images.find(i => i.isPrimary) || p.images[0])?.url || ''
const priceOf = (p: CatalogueProduct) => p.salePrice ?? p.originalPrice
const toWL = (p: CatalogueProduct): WishlistItem => ({
  id: p.id, name: p.name, slug: p.slug, image: imgOf(p),
  fabric: p.fabric, categoryName: p.categoryName,
  originalPrice: p.originalPrice, salePrice: p.salePrice,
})
const buildWAMsg = (items: WishlistItem[]) => {
  const list = items.map((it, i) => `${i + 1}. ${it.name} — ${fmt(it.salePrice ?? it.originalPrice)}`).join('\n')
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hi! I browsed your saree catalogue and shortlisted:\n\n${list}\n\nCan we schedule a video call to see these in detail?`)}`
}

// ── TinderCard ────────────────────────────────────────────────────────────────
// Exactly how Tinder works:
// • Cards are stacked with a FIXED pixel size (not % of parent)
// • The container has overflow:hidden — clips back cards completely
// • Back cards scale down and translate down (translateY), never sideways
// • Back cards animate toward their "active" state as the front card drags
// • On release below threshold → spring back
// • On release above threshold → fly off screen, callback fires
function TinderCard({
  product, zIndex, isTop, dragProgress,
  onSwipe, onTap, cardW, cardH,
}: {
  product: CatalogueProduct
  zIndex: number
  isTop: boolean
  dragProgress: number   // -1 to 1, used to animate back cards
  onSwipe: (dir: 1 | -1) => void
  onTap: () => void
  cardW: number
  cardH: number
}) {
  const ref   = useRef<HTMLDivElement>(null)
  const state = useRef({ dragging: false, x0: 0, y0: 0, dx: 0, dy: 0 })
  const raf   = useRef(0)

  // Stack position based on depth (0 = top, 1 = middle, 2 = back)
  const depth = 2 - zIndex   // 0 for top, 1 for middle, 2 for back
  const baseScale = 1 - depth * 0.05
  const baseY     = depth * 14   // px pushed down

  // Animate back cards toward active position based on front card drag
  const abs = Math.abs(dragProgress)
  const liftScale = baseScale + (1 - baseScale) * abs
  const liftY     = baseY - baseY * abs

  useEffect(() => {
    const el = ref.current
    if (!el || isTop) return
    el.style.transform = `translateY(${liftY}px) scale(${liftScale})`
    el.style.transition = 'transform 0.1s ease'
  }, [isTop, liftScale, liftY])

  // Initial position
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.transform = `translateY(${baseY}px) scale(${baseScale})`
    el.style.transition = 'none'
  }, []) // eslint-disable-line

  const onDown = (e: React.PointerEvent) => {
    if (!isTop) return
    state.current = { dragging: true, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }
    ref.current?.setPointerCapture(e.pointerId)
    if (ref.current) ref.current.style.transition = 'none'
  }

  const onMove = (e: React.PointerEvent) => {
    if (!state.current.dragging) return
    const dx = e.clientX - state.current.x0
    const dy = e.clientY - state.current.y0
    state.current.dx = dx
    state.current.dy = dy
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      if (!ref.current) return
      const rot   = dx * 0.04
      ref.current.style.transform = `translate(${dx}px, ${dy * 0.4}px) rotate(${rot}deg)`
      // Feedback stamps
      const like = ref.current.querySelector<HTMLElement>('.stamp-like')
      const nope = ref.current.querySelector<HTMLElement>('.stamp-nope')
      const t = Math.min(Math.abs(dx) / 80, 1)
      if (like) like.style.opacity = dx > 20 ? String(t) : '0'
      if (nope) nope.style.opacity = dx < -20 ? String(t) : '0'
    })
  }

  const onUp = () => {
    if (!state.current.dragging) return
    state.current.dragging = false
    const { dx, dy } = state.current
    const el = ref.current
    if (!el) return

    // Tap detection
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)'
      el.style.transform  = `translateY(0) scale(1)`
      const like = el.querySelector<HTMLElement>('.stamp-like')
      const nope = el.querySelector<HTMLElement>('.stamp-nope')
      if (like) like.style.opacity = '0'
      if (nope) nope.style.opacity = '0'
      onTap()
      return
    }

    if (Math.abs(dx) > THRESHOLD) {
      const dir = dx > 0 ? 1 : -1
      el.style.transition = 'transform 0.35s ease, opacity 0.35s ease'
      el.style.transform  = `translate(${dir * (cardW + 200)}px, ${dy * 0.5}px) rotate(${dir * 25}deg)`
      el.style.opacity    = '0'
      setTimeout(() => onSwipe(dir as 1 | -1), 320)
    } else {
      // Spring back
      el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)'
      el.style.transform  = `translateY(0) scale(1)`
      const like = el.querySelector<HTMLElement>('.stamp-like')
      const nope = el.querySelector<HTMLElement>('.stamp-nope')
      if (like) like.style.opacity = '0'
      if (nope) nope.style.opacity = '0'
    }
  }

  const img   = imgOf(product)
  const badge = disc(product.originalPrice, product.salePrice)

  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      style={{
        position: 'absolute',
        width: cardW, height: cardH,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: isTop ? 'grab' : 'default',
        userSelect: 'none',
        touchAction: 'none',
        zIndex,
        transform: `translateY(${baseY}px) scale(${baseScale})`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        background: '#1a1008',
      }}
    >
      {/* Full image */}
      {img
        ? <Image src={img} alt={product.name} fill style={{ objectFit: 'cover', pointerEvents: 'none' }} sizes="480px" priority={isTop} draggable={false} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72 }}>🥻</div>
      }

      {/* Bottom gradient */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 45%, transparent 70%)', pointerEvents: 'none' }} />

      {/* LIKE stamp */}
      <div className="stamp-like" style={{
        position: 'absolute', top: 36, left: 24, opacity: 0, pointerEvents: 'none',
        border: '3px solid #4ade80', borderRadius: 6, padding: '6px 16px',
        color: '#4ade80', fontSize: 20, fontWeight: 800, letterSpacing: 2,
        transform: 'rotate(-15deg)', textTransform: 'uppercase',
      }}>LIKED</div>

      {/* NOPE stamp */}
      <div className="stamp-nope" style={{
        position: 'absolute', top: 36, right: 24, opacity: 0, pointerEvents: 'none',
        border: '3px solid #f87171', borderRadius: 6, padding: '6px 16px',
        color: '#f87171', fontSize: 20, fontWeight: 800, letterSpacing: 2,
        transform: 'rotate(15deg)', textTransform: 'uppercase',
      }}>NOPE</div>

      {/* Top badges */}
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        {product.isBestseller && (
          <span style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(201,168,76,0.6)', color: '#C9A84C', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}>BESTSELLER</span>
        )}
        {product.isNew && !product.isBestseller && (
          <span style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(139,26,43,0.6)', color: '#F8A3AF', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}>NEW</span>
        )}
        {badge && (
          <span style={{ background: 'rgba(220,38,38,0.85)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>{badge}</span>
        )}
      </div>

      {/* Bottom info — Tinder-style: name, brief detail, price + dots */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 22px' }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 500, color: '#fff', lineHeight: 1.1, marginBottom: 4, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>{product.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {product.fabric && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{product.fabric}</span>}
          {product.originRegion && <><span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>·</span><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{product.originRegion}</span></>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#C9A84C' }}>{fmt(priceOf(product))}</span>
            {product.salePrice && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>{fmt(product.originalPrice)}</span>}
          </div>
          {/* Colour dots */}
          {product.variants.length > 0 && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {product.variants.slice(0, 5).map(v => (
                <div key={v.id} style={{ width: 14, height: 14, borderRadius: '50%', background: v.colourHex || '#8B1A2B', border: '2px solid rgba(255,255,255,0.4)', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
              ))}
              {product.variants.length > 5 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>+{product.variants.length - 5}</span>}
            </div>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 8, textAlign: 'center', letterSpacing: 0.3 }}>tap for details</p>
      </div>
    </div>
  )
}

// ── Detail Sheet ──────────────────────────────────────────────────────────────
function DetailSheet({ product, isLoved, onClose, onLove }: {
  product: CatalogueProduct; isLoved: boolean; onClose: () => void; onLove: () => void
}) {
  const img   = imgOf(product)
  const badge = disc(product.originalPrice, product.salePrice)
  const rows  = [
    ['Fabric', product.fabric], ['Weave', product.weaveType],
    ['Origin', product.originRegion], ['Length', product.length ? `${product.length}m` : ''],
    ['Blouse', product.blouseIncluded ? 'Included' : ''], ['Care', product.careInstructions],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', width: '100%', maxWidth: 480,
        maxHeight: '92dvh', zIndex: 301,
        background: '#0f0a06',
        borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.9)',
        transform: 'translateX(-50%)',
        animation: 'sheetUp 0.4s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Image */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#1a1008', flexShrink: 0 }}>
            {img
              ? <Image src={img} alt={product.name} fill style={{ objectFit: 'cover' }} sizes="480px" priority />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>🥻</div>
            }
            {badge && <span style={{ position: 'absolute', top: 14, left: 14, background: '#DC2626', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700 }}>{badge}</span>}
            <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '20px 20px 32px' }}>
            {product.categoryName && <p style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 6, fontWeight: 600 }}>{product.categoryName}</p>}

            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 400, color: '#fff', lineHeight: 1.2, marginBottom: 6 }}>{product.name}</h2>

            {(product.fabric || product.originRegion) && (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>{[product.fabric, product.originRegion].filter(Boolean).join(' · ')}</p>
            )}

            {product.reviewCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                {[1,2,3,4,5].map(i => (
                  <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i <= Math.round(product.averageRating) ? '#C9A84C' : 'none'} stroke={i <= Math.round(product.averageRating) ? '#C9A84C' : 'rgba(255,255,255,0.2)'} strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                ))}
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{product.averageRating.toFixed(1)} · {product.reviewCount} reviews</span>
              </div>
            )}

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#C9A84C' }}>{fmt(priceOf(product))}</span>
              {product.salePrice && <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through' }}>{fmt(product.originalPrice)}</span>}
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>+GST</span>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 20 }} />

            {product.description && (
              <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}>{product.description}</p>
            )}

            {/* Colours — the key section for sarees */}
            {product.variants.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12, fontWeight: 600 }}>
                  {product.variants.length} colour{product.variants.length !== 1 ? 's' : ''} available
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {product.variants.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 24, padding: '6px 14px 6px 8px' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: v.colourHex || '#8B1A2B', border: '2px solid rgba(255,255,255,0.25)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{v.colour}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Details grid */}
            {rows.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {rows.map(([label, value]) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px' }}>
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {product.occasion?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10, fontWeight: 600 }}>Perfect for</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {product.occasion.map(o => (
                    <span key={o} style={{ background: 'rgba(139,26,43,0.18)', border: '1px solid rgba(139,26,43,0.4)', borderRadius: 20, padding: '5px 14px', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{o}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTAs */}
        <div style={{ padding: '12px 16px 32px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, flexShrink: 0, background: 'rgba(12,8,4,0.98)' }}>
          <button onClick={onLove} aria-label={isLoved ? 'Remove' : 'Save'} style={{ width: 54, height: 54, borderRadius: 14, flexShrink: 0, cursor: 'pointer', transition: 'all 0.2s', background: isLoved ? 'rgba(139,26,43,0.4)' : 'rgba(255,255,255,0.06)', border: isLoved ? '1.5px solid rgba(139,26,43,0.7)' : '1.5px solid rgba(255,255,255,0.1)', color: isLoved ? '#F87171' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={isLoved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
          <a href={`${STOREFRONT_URL}/product/${product.slug}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, height: 54, borderRadius: 14, background: 'linear-gradient(135deg, #8B1A2B, #6B1220)', color: '#fff', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', letterSpacing: 0.3, boxShadow: '0 4px 20px rgba(139,26,43,0.45)' }}>
            Buy Now
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </div>
      <style>{`@keyframes sheetUp{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}`}</style>
    </>
  )
}

// ── Wishlist Screen ───────────────────────────────────────────────────────────
function WishlistScreen({ items, onClose, onRemove, onCall }: {
  items: WishlistItem[]; onClose: () => void; onRemove: (id: string) => void; onCall: () => void
}) {
  const total = items.reduce((s, it) => s + (it.salePrice ?? it.originalPrice), 0)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#080502', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '52px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'flex-end', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 400, color: '#fff' }}>Your Shortlist</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{items.length} {items.length === 1 ? 'saree' : 'sarees'} saved</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 52 }}>🥻</div>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>No sarees saved yet.<br/>Swipe right on anything you love!</p>
          <button onClick={onClose} style={{ marginTop: 8, padding: '11px 28px', background: 'rgba(139,26,43,0.25)', border: '1px solid rgba(139,26,43,0.45)', borderRadius: 12, color: '#F8A3AF', fontSize: 14, cursor: 'pointer' }}>Back to browsing</button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {items.map(it => (
                <div key={it.id} style={{ borderRadius: 14, overflow: 'hidden', background: '#1A1008', border: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
                  <div style={{ aspectRatio: '3/4', position: 'relative', overflow: 'hidden' }}>
                    {it.image
                      ? <Image src={it.image} alt={it.name} fill style={{ objectFit: 'cover' }} sizes="200px"/>
                      : <div style={{ width: '100%', height: '100%', background: '#2D1B1B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🥻</div>
                    }
                    <button onClick={() => onRemove(it.id)} style={{ position: 'absolute', top: 7, right: 7, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div style={{ padding: '10px 12px 14px' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.3, marginBottom: 3 }}>{it.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>{it.fabric || it.categoryName}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>{fmt(it.salePrice ?? it.originalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 16px 36px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,5,2,0.98)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{items.length} saree{items.length !== 1 ? 's' : ''}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{fmt(total)}</span>
            </div>
            <button onClick={onCall} style={{ width: '100%', height: 54, borderRadius: 14, background: '#25D366', border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 20px rgba(37,211,102,0.3)', letterSpacing: 0.3 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Book a Video Call
            </button>
            <button onClick={onClose} style={{ width: '100%', height: 44, marginTop: 10, borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.35)', fontSize: 14, cursor: 'pointer' }}>Keep browsing</button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CataloguePage() {
  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [loading,  setLoading]  = useState(true)
  const [idx,      setIdx]      = useState(0)
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [detail,   setDetail]   = useState<CatalogueProduct | null>(null)
  const [showWL,   setShowWL]   = useState(false)
  const [undoSkip, setUndoSkip] = useState<{ p: CatalogueProduct; t: ReturnType<typeof setTimeout> } | null>(null)
  const [undoRm,   setUndoRm]   = useState<{ it: WishlistItem; t: ReturnType<typeof setTimeout> } | null>(null)
  const [drag,     setDrag]     = useState(0)   // -1 to 1, drives back-card animation

  // Card dimensions — fixed px like Tinder, calculated from viewport
  const [dims, setDims] = useState({ w: 340, h: 480 })
  useEffect(() => {
    const calc = () => {
      const vw = Math.min(window.innerWidth, 480)
      const vh = window.innerHeight
      const w  = vw - 32
      const h  = Math.min(vh - 220, w * 1.45)  // max 1.45 aspect ratio
      setDims({ w, h })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  useEffect(() => {
    fetch('/api/products?limit=80').then(r => r.json()).then(d => { setProducts(d.products || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(() => { try { const s = localStorage.getItem('skss_wl'); if (s) setWishlist(JSON.parse(s)) } catch {} }, [])
  useEffect(() => { try { localStorage.setItem('skss_wl', JSON.stringify(wishlist)) } catch {} }, [wishlist])

  const loved  = useCallback((id: string) => wishlist.some(it => it.id === id), [wishlist])
  const save   = useCallback((p: CatalogueProduct) => setWishlist(prev => prev.find(it => it.id === p.id) ? prev : [...prev, toWL(p)]), [])
  const remove = useCallback((id: string) => {
    const it = wishlist.find(x => x.id === id); if (!it) return
    setWishlist(prev => prev.filter(x => x.id !== id))
    if (undoRm) clearTimeout(undoRm.t)
    const t = setTimeout(() => setUndoRm(null), UNDO_MS)
    setUndoRm({ it, t })
  }, [wishlist, undoRm])

  const swipe = useCallback((dir: 1 | -1) => {
    if (dir === 1) { save(products[idx]); if (undoSkip) { clearTimeout(undoSkip.t); setUndoSkip(null) } }
    else {
      const p = products[idx]
      if (undoSkip) clearTimeout(undoSkip.t)
      const t = setTimeout(() => setUndoSkip(null), UNDO_MS)
      setUndoSkip({ p, t })
    }
    setDrag(0)
    setIdx(i => i + 1)
  }, [products, idx, save, undoSkip])

  // Button-triggered swipe — animates the card first
  const btnSwipe = (dir: 1 | -1) => {
    const el = document.querySelector<HTMLElement>('[data-top-card]')
    if (el) {
      el.style.transition = 'transform 0.35s ease, opacity 0.35s ease'
      el.style.transform  = `translateX(${dir * (dims.w + 200)}px) rotate(${dir * 25}deg)`
      el.style.opacity    = '0'
      setTimeout(() => swipe(dir), 320)
    } else swipe(dir)
  }

  // Track drag on top card to drive back-card animation
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-top-card]')
    if (!el) return
    const onMove = (e: PointerEvent) => {
      // We only care about the progress, not setting it — TinderCard handles its own drag
      // This effect updates drag state for back cards
    }
    return () => el.removeEventListener('pointermove', onMove)
  }, [idx])

  const stack    = products.slice(idx, idx + 3)
  const isDone   = !loading && idx >= products.length

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#080502', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 52 }}>🥻</div>
      <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>Loading collection…</p>
    </div>
  )

  return (
    <>
      {/* Full screen dark bg */}
      <div style={{ position: 'fixed', inset: 0, background: '#080502', display: 'flex', justifyContent: 'center' }}>
        {/* 480px phone column */}
        <div style={{ width: '100%', maxWidth: 480, height: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

          {/* Top bar */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 20px 12px' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 400, color: '#fff', letterSpacing: 0.5 }}>Collection</p>
              {!isDone && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>{products.length - idx} sarees</p>}
            </div>
            <button onClick={() => setShowWL(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, padding: '8px 16px 8px 12px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, letterSpacing: 0.2 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={wishlist.length > 0 ? '#F87171' : 'none'} stroke={wishlist.length > 0 ? '#F87171' : 'rgba(255,255,255,0.7)'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              Saved
              {wishlist.length > 0 && <span style={{ background: '#8B1A2B', color: '#fff', borderRadius: '50%', minWidth: 20, height: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{wishlist.length}</span>}
            </button>
          </div>

          {/* Card stack area — fixed height = card height + depth offset */}
          <div style={{ flexShrink: 0, position: 'relative', height: dims.h + 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isDone ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 56 }}>🥻</div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 400, color: '#fff' }}>You've seen everything!</h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{wishlist.length > 0 ? `${wishlist.length} saree${wishlist.length !== 1 ? 's' : ''} shortlisted.` : 'Browse again to save favourites.'}</p>
                {wishlist.length > 0 && <button onClick={() => setShowWL(true)} style={{ padding: '13px 0', width: '100%', background: 'linear-gradient(135deg,#8B1A2B,#6B1220)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 20px rgba(139,26,43,0.4)' }}>View shortlist & Book call</button>}
                <button onClick={() => setIdx(0)} style={{ padding: '11px 0', width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>Browse again</button>
              </div>
            ) : (
              // Render stack in reverse so top card is on top
              [...stack].reverse().map((p, ri) => {
                const i = stack.length - 1 - ri   // 0 = top card
                return (
                  <TinderCard
                    key={p.id}
                    product={p}
                    zIndex={10 - i}
                    isTop={i === 0}
                    dragProgress={drag}
                    onSwipe={swipe}
                    onTap={() => setDetail(p)}
                    cardW={dims.w}
                    cardH={dims.h}
                  />
                )
              })
            )}
          </div>

          {/* Progress dots */}
          {!isDone && (
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 6, padding: '10px 0' }}>
              {products.slice(Math.max(0, idx - 2), idx + 6).map((_, i) => {
                const a = Math.max(0, idx - 2) + i; const c = a === idx
                return <div key={a} style={{ height: 4, borderRadius: 2, width: c ? 18 : 4, background: c ? '#C9A84C' : 'rgba(255,255,255,0.15)', transition: 'width 0.25s, background 0.25s' }} />
              })}
            </div>
          )}

          {/* Tinder-style action buttons */}
          {!isDone && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '10px 0 28px' }}>
              {/* Undo / rewind */}
              <button onClick={() => { if (undoSkip) { clearTimeout(undoSkip.t); setIdx(i => Math.max(0, i-1)); setUndoSkip(null) } }} disabled={!undoSkip} aria-label="Undo skip" style={{ width: 46, height: 46, borderRadius: '50%', background: undoSkip ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)', border: undoSkip ? '1.5px solid rgba(251,191,36,0.5)' : '1.5px solid rgba(255,255,255,0.08)', color: undoSkip ? '#FBBf24' : 'rgba(255,255,255,0.2)', cursor: undoSkip ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.14"/></svg>
              </button>

              {/* Nope — red X */}
              <button onClick={() => btnSwipe(-1)} aria-label="Skip" style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: '1.5px solid rgba(0,0,0,0.06)', color: '#F87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', transition: 'transform 0.15s' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>

              {/* Super like — star */}
              <button onClick={() => { save(products[idx]); setDetail(products[idx]) }} aria-label="Super like — save and view details" style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1.5px solid rgba(59,130,246,0.4)', color: '#60A5FA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>

              {/* Like — heart */}
              <button onClick={() => btnSwipe(1)} aria-label="Love it" style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: '1.5px solid rgba(0,0,0,0.06)', color: '#4ade80', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', transition: 'transform 0.15s' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </button>

              {/* Info */}
              <button onClick={() => products[idx] && setDetail(products[idx])} aria-label="Details" style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(139,26,43,0.12)', border: '1.5px solid rgba(139,26,43,0.35)', color: '#F87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </button>
            </div>
          )}

          {/* Undo remove toast */}
          {undoRm && (
            <div style={{ position: 'absolute', bottom: 110, left: 16, right: 16, zIndex: 50, background: 'rgba(15,10,5,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Removed from shortlist</span>
              <button onClick={() => { clearTimeout(undoRm.t); setWishlist(prev => prev.find(x => x.id === undoRm.it.id) ? prev : [...prev, undoRm.it]); setUndoRm(null) }} style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 8, padding: '5px 14px', color: '#C9A84C', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Undo</button>
            </div>
          )}
        </div>
      </div>

      {detail && <DetailSheet product={detail} isLoved={loved(detail.id)} onClose={() => setDetail(null)} onLove={() => loved(detail.id) ? remove(detail.id) : save(detail)} />}
      {showWL && <WishlistScreen items={wishlist} onClose={() => setShowWL(false)} onRemove={remove} onCall={() => window.open(buildWAMsg(wishlist), '_blank', 'noopener')} />}
    </>
  )
}
