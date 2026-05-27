'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import type { CatalogueProduct, WishlistItem } from '@/types'

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || ''
const UNDO_MS        = 3500
const THRESHOLD      = 90

const fmt     = (n: number) => '₹' + n.toLocaleString('en-IN')
const disc    = (o: number, s: number | null) => (!s || s >= o) ? null : Math.round(((o - s) / o) * 100) + '% off'
const imgOf   = (p: CatalogueProduct) => (p.images.find(i => i.isPrimary) || p.images[0])?.url || ''
const priceOf = (p: CatalogueProduct) => p.salePrice ?? p.originalPrice
const toWL    = (p: CatalogueProduct): WishlistItem => ({
  id: p.id, name: p.name, slug: p.slug, image: imgOf(p),
  fabric: p.fabric, categoryName: p.categoryName,
  originalPrice: p.originalPrice, salePrice: p.salePrice,
})

type SiteConfig = {
  brand_name?: string
  brand_subtitle?: string
  brand_tagline?: string
  logo_url?: string
  whatsapp_number?: string
}

function buildWA(items: WishlistItem[], waNumber: string) {
  const list = items.map((it, i) => `${i + 1}. ${it.name} — ${fmt(it.salePrice ?? it.originalPrice)}`).join('\n')
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi! I browsed your saree catalogue and shortlisted:\n\n${list}\n\nCan we schedule a video call to see these in detail?`)}`
}

const BUDGETS = [
  { label: 'All',        min: 0,     max: Infinity },
  { label: 'Under ₹10K', min: 0,     max: 9999     },
  { label: '₹10K–₹25K', min: 10000, max: 24999     },
  { label: 'Above ₹25K', min: 25000, max: Infinity  },
]

// ─── Logo — reads from admin site_config ─────────────────────────────────────
function Logo({ config }: { config: SiteConfig }) {
  const name     = config.brand_name     || 'SKSS'
  const subtitle = config.brand_subtitle || 'Silk Sarees'
  const logoUrl  = config.logo_url

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      {logoUrl ? (
        // Use the actual logo uploaded in admin → Config → Brand
        <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: 'rgba(139,26,43,0.15)', border: '1px solid rgba(201,168,76,0.3)', flexShrink: 0 }}>
          <img src={logoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      ) : (
        // Fallback SVG mark if no logo uploaded yet
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          <circle cx="17" cy="17" r="15" fill="rgba(139,26,43,0.15)" stroke="rgba(201,168,76,0.4)" strokeWidth="1"/>
          <path d="M17 7C21 7 25 10 25 15C25 20 21 23 17 25C17 25 13 23 11 20C9 17 10 12 13 10C14.5 8.5 15.8 7 17 7Z" fill="rgba(139,26,43,0.65)" stroke="#C9A84C" strokeWidth="0.8"/>
          <circle cx="17" cy="11" r="2" fill="#C9A84C"/>
          <path d="M15 19C15 19 16 21 17 21C18 21 19 20 19 19" stroke="rgba(201,168,76,0.75)" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      )}
      <div style={{ lineHeight: 1 }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 400, color: '#fff', letterSpacing: 1.5 }}>{name}</p>
        <p style={{ fontSize: 8, color: 'rgba(201,168,76,0.7)', letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 2 }}>{subtitle}</p>
      </div>
    </div>
  )
}

