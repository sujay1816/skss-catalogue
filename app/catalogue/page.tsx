'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import type { CatalogueProduct, WishlistItem } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────
const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || ''
const WA_NUMBER      = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
const SWIPE_THRESHOLD = 90   // px drag before triggering swipe
const UNDO_DURATION   = 3500 // ms the undo toast stays visible

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatPrice(n: number) {
  return '₹' + n.toLocaleString('en-IN')
}
function discountBadge(orig: number, sale: number | null) {
  if (!sale || sale >= orig) return null
  return Math.round(((orig - sale) / orig) * 100) + '% off'
}

// ─── WishlistItem builder ─────────────────────────────────────────────────────
function toWishlistItem(p: CatalogueProduct): WishlistItem {
  const img = p.images.find(i => i.isPrimary) || p.images[0]
  return {
    id: p.id, name: p.name, slug: p.slug,
    image: img?.url || '',
    fabric: p.fabric, categoryName: p.categoryName,
    originalPrice: p.originalPrice, salePrice: p.salePrice,
  }
}

// ─── WhatsApp message ─────────────────────────────────────────────────────────
function buildWhatsAppUrl(items: WishlistItem[]) {
  const list = items.map((it, i) => {
    const price = it.salePrice ?? it.originalPrice
    return `${i + 1}. ${it.name} — ${formatPrice(price)}`
  }).join('\n')
  const msg = encodeURIComponent(
    `Hi! I've browsed your saree catalogue and shortlisted these:\n\n${list}\n\n` +
    `Could we schedule a personalised video call to see these in detail and explore more designs?`
  )
  return `https://wa.me/${WA_NUMBER}?text=${msg}`
}

// ─── StarRating ───────────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < Math.round(rating) ? '#C9A84C' : 'none'}
          stroke={i < Math.round(rating) ? '#C9A84C' : 'rgba(255,255,255,0.3)'} strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  )
}

