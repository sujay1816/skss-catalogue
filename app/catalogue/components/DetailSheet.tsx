'use client'
import React, { useState, useRef } from 'react'
import Image from 'next/image'
import type { CatalogueProduct } from '@/types'
import type { FlashSale } from '../types'
import { Countdown } from './Countdown'

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || ''
const fmt  = (n: number) => '₹' + n.toLocaleString('en-IN')
const disc = (o: number, s: number | null) => (!s || s >= o) ? null : Math.round(((o - s) / o) * 100) + '% off'
const priceOf = (p: CatalogueProduct) => p.salePrice ?? p.originalPrice

export function DetailSheet({
  product,
  isLoved,
  onClose,
  onLove,
  waNum,
  flashSale,
  onBookCall,
  allProducts,
  onSelectSimilar,
}: {
  product: CatalogueProduct
  isLoved: boolean
  onClose: () => void
  onLove: () => void
  waNum: string
  flashSale: FlashSale
  onBookCall: () => void
  allProducts: CatalogueProduct[]
  onSelectSimilar: (p: CatalogueProduct) => void
}) {
  const [activeImg, setActiveImg] = useState(0)
  const sheetRef   = useRef<HTMLDivElement>(null)
  const sheetSwipe = useRef({ on: false, y0: 0 })
  // UX-12: image swipe tracking
  const imgSwipe   = useRef({ on: false, x0: 0 })

  const images     = [...product.images].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : a.order - b.order))
  const badge      = disc(product.originalPrice, product.salePrice)
  const flashPrice = flashSale?.saleMap[product.id]
  const rows       = ([
    ['Fabric', product.fabric],
    ['Weave', product.weaveType],
    ['Origin', product.originRegion],
    ['Length', product.length ? `${product.length}m` : ''],
    ['Weight', product.weightGrams ? `${product.weightGrams}g` : ''],
    ['Blouse', product.blouseIncluded ? 'Included' : ''],
    ['Care', product.careInstructions],
  ] as [string, string][]).filter(([, v]) => v)
  const lowStock    = product.variants.filter(v => v.stock > 0 && v.stock <= 3)
  const displayPrice = flashPrice ?? priceOf(product)
  // UX-05: sort variants in-stock first
  const sortedVariants = [...product.variants].sort((a, b) =>
    (a.stock > 0 ? 0 : 1) - (b.stock > 0 ? 0 : 1)
  )

  // Sheet swipe-down to close
  const sheetDown = (e: React.PointerEvent) => { sheetSwipe.current = { on: true, y0: e.clientY }; sheetRef.current?.setPointerCapture(e.pointerId) }
  const sheetMove = (e: React.PointerEvent) => {
    if (!sheetSwipe.current.on || !sheetRef.current) return
    const dy = e.clientY - sheetSwipe.current.y0
    if (dy > 0) sheetRef.current.style.transform = `translateX(-50%) translateY(${dy}px)`
  }
  const sheetUp = (e: React.PointerEvent) => {
    if (!sheetSwipe.current.on) return
    sheetSwipe.current.on = false
    const dy = e.clientY - sheetSwipe.current.y0
    if (!sheetRef.current) return
    if (dy > 80) { onClose(); return }
    sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)'
    sheetRef.current.style.transform  = 'translateX(-50%) translateY(0)'
    setTimeout(() => { if (sheetRef.current) sheetRef.current.style.transition = '' }, 350)
  }

  // UX-12: Image swipe — horizontal swipe on main image cycles through photos
  const imgDown = (e: React.PointerEvent) => {
    if (images.length <= 1) return
    imgSwipe.current = { on: true, x0: e.clientX }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const imgUp = (e: React.PointerEvent) => {
    if (!imgSwipe.current.on) return
    imgSwipe.current.on = false
    const dx = e.clientX - imgSwipe.current.x0
    if (Math.abs(dx) < 30) return
    if (dx < 0) setActiveImg(i => Math.min(i + 1, images.length - 1))
    else         setActiveImg(i => Math.max(i - 1, 0))
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}/>
      <div ref={sheetRef} style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, maxHeight: '92dvh', zIndex: 301, background: '#0f0a06', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 -16px 60px rgba(0,0,0,0.95)', animation: 'sheetUp 0.38s cubic-bezier(0.32,0.72,0,1)' }}>

        {/* Handle — swipe down to close */}
        <div onPointerDown={sheetDown} onPointerMove={sheetMove} onPointerUp={sheetUp} style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 8px', flexShrink: 0, cursor: 'grab', touchAction: 'none' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }}/>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Main image with UX-12 horizontal swipe gesture */}
          <div
            style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#1a1008', touchAction: 'pan-y' }}
            onPointerDown={imgDown}
            onPointerUp={imgUp}
          >
            {images[activeImg]?.url
              ? <Image src={images[activeImg].url} alt={product.name} fill style={{ objectFit: 'cover', objectPosition: 'top', pointerEvents: 'none' }} sizes="480px" priority/>
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>🥻</div>
            }
            {/* Flash badge */}
            {flashPrice && flashSale && (
              <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(220,38,38,0.92)', color: '#fff', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⏱</span><span>Ends in <Countdown endsAt={flashSale.ends_at}/></span>
              </div>
            )}
            {!flashPrice && badge && <span style={{ position: 'absolute', top: 14, left: 14, background: '#DC2626', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700 }}>{badge}</span>}
            <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            {/* Image counter + swipe dot indicators */}
            {images.length > 1 && (
              <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, alignItems: 'center' }}>
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={e => { e.stopPropagation(); setActiveImg(i) }}
                    style={{ width: i === activeImg ? 18 : 6, height: 6, borderRadius: 3, background: i === activeImg ? '#C9A84C' : 'rgba(255,255,255,0.4)', border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.2s ease' }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {images.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImg(i)} aria-label={`Image ${i + 1}`}
                  style={{ flexShrink: 0, width: 56, height: 72, borderRadius: 8, overflow: 'hidden', border: activeImg === i ? '2px solid #C9A84C' : '1.5px solid rgba(255,255,255,0.12)', cursor: 'pointer', background: '#1a1008', padding: 0, position: 'relative', opacity: activeImg === i ? 1 : 0.65, transition: 'opacity 0.2s, border-color 0.2s' }}>
                  <Image src={img.url} alt={img.altText || `${product.name} – view ${i + 1}`} fill style={{ objectFit: 'cover', objectPosition: 'top' }} sizes="56px"/>
                </button>
              ))}
            </div>
          )}

          {/* Video */}
          {product.videoUrl && (
            <div style={{ padding: '12px 16px 0' }}>
              <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
                <video src={product.videoUrl} controls playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}/>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, textAlign: 'center', letterSpacing: 0.5 }}>Drape video</p>
            </div>
          )}

          <div style={{ padding: '16px 20px 36px' }}>
            {product.categoryName && <p style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 6, fontWeight: 700 }}>{product.categoryName}</p>}
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 400, color: '#fff', lineHeight: 1.2, marginBottom: 6 }}>{product.name}</h2>
            {(product.fabric || product.originRegion) && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>{[product.fabric, product.originRegion].filter(Boolean).join(' · ')}</p>}

            {/* Ratings */}
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
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: flashPrice ? '#f87171' : '#C9A84C' }}>{fmt(displayPrice)}</span>
                {(flashPrice || product.salePrice) && <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through' }}>{fmt(product.originalPrice)}</span>}
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>excl. GST</span>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 1.4 }}>
                {fmt(Math.round(displayPrice * (1 + (product.gstRate || 5) / 100)))} incl. {product.gstRate || 5}% GST
                {(flashPrice || product.salePrice) && (
                  <span style={{ color: 'rgba(255,255,255,0.15)', textDecoration: 'line-through', marginLeft: 6 }}>
                    {fmt(Math.round(product.originalPrice * (1 + (product.gstRate || 5) / 100)))}
                  </span>
                )}
              </p>
            </div>

            {/* Low stock warning */}
            {lowStock.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: '#f87171' }}>Only {lowStock[0].stock} left in {lowStock[0].colour}{lowStock.length > 1 ? ` and ${lowStock.length - 1} more` : ''}</span>
              </div>
            )}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 20 }}/>
            {product.description && <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}>{product.description}</p>}

            {/* UX-05: Variants with in/out-of-stock styling */}
            {sortedVariants.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12, fontWeight: 700 }}>
                  {sortedVariants.filter(v => v.stock > 0).length} colour{sortedVariants.filter(v => v.stock > 0).length !== 1 ? 's' : ''} available
                  {sortedVariants.some(v => v.stock === 0) && <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}> · {sortedVariants.filter(v => v.stock === 0).length} sold out</span>}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sortedVariants.map(v => (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: v.stock === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                        border: v.stock === 0 ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.09)',
                        borderRadius: 24, padding: '6px 14px 6px 8px',
                        opacity: v.stock === 0 ? 0.45 : 1,
                      }}
                    >
                      <div style={{ position: 'relative', width: 18, height: 18, borderRadius: '50%', background: v.colourHex || '#8B1A2B', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
                        {v.stock === 0 && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '130%', height: 2, background: 'rgba(255,255,255,0.7)', transform: 'rotate(-45deg)' }}/>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 13, color: v.stock === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)', fontWeight: 500, textDecoration: v.stock === 0 ? 'line-through' : 'none' }}>{v.colour}</span>
                      {v.stock > 0 && v.stock <= 3 && <span style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>· {v.stock} left</span>}
                      {v.stock === 0 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>sold out</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spec grid */}
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

            {/* Occasions */}
            {product.occasion?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10, fontWeight: 700 }}>Perfect for</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {product.occasion.map(o => <span key={o} style={{ background: 'rgba(139,26,43,0.18)', border: '1px solid rgba(139,26,43,0.4)', borderRadius: 20, padding: '5px 14px', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{o}</span>)}
                </div>
              </div>
            )}

            {/* Similar sarees */}
            {(() => {
              const similar = allProducts
                .filter(p => p.id !== product.id && (p.categoryName === product.categoryName || p.fabric === product.fabric))
                .slice(0, 6)
              if (similar.length === 0) return null
              return (
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12, fontWeight: 700 }}>You may also like</p>
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                    {similar.map(s => {
                      const sImg = (s.images.find(i => i.isPrimary) || s.images[0])?.url || ''
                      const sPrice = s.salePrice ?? s.originalPrice
                      return (
                        <button key={s.id} onClick={() => onSelectSimilar(s)}
                          style={{ flexShrink: 0, width: 110, cursor: 'pointer', background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
                          aria-label={s.name}>
                          <div style={{ width: 110, height: 146, borderRadius: 10, overflow: 'hidden', background: '#1a1008', position: 'relative', marginBottom: 7, border: '1px solid rgba(255,255,255,0.08)' }}>
                            {sImg ? <Image src={sImg} alt={s.name} fill style={{ objectFit: 'cover', objectPosition: 'top' }} sizes="110px"/> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🥻</div>}
                          </div>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C' }}>{fmt(sPrice)}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* WhatsApp nudge */}
            {waNum && (
              <div style={{ background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" style={{ flexShrink: 0 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  See this in more colours or explore similar designs.<br/>
                  <button onClick={() => { onClose(); setTimeout(onBookCall, 100) }} style={{ background: 'none', border: 'none', color: '#25D366', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 2 }}>Message us on WhatsApp →</button>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
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
    </>
  )
}