// ─── TinderCard ───────────────────────────────────────────────────────────────
function TinderCard({ product, stackIndex, isTop, dragProgress, onSwipe, onTap, onDragProgress, cardW, cardH }: {
  product: CatalogueProduct; stackIndex: number; isTop: boolean; dragProgress: number
  onSwipe: (dir: 1 | -1) => void; onTap: () => void; onDragProgress: (p: number) => void
  cardW: number; cardH: number
}) {
  const ref  = useRef<HTMLDivElement>(null)
  const drag = useRef({ on: false, x0: 0, y0: 0, dx: 0, dy: 0 })
  const raf  = useRef(0)
  const scale  = 1 - stackIndex * 0.05
  const shiftY = stackIndex * 14

  useEffect(() => {
    const el = ref.current
    if (!el || isTop) return
    const abs = Math.abs(dragProgress)
    el.style.transform  = `translateY(${shiftY - shiftY * abs}px) scale(${scale + (1 - scale) * abs})`
    el.style.transition = 'transform 0.08s ease'
  }, [isTop, dragProgress, scale, shiftY])

  const onDown = (e: React.PointerEvent) => {
    if (!isTop) return
    drag.current = { on: true, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }
    ref.current?.setPointerCapture(e.pointerId)
    if (ref.current) ref.current.style.transition = 'none'
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.on) return
    const dx = e.clientX - drag.current.x0
    const dy = e.clientY - drag.current.y0
    drag.current.dx = dx; drag.current.dy = dy
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
    const { dx, dy } = drag.current
    const el = ref.current; if (!el) return
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)'
      el.style.transform  = `translateY(${shiftY}px) scale(${scale})`
      onTap(); return
    }
    if (Math.abs(dx) > THRESHOLD) {
      const dir = dx > 0 ? 1 : -1
      el.style.transition = 'transform 0.35s ease, opacity 0.3s ease'
      el.style.transform  = `translate(${dir * (cardW + 300)}px, ${dy * 0.4}px) rotate(${dir * 28}deg)`
      el.style.opacity    = '0'
      setTimeout(() => onSwipe(dir as 1 | -1), 320)
    } else {
      el.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)'
      el.style.transform  = `translateY(${shiftY}px) scale(${scale})`
      const like = el.querySelector<HTMLElement>('.s-like')
      const nope = el.querySelector<HTMLElement>('.s-nope')
      if (like) like.style.opacity = '0'
      if (nope) nope.style.opacity = '0'
    }
  }

  const img   = imgOf(product)
  const badge = disc(product.originalPrice, product.salePrice)

  return (
    <div ref={ref} data-top-card={isTop ? '' : undefined}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      style={{
        position: 'relative', width: cardW, height: cardH,
        borderRadius: 16, overflow: 'hidden', flexShrink: 0,
        cursor: isTop ? 'grab' : 'default', userSelect: 'none', touchAction: 'none',
        zIndex: 10 - stackIndex,
        transform: `translateY(${shiftY}px) scale(${scale})`,
        transformOrigin: 'center bottom', transition: 'transform 0.3s ease',
        background: '#1a1008',
        boxShadow: stackIndex === 0 ? '0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.4)',
      }}>
      {img
        ? <Image src={img} alt={product.name} fill style={{ objectFit: 'cover', pointerEvents: 'none' }} sizes="(max-width:480px) calc(100vw - 32px), 448px" priority={stackIndex === 0} draggable={false}/>
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, background: 'linear-gradient(145deg,#2D1B1B,#1A0D0D)' }}>🥻</div>
      }
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.05) 70%, transparent 100%)', pointerEvents: 'none' }}/>
      <div className="s-like" style={{ position: 'absolute', top: 36, left: 24, opacity: 0, pointerEvents: 'none', border: '3px solid #4ade80', borderRadius: 6, padding: '6px 18px', color: '#4ade80', fontSize: 22, fontWeight: 800, letterSpacing: 3, transform: 'rotate(-15deg)' }}>LIKED</div>
      <div className="s-nope" style={{ position: 'absolute', top: 36, right: 24, opacity: 0, pointerEvents: 'none', border: '3px solid #f87171', borderRadius: 6, padding: '6px 18px', color: '#f87171', fontSize: 22, fontWeight: 800, letterSpacing: 3, transform: 'rotate(15deg)' }}>NOPE</div>
      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        {product.isBestseller && <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(201,168,76,0.55)', color: '#C9A84C', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>BESTSELLER</span>}
        {product.isNew && !product.isBestseller && <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', border: '1px solid rgba(139,26,43,0.55)', color: '#F8A3AF', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>NEW</span>}
        {badge && <span style={{ background: 'rgba(220,38,38,0.9)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>{badge}</span>}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px' }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 500, color: '#fff', lineHeight: 1.1, marginBottom: 4, textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>{product.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {product.fabric && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{product.fabric}</span>}
          {product.originRegion && <><span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{product.originRegion}</span></>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#C9A84C' }}>{fmt(priceOf(product))}</span>
            {product.salePrice && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through', marginLeft: 8 }}>{fmt(product.originalPrice)}</span>}
          </div>
          {product.variants.length > 0 && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {product.variants.slice(0, 5).map(v => (
                <div key={v.id} style={{ width: 14, height: 14, borderRadius: '50%', background: v.colourHex || '#8B1A2B', border: '2px solid rgba(255,255,255,0.5)', boxShadow: '0 1px 4px rgba(0,0,0,0.6)' }}/>
              ))}
              {product.variants.length > 5 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>+{product.variants.length - 5}</span>}
            </div>
          )}
        </div>
        {isTop && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 7, textAlign: 'center', letterSpacing: 0.5 }}>tap for details · swipe to browse</p>}
      </div>
    </div>
  )
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────
function DetailSheet({ product, isLoved, onClose, onLove, waNumber }: {
  product: CatalogueProduct; isLoved: boolean; onClose: () => void; onLove: () => void; waNumber: string
}) {
  const [activeImg, setActiveImg] = useState(0)
  const badge  = disc(product.originalPrice, product.salePrice)
  const images = [...product.images].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : a.order - b.order))
  const rows   = ([
    ['Fabric', product.fabric], ['Weave', product.weaveType],
    ['Origin', product.originRegion], ['Length', product.length ? `${product.length}m` : ''],
    ['Blouse', product.blouseIncluded ? 'Included' : ''], ['Care', product.careInstructions],
  ] as [string,string][]).filter(([,v]) => v)

  // Low stock signal — genuine urgency, not fake
  const lowStockVariants = product.variants.filter(v => v.stock > 0 && v.stock <= 3)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}/>
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, maxHeight: '92dvh', zIndex: 301, background: '#0f0a06', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 -16px 60px rgba(0,0,0,0.95)', animation: 'sheetUp 0.38s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }}/>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Main image */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#1a1008' }}>
            {images[activeImg]?.url
              ? <Image src={images[activeImg].url} alt={product.name} fill style={{ objectFit: 'cover' }} sizes="480px" priority/>
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>🥻</div>
            }
            {badge && <span style={{ position: 'absolute', top: 14, left: 14, background: '#DC2626', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700 }}>{badge}</span>}
            <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            {images.length > 1 && <span style={{ position: 'absolute', bottom: 12, right: 14, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.8)', fontSize: 11, padding: '3px 9px', borderRadius: 20 }}>{activeImg + 1} / {images.length}</span>}
          </div>

          {/* Thumbnail gallery */}
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {images.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImg(i)} aria-label={`Image ${i+1}`}
                  style={{ flexShrink: 0, width: 56, height: 72, borderRadius: 8, overflow: 'hidden', border: activeImg === i ? '2px solid #C9A84C' : '1.5px solid rgba(255,255,255,0.12)', cursor: 'pointer', background: '#1a1008', padding: 0, position: 'relative', opacity: activeImg === i ? 1 : 0.65, transition: 'opacity 0.2s, border-color 0.2s' }}>
                  <Image src={img.url} alt="" fill style={{ objectFit: 'cover' }} sizes="56px"/>
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: '16px 20px 36px' }}>
            {product.categoryName && <p style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 6, fontWeight: 700 }}>{product.categoryName}</p>}
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 400, color: '#fff', lineHeight: 1.2, marginBottom: 6 }}>{product.name}</h2>
            {(product.fabric || product.originRegion) && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>{[product.fabric, product.originRegion].filter(Boolean).join(' · ')}</p>}

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

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: '#C9A84C' }}>{fmt(priceOf(product))}</span>
              {product.salePrice && <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through' }}>{fmt(product.originalPrice)}</span>}
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>+GST</span>
            </div>

            {/* Low stock warning — only shows when genuinely low */}
            {lowStockVariants.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: '#f87171' }}>
                  Only {lowStockVariants[0].stock} left in {lowStockVariants[0].colour}
                  {lowStockVariants.length > 1 ? ` and ${lowStockVariants.length - 1} other colour${lowStockVariants.length > 2 ? 's' : ''}` : ''}
                </span>
              </div>
            )}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 20 }}/>

            {product.description && <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}>{product.description}</p>}

            {/* Colours */}
            {product.variants.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12, fontWeight: 700 }}>
                  {product.variants.length} colour{product.variants.length !== 1 ? 's' : ''} available
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {product.variants.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 24, padding: '6px 14px 6px 8px' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: v.colourHex || '#8B1A2B', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }}/>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{v.colour}</span>
                      {v.stock > 0 && v.stock <= 3 && <span style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>·{v.stock} left</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                <p style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10, fontWeight: 700 }}>Perfect for</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {product.occasion.map(o => <span key={o} style={{ background: 'rgba(139,26,43,0.18)', border: '1px solid rgba(139,26,43,0.4)', borderRadius: 20, padding: '5px 14px', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{o}</span>)}
                </div>
              </div>
            )}

            {/* Trust signal — WhatsApp CTA inside detail sheet too */}
            {waNumber && (
              <div style={{ background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" flexShrink="0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  Want to see this in more colours or similar designs?<br/>
                  <button onClick={() => window.open(buildWA([toWL(product)], waNumber), '_blank', 'noopener')} style={{ background: 'none', border: 'none', color: '#25D366', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 2 }}>Message us on WhatsApp →</button>
                </p>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '12px 16px 32px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10, flexShrink: 0, background: 'rgba(10,6,2,0.98)' }}>
          <button onClick={onLove} style={{ width: 54, height: 54, borderRadius: 14, flexShrink: 0, cursor: 'pointer', transition: 'all 0.2s', background: isLoved ? 'rgba(139,26,43,0.45)' : 'rgba(255,255,255,0.07)', border: isLoved ? '1.5px solid rgba(139,26,43,0.7)' : '1.5px solid rgba(255,255,255,0.12)', color: isLoved ? '#F87171' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={isLoved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <a href={`${STOREFRONT_URL}/product/${product.slug}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, height: 54, borderRadius: 14, background: 'linear-gradient(135deg,#8B1A2B,#6B1220)', color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', letterSpacing: 0.3, boxShadow: '0 4px 22px rgba(139,26,43,0.5)' }}>
            Buy Now
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </div>
      <style>{`@keyframes sheetUp{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}`}</style>
    </>
  )
}

// ─── Wishlist Screen ──────────────────────────────────────────────────────────
function WishlistScreen({ items, onClose, onRemove, onCall }: {
  items: WishlistItem[]; onClose: () => void; onRemove: (id: string) => void; onCall: () => void
}) {
  const total = items.reduce((s, it) => s + (it.salePrice ?? it.originalPrice), 0)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#080502', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '52px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'flex-end', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 400, color: '#fff' }}>Your Shortlist</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{items.length} {items.length === 1 ? 'saree' : 'sarees'} saved</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 56 }}>🥻</div>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>No sarees saved yet.<br/>Swipe right on anything you love!</p>
          <button onClick={onClose} style={{ marginTop: 8, padding: '12px 32px', background: 'rgba(139,26,43,0.25)', border: '1px solid rgba(139,26,43,0.45)', borderRadius: 12, color: '#F8A3AF', fontSize: 14, cursor: 'pointer' }}>Back to browsing</button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {items.map(it => (
                <div key={it.id} style={{ borderRadius: 14, overflow: 'hidden', background: '#1A1008', border: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
                  <div style={{ aspectRatio: '3/4', position: 'relative', overflow: 'hidden' }}>
                    {it.image ? <Image src={it.image} alt={it.name} fill style={{ objectFit: 'cover' }} sizes="(max-width:480px) 50vw, 220px"/> : <div style={{ width: '100%', height: '100%', background: '#2D1B1B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🥻</div>}
                    <button onClick={() => onRemove(it.id)} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div style={{ padding: '10px 12px 14px' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3, marginBottom: 3 }}>{it.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>{it.fabric || it.categoryName}</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#C9A84C' }}>{fmt(it.salePrice ?? it.originalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 16px 36px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,5,2,0.98)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{items.length} saree{items.length !== 1 ? 's' : ''}</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{fmt(total)}</span>
            </div>
            <button onClick={onCall} style={{ width: '100%', height: 54, borderRadius: 14, background: '#25D366', border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 20px rgba(37,211,102,0.3)' }}>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CataloguePage() {
  const [allProducts, setAllProducts] = useState<CatalogueProduct[]>([])
  const [config,      setConfig]      = useState<SiteConfig>({})
  const [loading,     setLoading]     = useState(true)
  const [idx,         setIdx]         = useState(0)
  const [wishlist,    setWishlist]    = useState<WishlistItem[]>([])
  const [detail,      setDetail]      = useState<CatalogueProduct | null>(null)
  const [showWL,      setShowWL]      = useState(false)
  const [undoSkip,    setUndoSkip]    = useState<{ p: CatalogueProduct; t: ReturnType<typeof setTimeout> } | null>(null)
  const [undoRm,      setUndoRm]      = useState<{ it: WishlistItem; t: ReturnType<typeof setTimeout> } | null>(null)
  const [dragProg,    setDragProg]    = useState(0)
  const [catFilter,   setCatFilter]   = useState('All')
  const [budgetIdx,   setBudgetIdx]   = useState(0)

  const waNumber = config.whatsapp_number || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''

  const categories = ['All', ...Array.from(new Set(allProducts.map(p => p.categoryName).filter(Boolean)))]
  const products   = allProducts.filter(p => {
    const catOk = catFilter === 'All' || p.categoryName === catFilter
    const b     = BUDGETS[budgetIdx]
    const price = priceOf(p)
    return catOk && price >= b.min && price <= b.max
  })

  useEffect(() => { setIdx(0) }, [catFilter, budgetIdx])

  const [dims, setDims] = useState({ w: 340, h: 500 })
  useEffect(() => {
    const calc = () => {
      const w = Math.min(window.innerWidth, 480) - 32
      const h = Math.min(window.innerHeight - 310, w * 1.42)
      setDims({ w: Math.round(w), h: Math.round(h) })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // Fetch products and config in parallel
  useEffect(() => {
    Promise.all([
      fetch('/api/products?limit=80').then(r => r.json()),
      fetch('/api/config').then(r => r.json()).catch(() => ({})),
    ]).then(([pd, cfg]) => {
      setAllProducts(pd.products || [])
      setConfig(cfg || {})
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { try { const s = localStorage.getItem('skss_wl'); if (s) setWishlist(JSON.parse(s)) } catch {} }, [])
  useEffect(() => { try { localStorage.setItem('skss_wl', JSON.stringify(wishlist)) } catch {} }, [wishlist])

  const loved  = useCallback((id: string) => wishlist.some(it => it.id === id), [wishlist])
  const save   = useCallback((p: CatalogueProduct) => setWishlist(prev => prev.find(it => it.id === p.id) ? prev : [...prev, toWL(p)]), [])
  const remove = useCallback((id: string) => {
    const it = wishlist.find(x => x.id === id); if (!it) return
    setWishlist(prev => prev.filter(x => x.id !== id))
    if (undoRm) clearTimeout(undoRm.t)
    setUndoRm({ it, t: setTimeout(() => setUndoRm(null), UNDO_MS) })
  }, [wishlist, undoRm])

  const swipe = useCallback((dir: 1 | -1) => {
    const p = products[idx]; if (!p) return
    if (dir === 1) { save(p); if (undoSkip) { clearTimeout(undoSkip.t); setUndoSkip(null) } }
    else {
      if (undoSkip) clearTimeout(undoSkip.t)
      setUndoSkip({ p, t: setTimeout(() => setUndoSkip(null), UNDO_MS) })
    }
    setDragProg(0); setIdx(i => i + 1)
  }, [products, idx, save, undoSkip])

  const btnSwipe = useCallback((dir: 1 | -1) => {
    const el = document.querySelector<HTMLElement>('[data-top-card]')
    if (el) {
      el.style.transition = 'transform 0.35s ease, opacity 0.3s ease'
      el.style.transform  = `translate(${dir * (dims.w + 300)}px, 0) rotate(${dir * 28}deg)`
      el.style.opacity    = '0'
      setTimeout(() => swipe(dir), 320)
    } else swipe(dir)
  }, [dims.w, swipe])

  const stack  = products.slice(idx, idx + 3)
  const isDone = !loading && idx >= products.length

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#080502', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Logo config={config}/>
      <p style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>Loading collection…</p>
    </div>
  )

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: '#080502', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 480, height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0805', overflow: 'hidden' }}>

          {/* Top bar */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 20px 12px' }}>
            <Logo config={config}/>
            <button onClick={() => setShowWL(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, padding: '8px 16px 8px 12px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={wishlist.length > 0 ? '#F87171' : 'none'} stroke={wishlist.length > 0 ? '#F87171' : 'rgba(255,255,255,0.7)'} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              Saved
              {wishlist.length > 0 && <span style={{ background: '#8B1A2B', color: '#fff', borderRadius: '50%', minWidth: 20, height: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{wishlist.length}</span>}
            </button>
          </div>

          {/* Category chips */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 7, padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {categories.slice(0, 8).map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{ flexShrink: 0, borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', border: catFilter === cat ? '1.5px solid #C9A84C' : '1px solid rgba(255,255,255,0.15)', background: catFilter === cat ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.05)', color: catFilter === cat ? '#C9A84C' : 'rgba(255,255,255,0.5)', transition: 'all 0.15s' }}>{cat}</button>
            ))}
          </div>

          {/* Budget chips */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 7, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {BUDGETS.map((b, i) => (
              <button key={b.label} onClick={() => setBudgetIdx(i)} style={{ flexShrink: 0, borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', border: budgetIdx === i ? '1.5px solid rgba(139,26,43,0.7)' : '1px solid rgba(255,255,255,0.1)', background: budgetIdx === i ? 'rgba(139,26,43,0.2)' : 'transparent', color: budgetIdx === i ? '#F8A3AF' : 'rgba(255,255,255,0.38)', transition: 'all 0.15s' }}>{b.label}</button>
            ))}
          </div>

          {/* Card stack */}
          <div style={{ flexShrink: 0, height: dims.h + 28, overflow: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 4 }}>
            {isDone ? (
              <div style={{ width: dims.w, height: dims.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 56 }}>🥻</div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 400, color: '#fff' }}>
                  {products.length === 0 ? 'No sarees match your filters' : "You've seen everything!"}
                </h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  {products.length === 0 ? 'Try a different category or budget.' : wishlist.length > 0 ? `${wishlist.length} saree${wishlist.length !== 1 ? 's' : ''} shortlisted.` : 'Browse again to save favourites.'}
                </p>
                {products.length === 0 && <button onClick={() => { setCatFilter('All'); setBudgetIdx(0) }} style={{ padding: '12px 0', width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 13, color: '#fff', fontSize: 14, cursor: 'pointer' }}>Clear filters</button>}
                {wishlist.length > 0 && products.length > 0 && <button onClick={() => setShowWL(true)} style={{ padding: '13px 0', width: '100%', background: 'linear-gradient(135deg,#8B1A2B,#6B1220)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>View shortlist & Book call</button>}
                {products.length > 0 && <button onClick={() => setIdx(0)} style={{ padding: '11px 0', width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>Browse again</button>}
              </div>
            ) : (
              [...stack].reverse().map((p, ri) => {
                const si = stack.length - 1 - ri
                return <TinderCard key={p.id} product={p} stackIndex={si} isTop={si === 0} dragProgress={dragProg} onSwipe={swipe} onTap={() => setDetail(p)} onDragProgress={si === 0 ? setDragProg : () => {}} cardW={dims.w} cardH={dims.h}/>
              })
            )}
          </div>

          {/* Progress bar */}
          {!isDone && products.length > 0 && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '8px 16px' }}>
              <div style={{ height: 3, flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((idx / Math.max(products.length, 1)) * 100)}%`, background: '#C9A84C', borderRadius: 2, transition: 'width 0.3s ease' }}/>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginLeft: 10, flexShrink: 0 }}>{idx} / {products.length}</span>
            </div>
          )}

          {/* Action buttons */}
          {!isDone && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '6px 0 20px' }}>
              <button onClick={() => { if (undoSkip) { clearTimeout(undoSkip.t); setIdx(i => Math.max(0, i - 1)); setUndoSkip(null) } }} disabled={!undoSkip} style={{ width: 46, height: 46, borderRadius: '50%', background: undoSkip ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)', border: undoSkip ? '1.5px solid rgba(251,191,36,0.5)' : '1.5px solid rgba(255,255,255,0.08)', color: undoSkip ? '#FBBF24' : 'rgba(255,255,255,0.2)', cursor: undoSkip ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.14"/></svg>
              </button>
              <button onClick={() => btnSwipe(-1)} style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: 'none', color: '#F87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.35)', flexShrink: 0 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <button onClick={() => btnSwipe(1)} style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: 'none', color: '#4ade80', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.35)', flexShrink: 0 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
              <button onClick={() => products[idx] && setDetail(products[idx])} style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(139,26,43,0.12)', border: '1.5px solid rgba(139,26,43,0.35)', color: '#F87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </button>
            </div>
          )}

          {/* Floating WhatsApp pill — shows once 2+ saved */}
          {wishlist.length >= 2 && !showWL && !detail && waNumber && (
            <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 40, animation: 'floatIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <button onClick={() => window.open(buildWA(wishlist, waNumber), '_blank', 'noopener')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#25D366', border: 'none', borderRadius: 28, padding: '10px 20px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(37,211,102,0.45)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Book a call · {wishlist.length} saved
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

      <style>{`@keyframes floatIn{from{opacity:0;transform:translateX(-50%) translateY(12px) scale(0.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}`}</style>

      {detail && <DetailSheet product={detail} isLoved={loved(detail.id)} onClose={() => setDetail(null)} onLove={() => loved(detail.id) ? remove(detail.id) : save(detail)} waNumber={waNumber}/>}
      {showWL  && <WishlistScreen items={wishlist} onClose={() => setShowWL(false)} onRemove={remove} onCall={() => window.open(buildWA(wishlist, waNumber), '_blank', 'noopener')}/>}
    </>
  )
}