// ─── SwipeCard component ──────────────────────────────────────────────────────
function SwipeCard({
  product, stackIndex, isTop, onSwipe, onTap,
}: {
  product: CatalogueProduct
  stackIndex: number   // 0 = top card, 1 = behind, 2 = further back
  isTop: boolean
  onSwipe: (dir: 1 | -1) => void
  onTap: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, dx: 0 })
  const rafRef  = useRef<number>(0)

  const primaryImg = product.images.find(i => i.isPrimary) || product.images[0]
  const price      = product.salePrice ?? product.originalPrice
  const badge      = discountBadge(product.originalPrice, product.salePrice)
  const scale      = 1 - stackIndex * 0.04
  const translateY = stackIndex * 12

  // Reset transform when card becomes active
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    if (stackIndex === 0) {
      el.style.transition = 'transform 0.3s ease, opacity 0.3s ease'
      el.style.transform  = `scale(${scale}) translateY(${translateY}px)`
      el.style.opacity    = '1'
    }
  }, [stackIndex, scale, translateY])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isTop) return
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, dx: 0 }
    cardRef.current?.setPointerCapture(e.pointerId)
    if (cardRef.current) cardRef.current.style.transition = 'none'
  }, [isTop])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active || !isTop) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    dragRef.current.dx = dx
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) return
      const rotate = dx * 0.06
      cardRef.current.style.transform = `translateX(${dx}px) translateY(${dy * 0.3}px) rotate(${rotate}deg)`
      // Show like/nope overlays
      const likeEl  = cardRef.current.querySelector<HTMLElement>('.card-like-overlay')
      const nopeEl  = cardRef.current.querySelector<HTMLElement>('.card-nope-overlay')
      const ratio   = Math.min(Math.abs(dx) / 80, 1)
      if (likeEl) likeEl.style.opacity = dx > 0 ? String(ratio) : '0'
      if (nopeEl) nopeEl.style.opacity = dx < 0 ? String(ratio) : '0'
    })
  }, [isTop])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    const dx = dragRef.current.dx
    const el = cardRef.current
    if (!el) return

    if (Math.abs(dx) < 5) {
      // It was a tap, not a drag
      el.style.transition = 'transform 0.25s ease'
      el.style.transform  = `scale(1) translateY(0)`
      onTap()
      return
    }

    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      const dir = dx > 0 ? 1 : -1
      el.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.35s ease'
      el.style.transform  = `translateX(${dir * 550}px) rotate(${dir * 22}deg)`
      el.style.opacity    = '0'
      setTimeout(() => onSwipe(dir as 1 | -1), 320)
    } else {
      // Snap back
      el.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
      el.style.transform  = `scale(${scale}) translateY(${translateY}px)`
      const likeEl = el.querySelector<HTMLElement>('.card-like-overlay')
      const nopeEl = el.querySelector<HTMLElement>('.card-nope-overlay')
      if (likeEl) likeEl.style.opacity = '0'
      if (nopeEl) nopeEl.style.opacity = '0'
    }
  }, [scale, translateY, onSwipe, onTap])

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'absolute',
        width: 'calc(100% - 32px)',
        height: 'min(72vh, 560px)',
        borderRadius: 24,
        overflow: 'hidden',
        cursor: isTop ? 'grab' : 'default',
        zIndex: 10 - stackIndex,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        willChange: 'transform',
        userSelect: 'none',
        touchAction: 'none',
        boxShadow: stackIndex === 0
          ? '0 32px 80px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.4)'
          : '0 8px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Background image */}
      {primaryImg?.url ? (
        <Image
          src={primaryImg.url}
          alt={product.name}
          fill
          sizes="(max-width: 480px) 100vw, 480px"
          style={{ objectFit: 'cover', pointerEvents: 'none' }}
          priority={stackIndex === 0}
          draggable={false}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: `linear-gradient(145deg, #2D1B1B, #1A0D0D)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 80,
        }}>🥻</div>
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.1) 70%, transparent 100%)',
      }} />

      {/* Like overlay */}
      <div className="card-like-overlay" style={{
        position: 'absolute', top: 28, left: 20, zIndex: 30, opacity: 0,
        background: 'rgba(34,197,94,0.9)', backdropFilter: 'blur(8px)',
        border: '2.5px solid #22c55e', borderRadius: 10,
        padding: '6px 18px', color: '#fff',
        fontSize: 18, fontWeight: 600, letterSpacing: 1,
        transform: 'rotate(-12deg)',
        transition: 'opacity 0.1s ease',
        pointerEvents: 'none',
      }}>LOVED ♥</div>

      {/* Nope overlay */}
      <div className="card-nope-overlay" style={{
        position: 'absolute', top: 28, right: 20, zIndex: 30, opacity: 0,
        background: 'rgba(239,68,68,0.9)', backdropFilter: 'blur(8px)',
        border: '2.5px solid #ef4444', borderRadius: 10,
        padding: '6px 18px', color: '#fff',
        fontSize: 18, fontWeight: 600, letterSpacing: 1,
        transform: 'rotate(12deg)',
        transition: 'opacity 0.1s ease',
        pointerEvents: 'none',
      }}>SKIP</div>

      {/* Badges (top right) */}
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', zIndex: 5 }}>
        {product.isBestseller && (
          <span style={{
            background: 'rgba(201,168,76,0.25)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(201,168,76,0.5)',
            color: '#C9A84C', borderRadius: 20, padding: '3px 10px',
            fontSize: 10, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase',
          }}>Bestseller</span>
        )}
        {product.isNew && !product.isBestseller && (
          <span style={{
            background: 'rgba(139,26,43,0.35)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(139,26,43,0.6)',
            color: '#F8A3AF', borderRadius: 20, padding: '3px 10px',
            fontSize: 10, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase',
          }}>New</span>
        )}
        {badge && (
          <span style={{
            background: 'rgba(239,68,68,0.8)', backdropFilter: 'blur(8px)',
            color: '#fff', borderRadius: 20, padding: '3px 10px',
            fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
          }}>{badge}</span>
        )}
      </div>

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 22px 26px' }}>
        {product.categoryName && (
          <div style={{
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            color: 'rgba(201,168,76,0.8)', marginBottom: 5, fontWeight: 500,
          }}>{product.categoryName}</div>
        )}
        <div style={{
          fontSize: 22, fontFamily: 'var(--font-heading)', fontWeight: 400,
          color: '#fff', lineHeight: 1.2, marginBottom: 4,
          textShadow: '0 1px 8px rgba(0,0,0,0.5)',
        }}>{product.name}</div>

        {product.originRegion && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
            {[product.fabric, product.originRegion].filter(Boolean).join(' · ')}
          </div>
        )}

        {/* Rating */}
        {product.reviewCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <StarRating rating={product.averageRating} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              {product.averageRating.toFixed(1)} ({product.reviewCount})
            </span>
          </div>
        )}

        {/* Price row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 500, color: '#C9A84C', lineHeight: 1 }}>
              {formatPrice(price)}
            </div>
            {product.salePrice && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through', marginTop: 2 }}>
                {formatPrice(product.originalPrice)}
              </div>
            )}
          </div>

          {/* Colour swatches */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {product.variants.slice(0, 5).map(v => (
              <div key={v.id} style={{
                width: 16, height: 16, borderRadius: '50%',
                background: v.colourHex || '#8B1A2B',
                border: '1.5px solid rgba(255,255,255,0.35)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }} title={v.colour} />
            ))}
            {product.variants.length > 5 && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>+{product.variants.length - 5}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Bottom Sheet ──────────────────────────────────────────────────────
function DetailSheet({
  product, onClose, onLove, onBuy, isLoved,
}: {
  product: CatalogueProduct
  onClose: () => void
  onLove: () => void
  onBuy: () => void
  isLoved: boolean
}) {
  const [activeImg, setActiveImg] = useState(0)
  const [playingVideo, setPlayingVideo] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const price = product.salePrice ?? product.originalPrice
  const badge = discountBadge(product.originalPrice, product.salePrice)

  const allMedia = [
    ...product.images.sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : a.order - b.order)),
  ]

  const handleVideoToggle = () => {
    if (!videoRef.current) return
    if (playingVideo) { videoRef.current.pause(); setPlayingVideo(false) }
    else { videoRef.current.play(); setPlayingVideo(true) }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }}
        className="fade-in"
      />

      {/* Sheet */}
      <div
        className="sheet-enter"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
          maxHeight: '92dvh',
          background: '#141008',
          borderRadius: '24px 24px 0 0',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.8)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }} className="scrollbar-hidden">
          {/* Image strip */}
          <div style={{ position: 'relative', aspectRatio: '4/5', maxHeight: '55vw', overflow: 'hidden' }}>
            {/* Video if available and selected */}
            {product.videoUrl && playingVideo ? (
              <video
                ref={videoRef}
                src={product.videoUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                playsInline
                loop
              />
            ) : allMedia[activeImg]?.url ? (
              <Image
                src={allMedia[activeImg].url}
                alt={allMedia[activeImg].altText || product.name}
                fill
                style={{ objectFit: 'cover' }}
                sizes="480px"
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: '#2D1B1B', fontSize: 60,
              }}>🥻</div>
            )}

            {/* Video play button */}
            {product.videoUrl && !playingVideo && (
              <button
                onClick={handleVideoToggle}
                style={{
                  position: 'absolute', bottom: 16, right: 16,
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Play product video"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
            )}

            {/* Stop video */}
            {playingVideo && (
              <button
                onClick={handleVideoToggle}
                style={{
                  position: 'absolute', bottom: 16, right: 16,
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Stop video"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                </svg>
              </button>
            )}

            {/* Discount badge */}
            {badge && (
              <div style={{
                position: 'absolute', top: 16, left: 16,
                background: '#DC2626', color: '#fff',
                borderRadius: 20, padding: '4px 12px',
                fontSize: 11, fontWeight: 600,
              }}>{badge}</div>
            )}
          </div>

          {/* Thumbnail strip */}
          {(allMedia.length > 1 || product.videoUrl) && (
            <div style={{
              display: 'flex', gap: 8, padding: '12px 16px',
              overflowX: 'auto',
            }} className="scrollbar-hidden">
              {allMedia.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => { setActiveImg(i); setPlayingVideo(false) }}
                  style={{
                    flexShrink: 0, width: 52, height: 64,
                    borderRadius: 8, overflow: 'hidden',
                    border: activeImg === i && !playingVideo
                      ? '2px solid #C9A84C'
                      : '1.5px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer', background: 'none', padding: 0,
                    transition: 'border-color 0.2s',
                  }}
                  aria-label={`Image ${i + 1}`}
                >
                  <Image src={img.url} alt="" fill style={{ objectFit: 'cover' }} sizes="52px" />
                </button>
              ))}
              {/* Video thumb */}
              {product.videoUrl && (
                <button
                  onClick={() => { setPlayingVideo(true); if (videoRef.current) videoRef.current.play() }}
                  style={{
                    flexShrink: 0, width: 52, height: 64,
                    borderRadius: 8, overflow: 'hidden',
                    border: playingVideo ? '2px solid #C9A84C' : '1.5px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer', background: 'rgba(139,26,43,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color 0.2s',
                  }}
                  aria-label="Product video"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#C9A84C">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div style={{ padding: '4px 20px 24px' }}>

            {/* Category */}
            {product.categoryName && (
              <div style={{
                fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
                color: '#C9A84C', marginBottom: 6, fontWeight: 500,
              }}>{product.categoryName}</div>
            )}

            {/* Name */}
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 26, fontWeight: 400, lineHeight: 1.2,
              color: '#fff', marginBottom: 6,
            }}>{product.name}</h2>

            {/* Origin */}
            {product.originRegion && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
                {[product.fabric, product.originRegion].filter(Boolean).join(' · ')}
              </div>
            )}

            {/* Rating */}
            {product.reviewCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <StarRating rating={product.averageRating} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {product.averageRating.toFixed(1)} · {product.reviewCount} reviews
                </span>
              </div>
            )}

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 28, fontWeight: 500, color: '#C9A84C' }}>
                {formatPrice(price)}
              </span>
              {product.salePrice && (
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>
                  {formatPrice(product.originalPrice)}
                </span>
              )}
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>+GST</span>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 20 }} />

            {/* Description */}
            {product.description && (
              <p style={{
                fontSize: 14, lineHeight: 1.7,
                color: 'rgba(255,255,255,0.6)',
                marginBottom: 20,
              }}>{product.description}</p>
            )}

            {/* Quick details grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 10, marginBottom: 20,
            }}>
              {[
                { label: 'Fabric', value: product.fabric },
                { label: 'Weave', value: product.weaveType },
                { label: 'Origin', value: product.originRegion },
                { label: 'Length', value: product.length ? `${product.length}m` : null },
                { label: 'Weight', value: product.weightGrams ? `${product.weightGrams}g` : null },
                { label: 'Blouse', value: product.blouseIncluded ? 'Included' : 'Not included' },
              ].filter(d => d.value).map(d => (
                <div key={d.label} style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{d.label}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{d.value}</div>
                </div>
              ))}
            </div>

            {/* Colours */}
            {product.variants.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
                  Available Colours ({product.variants.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {product.variants.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: v.colourHex || '#8B1A2B',
                        border: '1.5px solid rgba(255,255,255,0.25)',
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{v.colour}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Occasions */}
            {product.occasion?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Perfect for</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {product.occasion.map(o => (
                    <span key={o} style={{
                      background: 'rgba(139,26,43,0.25)',
                      border: '1px solid rgba(139,26,43,0.4)',
                      borderRadius: 20, padding: '4px 12px',
                      fontSize: 12, color: 'rgba(255,255,255,0.65)',
                    }}>{o}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Care */}
            {product.careInstructions && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>Care</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{product.careInstructions}</div>
              </div>
            )}

          </div>
        </div>

        {/* CTA row — sticky bottom */}
        <div style={{
          padding: '14px 20px 28px',
          background: 'rgba(20,16,8,0.98)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', gap: 10,
        }}>
          {/* Love button */}
          <button
            onClick={onLove}
            aria-label={isLoved ? 'Remove from shortlist' : 'Add to shortlist'}
            style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: isLoved ? 'rgba(139,26,43,0.5)' : 'rgba(255,255,255,0.08)',
              border: isLoved ? '1.5px solid rgba(139,26,43,0.7)' : '1.5px solid rgba(255,255,255,0.15)',
              color: isLoved ? '#F87171' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={isLoved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {/* Buy now */}
          <a
            href={`${STOREFRONT_URL}/product/${product.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onBuy}
            style={{
              flex: 1, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, #8B1A2B, #6B1220)',
              border: 'none', color: '#fff',
              fontSize: 15, fontWeight: 500,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(139,26,43,0.4)',
            }}
          >
            Buy Now
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
    </>
  )
}

