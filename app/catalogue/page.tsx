'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import type { CatalogueProduct, WishlistItem } from '@/types'

const STOREFRONT_URL  = process.env.NEXT_PUBLIC_STOREFRONT_URL || ''
const WA_NUMBER       = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
const SWIPE_THRESHOLD = 80
const UNDO_MS         = 3500

function getPrice(p: CatalogueProduct) { return p.salePrice ?? p.originalPrice }
function fmt(n: number) { return '₹' + n.toLocaleString('en-IN') }
function pct(orig: number, sale: number | null) {
  if (!sale || sale >= orig) return null
  return Math.round(((orig - sale) / orig) * 100) + '% off'
}
function getPrimaryImg(p: CatalogueProduct) {
  return (p.images.find(i => i.isPrimary) || p.images[0])?.url || ''
}
function toItem(p: CatalogueProduct): WishlistItem {
  return { id: p.id, name: p.name, slug: p.slug, image: getPrimaryImg(p), fabric: p.fabric, categoryName: p.categoryName, originalPrice: p.originalPrice, salePrice: p.salePrice }
}
function waUrl(items: WishlistItem[]) {
  const list = items.map((it, i) => `${i + 1}. ${it.name} — ${fmt(it.salePrice ?? it.originalPrice)}`).join('\n')
  const msg  = encodeURIComponent(`Hi! I've shortlisted these sarees from your catalogue:\n\n${list}\n\nCan we schedule a video call to see these and explore more designs?`)
  return `https://wa.me/${WA_NUMBER}?text=${msg}`
}

function Stars({ r }: { r: number }) {
  return (
    <span style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24"
          fill={i <= Math.round(r) ? '#C9A84C' : 'none'}
          stroke={i <= Math.round(r) ? '#C9A84C' : 'rgba(255,255,255,0.25)'} strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}

function Card({ product, onSwipe, onTap }: { product: CatalogueProduct; onSwipe: (dir: 1 | -1) => void; onTap: () => void }) {
  const ref  = useRef<HTMLDivElement>(null)
  const drag = useRef({ on: false, x0: 0, dx: 0 })
  const raf  = useRef(0)
  const img  = getPrimaryImg(product)
  const badge = pct(product.originalPrice, product.salePrice)

  const down = (e: React.PointerEvent) => {
    drag.current = { on: true, x0: e.clientX, dx: 0 }
    ref.current?.setPointerCapture(e.pointerId)
    if (ref.current) ref.current.style.transition = 'none'
  }
  const move = (e: React.PointerEvent) => {
    if (!drag.current.on) return
    const dx = e.clientX - drag.current.x0
    drag.current.dx = dx
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      if (!ref.current) return
      ref.current.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`
      const like = ref.current.querySelector<HTMLElement>('#like-lbl')
      const nope = ref.current.querySelector<HTMLElement>('#nope-lbl')
      const t = Math.min(Math.abs(dx) / 60, 1)
      if (like) like.style.opacity = dx > 0 ? String(t) : '0'
      if (nope) nope.style.opacity = dx < 0 ? String(t) : '0'
    })
  }
  const up = () => {
    if (!drag.current.on) return
    drag.current.on = false
    const dx = drag.current.dx
    if (!ref.current) return
    if (Math.abs(dx) < 5) {
      onTap()
      ref.current.style.transition = 'transform 0.2s'
      ref.current.style.transform  = 'none'
      return
    }
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      const dir = dx > 0 ? 1 : -1
      ref.current.style.transition = 'transform 0.3s ease, opacity 0.3s ease'
      ref.current.style.transform  = `translateX(${dir * 600}px) rotate(${dir * 20}deg)`
      ref.current.style.opacity    = '0'
      setTimeout(() => onSwipe(dir as 1|-1), 280)
    } else {
      ref.current.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)'
      ref.current.style.transform  = 'none'
      const like = ref.current.querySelector<HTMLElement>('#like-lbl')
      const nope = ref.current.querySelector<HTMLElement>('#nope-lbl')
      if (like) like.style.opacity = '0'
      if (nope) nope.style.opacity = '0'
    }
  }

  return (
    <div ref={ref} data-top-card=""
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      style={{ position:'absolute', inset:0, borderRadius:20, overflow:'hidden', cursor:'grab', userSelect:'none', touchAction:'none', background:'#1a1008', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>
      {img
        ? <Image src={img} alt={product.name} fill style={{ objectFit:'cover', pointerEvents:'none' }} sizes="480px" priority draggable={false} />
        : <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:80 }}>🥻</div>
      }
      <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.25) 40%,transparent 65%)',pointerEvents:'none' }} />
      <div id="like-lbl" style={{ position:'absolute',top:28,left:20,opacity:0,pointerEvents:'none',background:'rgba(34,197,94,0.9)',border:'2px solid #22c55e',borderRadius:8,padding:'5px 16px',color:'#fff',fontSize:17,fontWeight:700,letterSpacing:1,transform:'rotate(-12deg)' }}>LOVED ♥</div>
      <div id="nope-lbl" style={{ position:'absolute',top:28,right:20,opacity:0,pointerEvents:'none',background:'rgba(239,68,68,0.9)',border:'2px solid #ef4444',borderRadius:8,padding:'5px 16px',color:'#fff',fontSize:17,fontWeight:700,letterSpacing:1,transform:'rotate(12deg)' }}>SKIP</div>
      <div style={{ position:'absolute',top:16,right:16,display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end' }}>
        {product.isBestseller && <span style={{ background:'rgba(201,168,76,0.2)',backdropFilter:'blur(8px)',border:'1px solid rgba(201,168,76,0.5)',color:'#C9A84C',borderRadius:20,padding:'3px 10px',fontSize:10,fontWeight:500,textTransform:'uppercase' }}>Bestseller</span>}
        {product.isNew && !product.isBestseller && <span style={{ background:'rgba(139,26,43,0.3)',backdropFilter:'blur(8px)',border:'1px solid rgba(139,26,43,0.5)',color:'#F8A3AF',borderRadius:20,padding:'3px 10px',fontSize:10,fontWeight:500,textTransform:'uppercase' }}>New</span>}
        {badge && <span style={{ background:'rgba(239,68,68,0.85)',color:'#fff',borderRadius:20,padding:'3px 10px',fontSize:10,fontWeight:600 }}>{badge}</span>}
      </div>
      <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'16px 20px 20px' }}>
        {product.categoryName && <p style={{ fontSize:10,letterSpacing:2,textTransform:'uppercase',color:'rgba(201,168,76,0.8)',marginBottom:4,fontWeight:500 }}>{product.categoryName}</p>}
        <p style={{ fontFamily:'var(--font-heading)',fontSize:22,fontWeight:400,color:'#fff',lineHeight:1.2,marginBottom:3 }}>{product.name}</p>
        {(product.fabric||product.originRegion) && <p style={{ fontSize:12,color:'rgba(255,255,255,0.45)',marginBottom:8 }}>{[product.fabric,product.originRegion].filter(Boolean).join(' · ')}</p>}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div>
            <span style={{ fontSize:22,fontWeight:600,color:'#C9A84C' }}>{fmt(getPrice(product))}</span>
            {product.salePrice && <span style={{ fontSize:12,color:'rgba(255,255,255,0.3)',textDecoration:'line-through',marginLeft:6 }}>{fmt(product.originalPrice)}</span>}
          </div>
          {product.variants.length > 0 && (
            <div style={{ display:'flex',gap:5,alignItems:'center' }}>
              {product.variants.slice(0,6).map(v => <div key={v.id} style={{ width:13,height:13,borderRadius:'50%',background:v.colourHex||'#8B1A2B',border:'1.5px solid rgba(255,255,255,0.3)' }} />)}
              {product.variants.length > 6 && <span style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>+{product.variants.length-6}</span>}
            </div>
          )}
        </div>
        <p style={{ fontSize:11,color:'rgba(255,255,255,0.28)',marginTop:6,textAlign:'center' }}>Tap card for details</p>
      </div>
    </div>
  )
}

function DetailSheet({ product, isLoved, onClose, onLove }: { product: CatalogueProduct; isLoved: boolean; onClose: () => void; onLove: () => void }) {
  const img   = getPrimaryImg(product)
  const badge = pct(product.originalPrice, product.salePrice)
  const details = [['Fabric',product.fabric],['Weave',product.weaveType],['Origin',product.originRegion],['Length',product.length?`${product.length}m`:''],['Blouse',product.blouseIncluded?'Included':'Not included'],['Care',product.careInstructions]].filter(([,v])=>v) as [string,string][]

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(3px)' }} />
      <div style={{ position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,maxHeight:'90dvh',zIndex:101,background:'#141008',borderRadius:'22px 22px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 -8px 40px rgba(0,0,0,0.8)',animation:'sheetUp 0.35s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ display:'flex',justifyContent:'center',padding:'12px 0 6px',flexShrink:0 }}>
          <div style={{ width:36,height:4,borderRadius:2,background:'rgba(255,255,255,0.18)' }} />
        </div>
        <div style={{ overflowY:'auto',flex:1 }}>
          {/* Primary image */}
          <div style={{ position:'relative',width:'100%',aspectRatio:'3/4',background:'#1a1008' }}>
            {img
              ? <Image src={img} alt={product.name} fill style={{ objectFit:'cover' }} sizes="480px" priority />
              : <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:60 }}>🥻</div>
            }
            {badge && <span style={{ position:'absolute',top:14,left:14,background:'#DC2626',color:'#fff',borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:600 }}>{badge}</span>}
            <button onClick={onClose} style={{ position:'absolute',top:14,right:14,width:34,height:34,borderRadius:'50%',background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {/* Info */}
          <div style={{ padding:'18px 20px 28px' }}>
            {product.categoryName && <p style={{ fontSize:10,letterSpacing:2,textTransform:'uppercase',color:'#C9A84C',marginBottom:6,fontWeight:500 }}>{product.categoryName}</p>}
            <h2 style={{ fontFamily:'var(--font-heading)',fontSize:24,fontWeight:400,color:'#fff',lineHeight:1.2,marginBottom:4 }}>{product.name}</h2>
            {(product.fabric||product.originRegion) && <p style={{ fontSize:13,color:'rgba(255,255,255,0.4)',marginBottom:12 }}>{[product.fabric,product.originRegion].filter(Boolean).join(' · ')}</p>}
            {product.reviewCount > 0 && (
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:14 }}>
                <Stars r={product.averageRating} />
                <span style={{ fontSize:12,color:'rgba(255,255,255,0.35)' }}>{product.averageRating.toFixed(1)} · {product.reviewCount} reviews</span>
              </div>
            )}
            <div style={{ display:'flex',alignItems:'baseline',gap:10,marginBottom:18 }}>
              <span style={{ fontSize:26,fontWeight:600,color:'#C9A84C' }}>{fmt(getPrice(product))}</span>
              {product.salePrice && <span style={{ fontSize:14,color:'rgba(255,255,255,0.25)',textDecoration:'line-through' }}>{fmt(product.originalPrice)}</span>}
              <span style={{ fontSize:11,color:'rgba(255,255,255,0.25)' }}>+GST</span>
            </div>
            <div style={{ height:1,background:'rgba(255,255,255,0.07)',marginBottom:18 }} />
            {product.description && <p style={{ fontSize:14,lineHeight:1.7,color:'rgba(255,255,255,0.55)',marginBottom:18 }}>{product.description}</p>}

            {/* Colours */}
            {product.variants.length > 0 && (
              <div style={{ marginBottom:18 }}>
                <p style={{ fontSize:11,letterSpacing:1,textTransform:'uppercase',color:'rgba(255,255,255,0.3)',marginBottom:10 }}>Available in {product.variants.length} colour{product.variants.length!==1?'s':''}</p>
                <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                  {product.variants.map(v => (
                    <div key={v.id} style={{ display:'flex',alignItems:'center',gap:7,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:'5px 12px 5px 7px' }}>
                      <div style={{ width:16,height:16,borderRadius:'50%',background:v.colourHex||'#8B1A2B',border:'1.5px solid rgba(255,255,255,0.2)',flexShrink:0 }} />
                      <span style={{ fontSize:12,color:'rgba(255,255,255,0.6)' }}>{v.colour}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Details grid */}
            {details.length > 0 && (
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:18 }}>
                {details.map(([label,value]) => (
                  <div key={label} style={{ background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:'9px 12px' }}>
                    <p style={{ fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:1,textTransform:'uppercase',marginBottom:3 }}>{label}</p>
                    <p style={{ fontSize:13,color:'rgba(255,255,255,0.75)',fontWeight:500 }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Occasions */}
            {product.occasion?.length > 0 && (
              <div style={{ marginBottom:18 }}>
                <p style={{ fontSize:11,letterSpacing:1,textTransform:'uppercase',color:'rgba(255,255,255,0.3)',marginBottom:8 }}>Perfect for</p>
                <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                  {product.occasion.map(o => <span key={o} style={{ background:'rgba(139,26,43,0.2)',border:'1px solid rgba(139,26,43,0.35)',borderRadius:20,padding:'4px 12px',fontSize:12,color:'rgba(255,255,255,0.6)' }}>{o}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* CTAs */}
        <div style={{ padding:'12px 16px 28px',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:10,flexShrink:0,background:'rgba(20,16,8,0.98)' }}>
          <button onClick={onLove} style={{ width:52,height:52,borderRadius:13,flexShrink:0,cursor:'pointer',background:isLoved?'rgba(139,26,43,0.45)':'rgba(255,255,255,0.07)',border:isLoved?'1.5px solid rgba(139,26,43,0.6)':'1.5px solid rgba(255,255,255,0.12)',color:isLoved?'#F87171':'rgba(255,255,255,0.4)',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={isLoved?'currentColor':'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <a href={`${STOREFRONT_URL}/product/${product.slug}`} target="_blank" rel="noopener noreferrer" style={{ flex:1,height:52,borderRadius:13,background:'linear-gradient(135deg,#8B1A2B,#6B1220)',color:'#fff',fontSize:15,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',gap:8,textDecoration:'none',boxShadow:'0 4px 18px rgba(139,26,43,0.4)' }}>
            Buy Now
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </div>
      <style>{`@keyframes sheetUp{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}`}</style>
    </>
  )
}

function WishlistScreen({ items, onClose, onRemove, onBookCall }: { items: WishlistItem[]; onClose: () => void; onRemove: (id: string) => void; onBookCall: () => void }) {
  const total = items.reduce((s,it) => s+(it.salePrice??it.originalPrice),0)
  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,background:'#0D0905',display:'flex',flexDirection:'column' }}>
      <div style={{ padding:'52px 20px 18px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'flex-end',gap:12,flexShrink:0 }}>
        <button onClick={onClose} style={{ width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.7)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 style={{ fontFamily:'var(--font-heading)',fontSize:24,fontWeight:400,color:'#fff' }}>Your Shortlist</h1>
          <p style={{ fontSize:12,color:'rgba(255,255,255,0.35)',marginTop:2 }}>{items.length} {items.length===1?'saree':'sarees'} saved</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:40 }}>
          <div style={{ fontSize:52 }}>🥻</div>
          <p style={{ fontSize:15,color:'rgba(255,255,255,0.35)',textAlign:'center',lineHeight:1.6 }}>No sarees saved yet.<br/>Swipe right on anything you love!</p>
          <button onClick={onClose} style={{ marginTop:8,padding:'11px 28px',background:'rgba(139,26,43,0.25)',border:'1px solid rgba(139,26,43,0.45)',borderRadius:11,color:'#F8A3AF',fontSize:14,cursor:'pointer' }}>Back to swiping</button>
        </div>
      ) : (
        <>
          <div style={{ flex:1,overflowY:'auto',padding:16 }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
              {items.map(it => (
                <div key={it.id} style={{ borderRadius:14,overflow:'hidden',background:'#1A1008',border:'1px solid rgba(255,255,255,0.07)',position:'relative' }}>
                  <div style={{ aspectRatio:'3/4',position:'relative',overflow:'hidden' }}>
                    {it.image
                      ? <Image src={it.image} alt={it.name} fill style={{ objectFit:'cover' }} sizes="200px"/>
                      : <div style={{ width:'100%',height:'100%',background:'#2D1B1B',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36 }}>🥻</div>
                    }
                    <button onClick={() => onRemove(it.id)} style={{ position:'absolute',top:7,right:7,width:26,height:26,borderRadius:'50%',background:'rgba(0,0,0,0.65)',backdropFilter:'blur(6px)',border:'1px solid rgba(255,255,255,0.18)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div style={{ padding:'9px 11px 13px' }}>
                    <p style={{ fontSize:12,fontWeight:500,color:'#fff',lineHeight:1.3,marginBottom:3 }}>{it.name}</p>
                    <p style={{ fontSize:11,color:'rgba(255,255,255,0.3)',marginBottom:5 }}>{it.fabric||it.categoryName}</p>
                    <p style={{ fontSize:13,fontWeight:600,color:'#C9A84C' }}>{fmt(it.salePrice??it.originalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding:'14px 16px 32px',borderTop:'1px solid rgba(255,255,255,0.07)',background:'rgba(13,9,5,0.98)',flexShrink:0 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
              <span style={{ fontSize:12,color:'rgba(255,255,255,0.35)' }}>{items.length} saree{items.length!==1?'s':''} shortlisted</span>
              <span style={{ fontSize:15,fontWeight:500,color:'#fff' }}>{fmt(total)}</span>
            </div>
            <button onClick={onBookCall} style={{ width:'100%',height:52,borderRadius:13,background:'#25D366',border:'none',color:'#fff',fontSize:15,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:9,boxShadow:'0 4px 18px rgba(37,211,102,0.28)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Book a Video Call
            </button>
            <button onClick={onClose} style={{ width:'100%',height:42,marginTop:9,borderRadius:11,background:'transparent',border:'1px solid rgba(255,255,255,0.09)',color:'rgba(255,255,255,0.35)',fontSize:13,cursor:'pointer' }}>Keep browsing</button>
          </div>
        </>
      )}
    </div>
  )
}

export default function CataloguePage() {
  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [loading,  setLoading]  = useState(true)
  const [idx,      setIdx]      = useState(0)
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [detail,   setDetail]   = useState<CatalogueProduct | null>(null)
  const [showWL,   setShowWL]   = useState(false)
  const [undoSkip, setUndoSkip] = useState<{ p: CatalogueProduct; t: ReturnType<typeof setTimeout> } | null>(null)
  const [undoRm,   setUndoRm]   = useState<{ it: WishlistItem; t: ReturnType<typeof setTimeout> } | null>(null)

  useEffect(() => {
    fetch('/api/products?limit=80')
      .then(r => r.json())
      .then(d => { setProducts(d.products || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { try { const s = localStorage.getItem('skss_wl'); if (s) setWishlist(JSON.parse(s)) } catch {} }, [])
  useEffect(() => { try { localStorage.setItem('skss_wl', JSON.stringify(wishlist)) } catch {} }, [wishlist])

  const loved  = useCallback((id: string) => wishlist.some(it => it.id === id), [wishlist])
  const save   = useCallback((p: CatalogueProduct) => setWishlist(prev => prev.find(it=>it.id===p.id) ? prev : [...prev, toItem(p)]), [])
  const remove = useCallback((id: string) => {
    const it = wishlist.find(x=>x.id===id); if (!it) return
    setWishlist(prev => prev.filter(x=>x.id!==id))
    if (undoRm) clearTimeout(undoRm.t)
    const t = setTimeout(() => setUndoRm(null), UNDO_MS)
    setUndoRm({ it, t })
  }, [wishlist, undoRm])

  const swipe = useCallback((dir: 1|-1) => {
    const p = products[idx]; if (!p) return
    if (dir === 1) { save(p); if (undoSkip) { clearTimeout(undoSkip.t); setUndoSkip(null) } }
    else {
      if (undoSkip) clearTimeout(undoSkip.t)
      const t = setTimeout(() => setUndoSkip(null), UNDO_MS)
      setUndoSkip({ p, t })
    }
    setIdx(i => i+1)
  }, [products, idx, save, undoSkip])

  const btnSwipe = (dir: 1|-1) => {
    const el = document.querySelector<HTMLElement>('[data-top-card]')
    if (el) {
      el.style.transition = 'transform 0.3s ease, opacity 0.3s ease'
      el.style.transform  = `translateX(${dir*600}px) rotate(${dir*20}deg)`
      el.style.opacity    = '0'
      setTimeout(() => swipe(dir), 280)
    } else swipe(dir)
  }

  const current = products[idx]
  const isDone  = !loading && idx >= products.length

  if (loading) return (
    <div style={{ position:'fixed',inset:0,background:'#0D0905',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14 }}>
      <div style={{ fontSize:48 }}>🥻</div>
      <p style={{ fontFamily:'var(--font-heading)',fontSize:18,color:'rgba(255,255,255,0.4)' }}>Loading collection…</p>
    </div>
  )

  return (
    <>
      <div style={{ position:'fixed',inset:0,background:'#0D0905',display:'flex',justifyContent:'center',alignItems:'stretch' }}>
        <div style={{ width:'100%',maxWidth:480,height:'100dvh',display:'flex',flexDirection:'column',background:'#1a1008',overflow:'hidden',position:'relative' }}>

          {/* Top bar */}
          <div style={{ flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'48px 20px 14px',zIndex:10 }}>
            <div>
              <p style={{ fontFamily:'var(--font-heading)',fontSize:17,fontWeight:400,color:'#fff',letterSpacing:0.5 }}>Collection</p>
              {!isDone && <p style={{ fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:1 }}>{products.length-idx} remaining</p>}
            </div>
            <button onClick={() => setShowWL(true)} style={{ display:'flex',alignItems:'center',gap:7,background:'rgba(255,255,255,0.09)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:22,padding:'7px 14px 7px 11px',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:500 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill={wishlist.length>0?'#F87171':'none'} stroke={wishlist.length>0?'#F87171':'currentColor'} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              Saved
              {wishlist.length > 0 && <span style={{ background:'#8B1A2B',color:'#fff',borderRadius:'50%',minWidth:18,height:18,fontSize:10,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 3px' }}>{wishlist.length}</span>}
            </button>
          </div>

          {/* Card area */}
          <div style={{ flex:1,position:'relative',overflow:'hidden',minHeight:0 }}>
            {isDone ? (
              <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:36,textAlign:'center' }}>
                <div style={{ fontSize:56 }}>🥻</div>
                <h2 style={{ fontFamily:'var(--font-heading)',fontSize:26,fontWeight:400,color:'#fff',lineHeight:1.2 }}>You've seen everything!</h2>
                <p style={{ fontSize:14,color:'rgba(255,255,255,0.4)',lineHeight:1.6 }}>{wishlist.length>0?`${wishlist.length} saree${wishlist.length!==1?'s':''} shortlisted. Ready to book a call?`:'Browse again to save your favourites.'}</p>
                {wishlist.length > 0 && <button onClick={() => setShowWL(true)} style={{ padding:'13px 0',width:'100%',background:'linear-gradient(135deg,#8B1A2B,#6B1220)',border:'none',borderRadius:13,color:'#fff',fontSize:15,fontWeight:500,cursor:'pointer',boxShadow:'0 4px 18px rgba(139,26,43,0.4)' }}>View shortlist & Book call</button>}
                <button onClick={() => setIdx(0)} style={{ padding:'11px 0',width:'100%',background:'transparent',border:'1px solid rgba(255,255,255,0.12)',borderRadius:13,color:'rgba(255,255,255,0.4)',fontSize:13,cursor:'pointer' }}>Browse again</button>
              </div>
            ) : current ? (
              <Card key={current.id} product={current} onSwipe={swipe} onTap={() => setDetail(current)} />
            ) : null}
          </div>

          {/* Progress dots */}
          {!isDone && (
            <div style={{ flexShrink:0,display:'flex',justifyContent:'center',gap:5,padding:'7px 0' }}>
              {products.slice(Math.max(0,idx-2),idx+5).map((_,i) => {
                const a=Math.max(0,idx-2)+i; const c=a===idx
                return <div key={a} style={{ height:4,borderRadius:2,width:c?16:4,background:c?'#C9A84C':'rgba(255,255,255,0.18)',transition:'width 0.25s,background 0.25s' }}/>
              })}
            </div>
          )}

          {/* Buttons */}
          {!isDone && (
            <div style={{ flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',gap:18,padding:'12px 0 30px' }}>
              <button onClick={() => btnSwipe(-1)} aria-label="Skip" style={{ width:56,height:56,borderRadius:'50%',background:'rgba(255,255,255,0.09)',backdropFilter:'blur(10px)',border:'1.5px solid rgba(255,255,255,0.18)',color:'rgba(255,255,255,0.65)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <button onClick={() => btnSwipe(1)} aria-label="Love it" style={{ width:70,height:70,borderRadius:'50%',background:'linear-gradient(145deg,#8B1A2B,#6B1220)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 5px 22px rgba(139,26,43,0.55)' }}>
                <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
              <button onClick={() => current && setDetail(current)} aria-label="Details" style={{ width:56,height:56,borderRadius:'50%',background:'rgba(255,255,255,0.07)',backdropFilter:'blur(10px)',border:'1.5px solid rgba(255,255,255,0.13)',color:'rgba(255,255,255,0.55)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </button>
            </div>
          )}

          {/* Undo skip */}
          {undoSkip && (
            <div style={{ position:'absolute',bottom:110,left:16,right:16,zIndex:50,background:'rgba(20,14,6,0.95)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'11px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10 }}>
              <span style={{ fontSize:12,color:'rgba(255,255,255,0.6)' }}>Skipped <b style={{ color:'#fff' }}>{undoSkip.p.name}</b></span>
              <button onClick={() => { clearTimeout(undoSkip.t); setIdx(i=>Math.max(0,i-1)); setUndoSkip(null) }} style={{ background:'rgba(201,168,76,0.18)',border:'1px solid rgba(201,168,76,0.35)',borderRadius:7,padding:'4px 12px',color:'#C9A84C',fontSize:12,fontWeight:500,cursor:'pointer',flexShrink:0 }}>Undo</button>
            </div>
          )}

          {/* Undo remove */}
          {undoRm && (
            <div style={{ position:'absolute',bottom:110,left:16,right:16,zIndex:50,background:'rgba(20,14,6,0.95)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'11px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10 }}>
              <span style={{ fontSize:12,color:'rgba(255,255,255,0.6)' }}>Removed from shortlist</span>
              <button onClick={() => { clearTimeout(undoRm.t); setWishlist(prev=>prev.find(x=>x.id===undoRm.it.id)?prev:[...prev,undoRm.it]); setUndoRm(null) }} style={{ background:'rgba(201,168,76,0.18)',border:'1px solid rgba(201,168,76,0.35)',borderRadius:7,padding:'4px 12px',color:'#C9A84C',fontSize:12,fontWeight:500,cursor:'pointer',flexShrink:0 }}>Undo</button>
            </div>
          )}
        </div>
      </div>

      {detail && <DetailSheet product={detail} isLoved={loved(detail.id)} onClose={() => setDetail(null)} onLove={() => { loved(detail.id)?remove(detail.id):save(detail) }} />}
      {showWL && <WishlistScreen items={wishlist} onClose={() => setShowWL(false)} onRemove={remove} onBookCall={() => window.open(waUrl(wishlist),'_blank','noopener')} />}
    </>
  )
}