// ─── Wishlist Screen ──────────────────────────────────────────────────────────
function WishlistScreen({
  items, onClose, onRemove, onBookCall,
}: {
  items: WishlistItem[]
  onClose: () => void
  onRemove: (id: string) => void
  onBookCall: () => void
}) {
  const total = items.reduce((s, it) => s + (it.salePrice ?? it.originalPrice), 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0D0905',
      display: 'flex', flexDirection: 'column',
    }} className="fade-in">

      {/* Header */}
      <div style={{
        padding: '52px 20px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'flex-end', gap: 12,
      }}>
        <button onClick={onClose} style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 400, color: '#fff' }}>
            Your Shortlist
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {items.length} {items.length === 1 ? 'saree' : 'sarees'} saved
          </p>
        </div>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40,
        }}>
          <div style={{ fontSize: 56 }}>🥻</div>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.6 }}>
            No sarees saved yet.<br />Swipe right on anything you love!
          </p>
          <button onClick={onClose} style={{
            marginTop: 8, padding: '12px 28px',
            background: 'rgba(139,26,43,0.3)',
            border: '1px solid rgba(139,26,43,0.5)',
            borderRadius: 12, color: '#F8A3AF',
            fontSize: 14, cursor: 'pointer',
          }}>Back to swiping</button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="scrollbar-hidden">
            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {items.map(it => (
                <div key={it.id} style={{
                  borderRadius: 16, overflow: 'hidden',
                  background: '#1A1008',
                  border: '1px solid rgba(255,255,255,0.08)',
                  position: 'relative',
                }}>
                  {/* Image */}
                  <div style={{ aspectRatio: '3/4', position: 'relative', overflow: 'hidden' }}>
                    {it.image ? (
                      <Image
                        src={it.image} alt={it.name}
                        fill style={{ objectFit: 'cover' }}
                        sizes="(max-width: 480px) 50vw, 200px"
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%', background: '#2D1B1B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
                      }}>🥻</div>
                    )}
                    {/* Remove button */}
                    <button
                      onClick={() => onRemove(it.id)}
                      aria-label={`Remove ${it.name}`}
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s',
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  {/* Info */}
                  <div style={{ padding: '10px 12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', lineHeight: 1.3, marginBottom: 3 }}>
                      {it.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 5 }}>
                      {it.fabric || it.categoryName}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#C9A84C' }}>
                      {formatPrice(it.salePrice ?? it.originalPrice)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 20px 36px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(13,9,5,0.98)', backdropFilter: 'blur(20px)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {items.length} saree{items.length !== 1 ? 's' : ''} shortlisted
              </span>
              <span style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>
                {formatPrice(total)}
              </span>
            </div>

            {/* WhatsApp CTA */}
            <button
              onClick={onBookCall}
              style={{
                width: '100%', height: 54, borderRadius: 14,
                background: '#25D366', border: 'none',
                color: '#fff', fontSize: 16, fontWeight: 500,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 4px 20px rgba(37,211,102,0.3)',
                transition: 'opacity 0.2s',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Book a Video Call
            </button>

            <button onClick={onClose} style={{
              width: '100%', height: 44, marginTop: 10, borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)', fontSize: 14,
              cursor: 'pointer', transition: 'border-color 0.2s',
            }}>Keep browsing</button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CataloguePage() {
  const [products, setProducts]     = useState<CatalogueProduct[]>([])
  const [loading, setLoading]       = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [wishlist, setWishlist]     = useState<WishlistItem[]>([])
  const [detailProduct, setDetail]  = useState<CatalogueProduct | null>(null)
  const [showWishlist, setShowWL]   = useState(false)
  const [undoItem, setUndoItem]     = useState<{ item: WishlistItem; timer: ReturnType<typeof setTimeout> } | null>(null)
  const [lastSkipped, setLastSkipped] = useState<{ product: CatalogueProduct; timer: ReturnType<typeof setTimeout> } | null>(null)

  // Load products
  useEffect(() => {
    fetch('/api/products?limit=60')
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Persist wishlist to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('skss_catalogue_wishlist')
      if (saved) setWishlist(JSON.parse(saved))
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('skss_catalogue_wishlist', JSON.stringify(wishlist)) } catch {}
  }, [wishlist])

  const currentProducts = products.slice(currentIdx, currentIdx + 3)
  const isDone = !loading && currentIdx >= products.length

  // Add to wishlist
  const addToWishlist = useCallback((p: CatalogueProduct) => {
    setWishlist(prev => {
      if (prev.find(it => it.id === p.id)) return prev
      return [...prev, toWishlistItem(p)]
    })
  }, [])

  // Remove from wishlist with undo
  const removeFromWishlist = useCallback((id: string) => {
    const item = wishlist.find(it => it.id === id)
    if (!item) return
    setWishlist(prev => prev.filter(it => it.id !== id))

    // Clear previous undo timer
    if (undoItem) clearTimeout(undoItem.timer)
    const timer = setTimeout(() => setUndoItem(null), UNDO_DURATION)
    setUndoItem({ item, timer })
  }, [wishlist, undoItem])

  // Undo remove
  const undoRemove = () => {
    if (!undoItem) return
    clearTimeout(undoItem.timer)
    setWishlist(prev => {
      if (prev.find(it => it.id === undoItem.item.id)) return prev
      return [...prev, undoItem.item]
    })
    setUndoItem(null)
  }

  // Handle swipe
  const handleSwipe = useCallback((dir: 1 | -1) => {
    const product = products[currentIdx]
    if (!product) return

    if (dir === 1) {
      // Loved
      addToWishlist(product)
      if (lastSkipped) { clearTimeout(lastSkipped.timer); setLastSkipped(null) }
    } else {
      // Skipped — offer undo for 3.5s
      if (lastSkipped) clearTimeout(lastSkipped.timer)
      const timer = setTimeout(() => setLastSkipped(null), UNDO_DURATION)
      setLastSkipped({ product, timer })
    }

    setCurrentIdx(i => i + 1)
  }, [products, currentIdx, addToWishlist, lastSkipped])

  // Undo skip
  const undoSkip = () => {
    if (!lastSkipped) return
    clearTimeout(lastSkipped.timer)
    setCurrentIdx(i => Math.max(0, i - 1))
    setLastSkipped(null)
  }

  // Button swipe
  const handleButtonSwipe = (dir: 1 | -1) => {
    const topCard = document.querySelector<HTMLElement>('[data-top-card]')
    if (topCard) {
      topCard.style.transition = 'transform 0.35s ease, opacity 0.35s ease'
      topCard.style.transform = `translateX(${dir * 550}px) rotate(${dir * 22}deg)`
      topCard.style.opacity = '0'
      setTimeout(() => handleSwipe(dir), 300)
    } else {
      handleSwipe(dir)
    }
  }

  // Tap on card
  const handleTap = useCallback((product: CatalogueProduct) => {
    setDetail(product)
  }, [])

  // Love from detail sheet
  const handleDetailLove = () => {
    if (!detailProduct) return
    const isLoved = wishlist.some(it => it.id === detailProduct.id)
    if (isLoved) removeFromWishlist(detailProduct.id)
    else addToWishlist(detailProduct)
  }

  // Book call
  const handleBookCall = () => {
    window.open(buildWhatsAppUrl(wishlist), '_blank', 'noopener,noreferrer')
  }

  const isLoved = (id: string) => wishlist.some(it => it.id === id)

  // ── Render ──
  if (loading) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--dark)', gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>🥻</div>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20, color: 'rgba(255,255,255,0.5)' }}>
          Loading collection…
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Main swipe view */}
      <div style={{
        height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column',
        background: 'var(--dark-mid)', overflow: 'hidden', position: 'relative',
        maxWidth: 480, margin: '0 auto',
      }}>

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '48px 20px 16px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
        }}>
          {/* Brand */}
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 400,
              color: '#fff', letterSpacing: 1,
            }}>Collection</div>
            {!isDone && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                {products.length - currentIdx} remaining
              </div>
            )}
          </div>

          {/* Wishlist button */}
          <button
            onClick={() => setShowWL(true)}
            aria-label={`View shortlist (${wishlist.length} saved)`}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 24, padding: '8px 14px 8px 12px',
              color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              transition: 'background 0.2s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={wishlist.length > 0 ? '#F87171' : 'none'} stroke={wishlist.length > 0 ? '#F87171' : 'currentColor'} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Saved
            {wishlist.length > 0 && (
              <span style={{
                background: '#8B1A2B', color: '#fff', borderRadius: '50%',
                minWidth: 20, height: 20, fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>{wishlist.length}</span>
            )}
          </button>
        </div>

        {/* Card stack */}
        {isDone ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 40, gap: 16, textAlign: 'center',
          }}>
            <div style={{ fontSize: 64 }}>🥻</div>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 400,
              color: '#fff', lineHeight: 1.2,
            }}>You've seen everything!</h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
              {wishlist.length > 0
                ? `You've shortlisted ${wishlist.length} saree${wishlist.length !== 1 ? 's' : ''}. Ready to book a video call?`
                : 'Browse again or go back to start.'}
            </p>
            {wishlist.length > 0 && (
              <button
                onClick={() => setShowWL(true)}
                style={{
                  marginTop: 8, padding: '14px 32px',
                  background: 'linear-gradient(135deg, #8B1A2B, #6B1220)',
                  border: 'none', borderRadius: 14,
                  color: '#fff', fontSize: 16, fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(139,26,43,0.4)',
                  width: '100%',
                }}
              >View shortlist &amp; Book call</button>
            )}
            <button
              onClick={() => setCurrentIdx(0)}
              style={{
                padding: '12px 32px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 14, color: 'rgba(255,255,255,0.5)',
                fontSize: 14, cursor: 'pointer', width: '100%',
              }}
            >Start over</button>
          </div>
        ) : (
          <div style={{
            position: 'absolute',
            top: '50%', left: 0, right: 0,
            transform: 'translateY(-52%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {currentProducts.map((product, i) => (
              <div key={product.id} data-top-card={i === 0 ? '' : undefined}>
                <SwipeCard
                  product={product}
                  stackIndex={i}
                  isTop={i === 0}
                  onSwipe={handleSwipe}
                  onTap={() => handleTap(product)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Progress dots */}
        {!isDone && (
          <div style={{
            position: 'absolute',
            bottom: 120, left: 0, right: 0,
            display: 'flex', justifyContent: 'center',
            gap: 5, zIndex: 5,
          }}>
            {products.slice(Math.max(0, currentIdx - 2), currentIdx + 5).map((_, i) => {
              const absIdx = Math.max(0, currentIdx - 2) + i
              const isCurrent = absIdx === currentIdx
              return (
                <div key={absIdx} style={{
                  height: 5, borderRadius: 3,
                  width: isCurrent ? 18 : 5,
                  background: isCurrent ? '#C9A84C' : 'rgba(255,255,255,0.2)',
                  transition: 'width 0.3s ease, background 0.3s ease',
                }} />
              )
            })}
          </div>
        )}

        {/* Action buttons */}
        {!isDone && (
          <div style={{
            position: 'absolute', bottom: 36, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 20, zIndex: 20,
          }}>
            {/* Skip */}
            <button
              onClick={() => handleButtonSwipe(-1)}
              aria-label="Skip this saree"
              style={{
                width: 58, height: 58, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.15s, background 0.2s',
                fontSize: 0,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Love — primary CTA */}
            <button
              onClick={() => handleButtonSwipe(1)}
              aria-label="Love this saree — add to shortlist"
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(145deg, #8B1A2B, #6B1220)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 24px rgba(139,26,43,0.55)',
                transition: 'transform 0.15s',
                fontSize: 0,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>

            {/* Info */}
            <button
              onClick={() => products[currentIdx] && handleTap(products[currentIdx])}
              aria-label="View details"
              style={{
                width: 58, height: 58, borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.15s',
                fontSize: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </button>
          </div>
        )}

        {/* Undo skip toast */}
        {lastSkipped && (
          <div
            className="slide-up"
            style={{
              position: 'absolute', bottom: 130, left: 20, right: 20, zIndex: 30,
              background: 'rgba(30,20,10,0.95)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16, padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}
          >
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              Skipped <span style={{ color: '#fff', fontWeight: 500 }}>{lastSkipped.product.name}</span>
            </div>
            <button
              onClick={undoSkip}
              style={{
                background: 'rgba(201,168,76,0.2)', border: '1px solid rgba(201,168,76,0.4)',
                borderRadius: 8, padding: '5px 14px',
                color: '#C9A84C', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                flexShrink: 0,
              }}
            >Undo</button>
          </div>
        )}

        {/* Undo remove toast */}
        {undoItem && (
          <div
            className="slide-up"
            style={{
              position: 'absolute', bottom: 130, left: 20, right: 20, zIndex: 30,
              background: 'rgba(30,20,10,0.95)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16, padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}
          >
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              Removed from shortlist
            </div>
            <button
              onClick={undoRemove}
              style={{
                background: 'rgba(201,168,76,0.2)', border: '1px solid rgba(201,168,76,0.4)',
                borderRadius: 8, padding: '5px 14px',
                color: '#C9A84C', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                flexShrink: 0,
              }}
            >Undo</button>
          </div>
        )}
      </div>

      {/* Detail bottom sheet */}
      {detailProduct && (
        <DetailSheet
          product={detailProduct}
          isLoved={isLoved(detailProduct.id)}
          onClose={() => setDetail(null)}
          onLove={handleDetailLove}
          onBuy={() => {}}
        />
      )}

      {/* Wishlist full screen */}
      {showWishlist && (
        <WishlistScreen
          items={wishlist}
          onClose={() => setShowWL(false)}
          onRemove={removeFromWishlist}
          onBookCall={handleBookCall}
        />
      )}
    </>
  )
}
