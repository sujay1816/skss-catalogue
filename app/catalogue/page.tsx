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

type SiteConfig = { brand_name?: string; brand_subtitle?: string; logo_url?: string; whatsapp_number?: string }
type Occasion   = { id: string; name: string; slug: string; image_url: string }
type FlashSale  = { id: string; title: string; ends_at: string; saleMap: Record<string, number> } | null

function buildWA(items: WishlistItem[], waNum: string, customerName?: string) {
  const total = items.reduce((s, it) => s + (it.salePrice ?? it.originalPrice), 0)
  const list  = items.map((it, i) => `${i + 1}. ${it.name} — ${fmt(it.salePrice ?? it.originalPrice)}`).join('\n')
  const greeting = customerName ? `Hi, I'm ${customerName}.` : 'Hi!'
  return `https://wa.me/${waNum}?text=${encodeURIComponent(`${greeting} I browsed your saree catalogue and shortlisted:\n\n${list}\n\nTotal: ${fmt(total)}\n\nCan we schedule a video call to see these in detail?`)}`
}

// ── Device ID — stable anonymous identifier stored in localStorage ────────────
function getDeviceId(): string {
  try {
    let id = localStorage.getItem('skss_device_id')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('skss_device_id', id) }
    return id
  } catch { return 'unknown' }
}

// share shortlist via URL
function buildShareUrl(items: WishlistItem[]) {
  const ids = items.map(it => it.id).join(',')
  return `${window.location.origin}/catalogue?saved=${encodeURIComponent(ids)}`
}

// ─── PhoneCaptureSheet ────────────────────────────────────────────────────────
// Shown once before the customer books a call. Collects name + phone.
// After submission, stores the session in Supabase catalogue_sessions and
// saves name to localStorage so future sessions skip this step.
function PhoneCaptureSheet({ wishlist, waNum, onClose }: {
  wishlist: WishlistItem[]
  waNum: string
  onClose: () => void
}) {
  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const nameRef  = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 300) }, [])

  const handleSubmit = async () => {
    const n = name.trim()
    const p = phone.replace(/\D/g, '')
    if (!n) { setError('Please enter your name'); return }
    if (p.length < 10) { setError('Please enter a valid 10-digit phone number'); return }
    setError(''); setLoading(true)

    try {
      // Save to Supabase in background — don't block the WhatsApp open
      fetch('/api/catalogue-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, phone: p, wishlist, device_id: getDeviceId() }),
      }).catch(() => {}) // fire and forget — never block the user

      // Persist name so we skip this form next time
      // Store phone with country code so WhatsApp follow-up links work
      const storedPhone = p.startsWith('91') ? p : `91${p}`
      localStorage.setItem('skss_customer_name', n)
      localStorage.setItem('skss_customer_phone', storedPhone)

      // Open WhatsApp
      window.open(buildWA(wishlist, waNum, n), '_blank', 'noopener,noreferrer')
      onClose()
    } catch {
      setLoading(false)
      setError('Something went wrong. Please try again.')
    }
  }

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSubmit() }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}/>
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, zIndex: 501,
        background: '#0f0a06', borderRadius: '20px 20px 0 0',
        padding: '0 0 40px',
        boxShadow: '0 -16px 60px rgba(0,0,0,0.95)',
        animation: 'sheetUp 0.35s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}/>
        </div>

        <div style={{ padding: '16px 24px 0' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 400, color: '#fff', lineHeight: 1.2 }}>Almost there!</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 1.5 }}>
                Just your name and number so we know who to expect on WhatsApp.
              </p>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Wishlist preview — shows what they're booking about */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px', marginBottom: 20 }}>
            <p style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(201,168,76,0.7)', marginBottom: 6, fontWeight: 600 }}>Your shortlist</p>
            {wishlist.slice(0, 3).map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(201,168,76,0.5)', flexShrink: 0 }}/>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                <span style={{ fontSize: 12, color: 'rgba(201,168,76,0.8)', flexShrink: 0 }}>{fmt(it.salePrice ?? it.originalPrice)}</span>
              </div>
            ))}
            {wishlist.length > 3 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>+{wishlist.length - 3} more sarees</p>}
          </div>

          {/* Name field */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 600, display: 'block', marginBottom: 7 }}>Your name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={handleKey}
              placeholder="e.g. Priya Sharma"
              autoComplete="name"
              style={{
                width: '100%', height: 50, borderRadius: 12, padding: '0 16px',
                background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 15, outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.6)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          {/* Phone field */}
          <div style={{ marginBottom: error ? 10 : 20 }}>
            <label style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 600, display: 'block', marginBottom: 7 }}>WhatsApp number</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>+91</span>
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError('') }}
                onKeyDown={handleKey}
                placeholder="98765 43210"
                autoComplete="tel"
                inputMode="numeric"
                maxLength={15}
                style={{
                  width: '100%', height: 50, borderRadius: 12, padding: '0 16px 0 52px',
                  background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 15, outline: 'none',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
          </div>

          {/* Error */}
          {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 14 }}>{error}</p>}

          {/* Privacy note */}
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', marginBottom: 16, lineHeight: 1.5 }}>
            We use this only to contact you about your shortlist. We never share your details.
          </p>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', height: 54, borderRadius: 14,
              background: loading ? 'rgba(37,211,102,0.5)' : '#25D366',
              border: 'none', color: '#fff',
              fontSize: 16, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 4px 20px rgba(37,211,102,0.3)',
              transition: 'background 0.2s',
            }}
          >
            {loading ? (
              <span style={{ opacity: 0.7 }}>Opening WhatsApp…</span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Open WhatsApp to Book
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

const BUDGETS = [
  { label: 'All',        min: 0,     max: Infinity },
  { label: 'Under ₹10K', min: 0,     max: 9999     },
  { label: '₹10K–₹25K', min: 10000, max: 24999     },
  { label: 'Above ₹25K', min: 25000, max: Infinity  },
]

// ─── Countdown ────────────────────────────────────────────────────────────────
function Countdown({ endsAt }: { endsAt: string }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setLabel('Ended'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt])
  return <>{label}</>
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ config }: { config: SiteConfig }) {
  const name     = config.brand_name     || 'SKSS'
  const subtitle = config.brand_subtitle || 'Silk Sarees'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      {config.logo_url ? (
        <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: 'rgba(139,26,43,0.15)', border: '1px solid rgba(201,168,76,0.3)', flexShrink: 0 }}>
          <img src={config.logo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      ) : (
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

// ─── Occasion Onboarding ──────────────────────────────────────────────────────
function OccasionScreen({ occasions, onSelect }: {
  occasions: Occasion[]
  onSelect: (slug: string | null) => void
}) {
  const fallbackOccasions = [
    { id: '1', name: 'Wedding',     slug: 'wedding',   image_url: '' },
    { id: '2', name: 'Festival',    slug: 'festival',  image_url: '' },
    { id: '3', name: 'Daily Wear',  slug: 'daily-wear',image_url: '' },
    { id: '4', name: 'Gift',        slug: 'gift',      image_url: '' },
  ]
  const items = occasions.length > 0 ? occasions : fallbackOccasions

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#080502', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      {/* Subtle top decoration */}
      <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(201,168,76,0.4)', marginBottom: 32 }}/>

      <p style={{ fontFamily: 'var(--font-heading)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(201,168,76,0.7)', marginBottom: 12 }}>Welcome</p>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 400, color: '#fff', textAlign: 'center', lineHeight: 1.2, marginBottom: 8 }}>What are you<br/>shopping for?</h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 32, textAlign: 'center' }}>We'll show you the most relevant sarees first</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 360 }}>
        {items.slice(0, 4).map(occ => (
          <button
            key={occ.id}
            onClick={() => onSelect(occ.slug)}
            style={{
              borderRadius: 16, overflow: 'hidden', position: 'relative',
              height: 130, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)',
              background: '#1a1008', padding: 0,
              transition: 'transform 0.15s, border-color 0.15s',
            }}
          >
            {occ.image_url ? (
              <img src={occ.image_url} alt={occ.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
            ) : (
              <div style={{ width: '100%', height: '100%', background: `linear-gradient(145deg, rgba(139,26,43,0.3), rgba(201,168,76,0.1))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                {{ wedding: '💍', festival: '🪔', 'daily-wear': '🌸', 'daily wear': '🌸', gift: '🎁', reception: '👑', casual: '🌺' }[occ.slug] || '🥻'}
              </div>
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 60%)'}}/>
            <p style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 400, color: '#fff', letterSpacing: 0.5 }}>{occ.name}</p>
          </button>
        ))}
      </div>

      <button
        onClick={() => onSelect(null)}
        style={{ marginTop: 20, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', padding: '8px 0' }}
      >Browse all sarees →</button>
    </div>
  )
}

// ─── TinderCard ───────────────────────────────────────────────────────────────
function TinderCard({ product, stackIndex, isTop, dragProgress, onSwipe, onTap, onDragProgress, cardW, cardH, flashSale }: {
  product: CatalogueProduct; stackIndex: number; isTop: boolean; dragProgress: number
  onSwipe: (dir: 1 | -1) => void; onTap: () => void; onDragProgress: (p: number) => void
  cardW: number; cardH: number; flashSale: FlashSale
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
  const flashPrice = flashSale?.saleMap[product.id]
  const flashDisc  = flashPrice ? Math.round(((product.originalPrice - flashPrice) / product.originalPrice) * 100) : null

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
        ? <Image src={img} alt={product.name} fill
            style={{ objectFit: 'cover', objectPosition: 'top', pointerEvents: 'none' }}
            sizes="(max-width:480px) calc(100vw - 32px), 448px"
            priority={stackIndex <= 1} draggable={false}/>
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, background: 'linear-gradient(145deg,#2D1B1B,#1A0D0D)' }}>🥻</div>
      }
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.05) 65%, transparent 100%)', pointerEvents: 'none' }}/>

      <div className="s-like" style={{ position: 'absolute', top: 36, left: 24, opacity: 0, pointerEvents: 'none', border: '3px solid #4ade80', borderRadius: 6, padding: '6px 18px', color: '#4ade80', fontSize: 22, fontWeight: 800, letterSpacing: 3, transform: 'rotate(-15deg)' }}>LIKED</div>
      <div className="s-nope" style={{ position: 'absolute', top: 36, right: 24, opacity: 0, pointerEvents: 'none', border: '3px solid #f87171', borderRadius: 6, padding: '6px 18px', color: '#f87171', fontSize: 22, fontWeight: 800, letterSpacing: 3, transform: 'rotate(15deg)' }}>NOPE</div>

      {/* Badges */}
      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        {/* Flash sale countdown — most prominent */}
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
          {product.variants.length > 0 && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {product.variants.slice(0, 5).map(v => <div key={v.id} style={{ width: 14, height: 14, borderRadius: '50%', background: v.colourHex || '#8B1A2B', border: '2px solid rgba(255,255,255,0.5)', boxShadow: '0 1px 4px rgba(0,0,0,0.6)' }}/>)}
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
function DetailSheet({ product, isLoved, onClose, onLove, waNum, flashSale, onBookCall }: {
  product: CatalogueProduct; isLoved: boolean; onClose: () => void; onLove: () => void; waNum: string; flashSale: FlashSale; onBookCall: () => void
}) {
  const [activeImg, setActiveImg] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const swipeRef = useRef({ on: false, y0: 0 })

  const images = [...product.images].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : a.order - b.order))
  const badge  = disc(product.originalPrice, product.salePrice)
  const flashPrice = flashSale?.saleMap[product.id]
  const rows   = ([
    ['Fabric', product.fabric], ['Weave', product.weaveType],
    ['Origin', product.originRegion], ['Length', product.length ? `${product.length}m` : ''],
    ['Blouse', product.blouseIncluded ? 'Included' : ''], ['Care', product.careInstructions],
  ] as [string,string][]).filter(([,v]) => v)
  const lowStock = product.variants.filter(v => v.stock > 0 && v.stock <= 3)
  const displayPrice = flashPrice ?? priceOf(product)

  // Swipe-down to close
  const sheetDown = (e: React.PointerEvent) => {
    swipeRef.current = { on: true, y0: e.clientY }
    sheetRef.current?.setPointerCapture(e.pointerId)
  }
  const sheetMove = (e: React.PointerEvent) => {
    if (!swipeRef.current.on || !sheetRef.current) return
    const dy = e.clientY - swipeRef.current.y0
    if (dy > 0) sheetRef.current.style.transform = `translateX(-50%) translateY(${dy}px)`
  }
  const sheetUp = (e: React.PointerEvent) => {
    if (!swipeRef.current.on) return
    swipeRef.current.on = false
    const dy = e.clientY - swipeRef.current.y0
    if (!sheetRef.current) return
    if (dy > 80) { onClose(); return }
    sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)'
    sheetRef.current.style.transform  = 'translateX(-50%) translateY(0)'
    setTimeout(() => { if (sheetRef.current) sheetRef.current.style.transition = '' }, 350)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}/>
      <div ref={sheetRef}
        style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, maxHeight: '92dvh', zIndex: 301, background: '#0f0a06', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 -16px 60px rgba(0,0,0,0.95)', animation: 'sheetUp 0.38s cubic-bezier(0.32,0.72,0,1)' }}>

        {/* Handle — swipe down here to close */}
        <div
          onPointerDown={sheetDown} onPointerMove={sheetMove} onPointerUp={sheetUp}
          style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 8px', flexShrink: 0, cursor: 'grab', touchAction: 'none' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }}/>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Main image — objectPosition:top to show face/drape */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#1a1008' }}>
            {images[activeImg]?.url
              ? <Image src={images[activeImg].url} alt={product.name} fill style={{ objectFit: 'cover', objectPosition: 'top' }} sizes="480px" priority/>
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>🥻</div>
            }
            {/* Flash sale badge */}
            {flashPrice && flashSale && (
              <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(220,38,38,0.92)', color: '#fff', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⏱</span>
                <span>Ends in <Countdown endsAt={flashSale.ends_at}/></span>
              </div>
            )}
            {!flashPrice && badge && <span style={{ position: 'absolute', top: 14, left: 14, background: '#DC2626', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700 }}>{badge}</span>}
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
                  <Image src={img.url} alt="" fill style={{ objectFit: 'cover', objectPosition: 'top' }} sizes="56px"/>
                </button>
              ))}
            </div>
          )}

          {/* Video — shown above text if available */}
          {product.videoUrl && (
            <div style={{ padding: '12px 16px 0' }}>
              <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '16/9', position: 'relative' }}>
                <video
                  src={product.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, textAlign: 'center', letterSpacing: 0.5 }}>Drape video</p>
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
              <span style={{ fontSize: 30, fontWeight: 700, color: flashPrice ? '#f87171' : '#C9A84C' }}>{fmt(displayPrice)}</span>
              {(flashPrice || product.salePrice) && <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through' }}>{fmt(product.originalPrice)}</span>}
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>+GST</span>
            </div>

            {lowStock.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '8px 12px', marginBottom: 16 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: '#f87171' }}>Only {lowStock[0].stock} left in {lowStock[0].colour}{lowStock.length > 1 ? ` and ${lowStock.length - 1} more` : ''}</span>
              </div>
            )}

            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 20 }}/>
            {product.description && <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}>{product.description}</p>}

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
                      {v.stock > 0 && v.stock <= 3 && <span style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>· {v.stock} left</span>}
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

// ─── Wishlist Screen — enhanced ───────────────────────────────────────────────
function WishlistScreen({ items, onClose, onRemove, onCall, waNum }: {
  items: WishlistItem[]; onClose: () => void; onRemove: (id: string) => void; onCall: () => void; waNum: string
}) {
  const [copied, setCopied] = useState(false)
  const total = items.reduce((s, it) => s + (it.salePrice ?? it.originalPrice), 0)

  const handleShare = () => {
    const url = buildShareUrl(items)
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => {
      // Fallback for browsers without clipboard API
      window.prompt('Copy your shortlist link:', url)
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#080502', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '52px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: items.length > 0 ? 14 : 0 }}>
          <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 400, color: '#fff' }}>Your Shortlist</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{items.length} {items.length === 1 ? 'saree' : 'sarees'} saved{items.length > 0 ? ` · ${fmt(total)}` : ''}</p>
          </div>
          {/* Share button */}
          {items.length > 0 && (
            <button onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: 6, background: copied ? 'rgba(37,211,102,0.15)' : 'rgba(255,255,255,0.07)', border: copied ? '1px solid rgba(37,211,102,0.4)' : '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '7px 14px', color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              {copied ? 'Copied!' : 'Share'}
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(139,26,43,0.12)', border: '1px solid rgba(139,26,43,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🥻</div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 400, color: '#fff', marginBottom: 8 }}>Nothing saved yet</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>Swipe right or tap the heart on<br/>any saree to save it here</p>
          </div>
          <button onClick={onClose} style={{ marginTop: 8, padding: '12px 28px', background: 'rgba(139,26,43,0.2)', border: '1px solid rgba(139,26,43,0.4)', borderRadius: 12, color: '#F8A3AF', fontSize: 14, cursor: 'pointer' }}>Start browsing</button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {/* Grid of saved sarees */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
              {items.map(it => (
                <div key={it.id} style={{ borderRadius: 16, overflow: 'hidden', background: '#1a1008', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
                  {/* Image */}
                  <div style={{ aspectRatio: '3/4', position: 'relative', overflow: 'hidden' }}>
                    {it.image
                      ? <Image src={it.image} alt={it.name} fill style={{ objectFit: 'cover', objectPosition: 'top' }} sizes="(max-width:480px) 50vw, 220px"/>
                      : <div style={{ width: '100%', height: '100%', background: '#2D1B1B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🥻</div>
                    }
                    {/* Gradient overlay at bottom */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', pointerEvents: 'none' }}/>
                    {/* Price on image */}
                    <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>{fmt(it.salePrice ?? it.originalPrice)}</p>
                    </div>
                    {/* Remove button */}
                    <button onClick={() => onRemove(it.id)} style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  {/* Info below image */}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3, marginBottom: 3 }}>{it.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{it.fabric || it.categoryName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer CTA */}
          <div style={{ padding: '16px 16px 36px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,5,2,0.98)', flexShrink: 0 }}>
            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{items.length} saree{items.length !== 1 ? 's' : ''} shortlisted</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>Share this list with family before booking</p>
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{fmt(total)}</p>
            </div>

            {/* WhatsApp CTA — primary */}
            <button onClick={onCall} style={{ width: '100%', height: 54, borderRadius: 14, background: '#25D366', border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 20px rgba(37,211,102,0.3)', marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Book a Video Call
            </button>

            {/* Secondary row: Share + Keep browsing */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleShare} style={{ flex: 1, height: 42, borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: copied ? '#4ade80' : 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                {copied ? 'Link copied!' : 'Share list'}
              </button>
              <button onClick={onClose} style={{ flex: 1, height: 42, borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer' }}>Keep browsing</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CataloguePage() {
  const [allProducts,  setAllProducts]  = useState<CatalogueProduct[]>([])
  const [config,       setConfig]       = useState<SiteConfig>({})
  const [occasions,    setOccasions]    = useState<Occasion[]>([])
  const [flashSale,    setFlashSale]    = useState<FlashSale>(null)
  const [loading,      setLoading]      = useState(true)
  const [showOnboard,  setShowOnboard]  = useState(() => {
    try { return !localStorage.getItem('skss_onboarded') } catch { return true }
  })
  const [idx,          setIdx]          = useState(0)
  const [wishlist,     setWishlist]     = useState<WishlistItem[]>([])
  const [detail,       setDetail]       = useState<CatalogueProduct | null>(null)
  const [showWL,       setShowWL]       = useState(false)
  const [undoSkip,     setUndoSkip]     = useState<{ p: CatalogueProduct; t: ReturnType<typeof setTimeout> } | null>(null)
  const [undoRm,       setUndoRm]       = useState<{ it: WishlistItem; t: ReturnType<typeof setTimeout> } | null>(null)
  const [dragProg,     setDragProg]     = useState(0)
  const [showCapture,  setShowCapture]  = useState(false)
  const [savedToast,   setSavedToast]   = useState('')  // product name shown briefly after right swipe
  const [catFilter,    setCatFilter]    = useState('All')
  const [budgetIdx,    setBudgetIdx]    = useState(0)
  const [occasionFilter, setOccasionFilter] = useState<string | null>(null)

  // WhatsApp number: env var first (reliable), config as override if present
  const waNum = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || config.whatsapp_number || ''

  // Derived data
  const categories   = ['All', ...Array.from(new Set(allProducts.map(p => p.categoryName).filter(Boolean)))]
  const products = allProducts.filter(p => {
    const catOk    = catFilter === 'All' || p.categoryName === catFilter
    const b        = BUDGETS[budgetIdx]
    const price    = priceOf(p)
    const budgetOk = price >= b.min && price <= b.max
    const occOk    = !occasionFilter || (p.occasion || []).includes(occasionFilter)
    return catOk && budgetOk && occOk
  })

  useEffect(() => { setIdx(0) }, [catFilter, budgetIdx, occasionFilter])

  // Card dimensions
  const [dims, setDims] = useState({ w: 340, h: 520 })
  useEffect(() => {
    const calc = () => {
      const w = Math.min(window.innerWidth, 480) - 32
      // More generous height — subtract less chrome
      const h = Math.min(window.innerHeight - 280, w * 1.48)
      setDims({ w: Math.round(w), h: Math.round(Math.max(h, 380)) })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/products?limit=80').then(r => r.json()),
      fetch('/api/config').then(r => r.json()).catch(() => ({})),
      fetch('/api/occasions').then(r => r.json()).catch(() => []),
      fetch('/api/flash-sales').then(r => r.json()).catch(() => null),
    ]).then(([pd, cfg, occ, flash]) => {
      setAllProducts(pd.products || [])
      setConfig(cfg || {})
      setOccasions(occ || [])
      setFlashSale(flash || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Restore saved wishlist + shared list from URL, and pre-fill customer info
  useEffect(() => {
    try { const s = localStorage.getItem('skss_wl'); if (s) setWishlist(JSON.parse(s)) } catch {}
    // Check for shared list in URL
    const params = new URLSearchParams(window.location.search)
    const saved  = params.get('saved')
    if (saved) {
      // Will be populated once products load — handled below
      ;(window as any)._pendingSaved = saved.split(',')
    }
  }, [])
  useEffect(() => {
    if ((window as any)._pendingSaved && allProducts.length > 0) {
      const ids      = (window as any)._pendingSaved as string[]
      const matching = allProducts.filter(p => ids.includes(p.id))
      if (matching.length > 0) setWishlist(prev => {
        const existingIds = new Set(prev.map(it => it.id))
        const newItems = matching.filter(p => !existingIds.has(p.id)).map(toWL)
        return [...prev, ...newItems]
      })
      delete (window as any)._pendingSaved
    }
  }, [allProducts])
  useEffect(() => { try { localStorage.setItem('skss_wl', JSON.stringify(wishlist)) } catch {} }, [wishlist])

  // Sync wishlist back to Supabase for returning customers (debounced, background)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (wishlist.length === 0) return
    const name   = typeof window !== 'undefined' ? localStorage.getItem('skss_customer_name') : null
    const phone  = typeof window !== 'undefined' ? localStorage.getItem('skss_customer_phone') : null
    if (!name || !phone) return // only sync if already captured
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      fetch('/api/catalogue-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, wishlist, device_id: getDeviceId() }),
      }).catch(() => {})
    }, 3000) // 3s debounce — don't hammer the API on every swipe
  }, [wishlist])

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
    else { if (undoSkip) clearTimeout(undoSkip.t); setUndoSkip({ p, t: setTimeout(() => setUndoSkip(null), UNDO_MS) }) }
    // Haptic feedback on mobile
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
    // Save confirmation toast
    if (dir === 1 && p) { setSavedToast(p.name); setTimeout(() => setSavedToast(''), 1800) }
    setDragProg(0); setIdx(i => i + 1)
  }, [products, idx, save, undoSkip])

  // Central booking handler — always goes through phone capture if not yet captured
  const handleBookCall = useCallback(() => {
    if (wishlist.length === 0) return // nothing to book — buttons that call this should be disabled
    const savedName = localStorage.getItem('skss_customer_name')
    if (savedName) {
      // Already captured — open WhatsApp directly with their name
      window.open(buildWA(wishlist, waNum, savedName), '_blank', 'noopener,noreferrer')
    } else {
      // First time — show phone capture sheet
      setShowCapture(true)
    }
  }, [wishlist, waNum])

  const btnSwipe = useCallback((dir: 1 | -1) => {
    const el = document.querySelector<HTMLElement>('[data-top-card]')
    if (el) {
      el.style.transition = 'transform 0.35s ease, opacity 0.3s ease'
      el.style.transform  = `translate(${dir * (dims.w + 300)}px, 0) rotate(${dir * 28}deg)`
      el.style.opacity    = '0'
      setTimeout(() => swipe(dir), 320)
    } else swipe(dir)
  }, [dims.w, swipe])

  // Keyboard navigation — useful for desktop demos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (detail || showWL || showCapture || showOnboard) return
      if (e.key === 'ArrowRight') btnSwipe(1)
      else if (e.key === 'ArrowLeft') btnSwipe(-1)
      else if (e.key === 'Enter' && products[idx]) setDetail(products[idx])
      else if (e.key === 'Escape') { setDetail(null); setShowWL(false) }
      else if ((e.key === 'z' || e.key === 'Z') && undoSkip) {
        clearTimeout(undoSkip.t); setIdx(i => Math.max(0, i - 1)); setUndoSkip(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [btnSwipe, detail, showWL, showCapture, showOnboard, products, idx, undoSkip])

  const stack  = products.slice(idx, idx + 3)
  const isDone = !loading && idx >= products.length

  // Handle occasion onboarding selection
  const handleOccasionSelect = (slug: string | null) => {
    if (slug) {
      // Match the occasion slug to a product occasion tag name
      const matchingOcc = occasions.find(o => o.slug === slug)
      if (matchingOcc) {
        // Try to filter by the occasion name that products use
        const occName = matchingOcc.name
        // Try exact match first, then case-insensitive fallback
        const hasExact = allProducts.some(p => (p.occasion || []).includes(occName))
        if (hasExact) {
          setOccasionFilter(occName)
        } else {
          const lc = occName.toLowerCase()
          const allTags = allProducts.flatMap(p => p.occasion || [])
          const match = allTags.find(t => t.toLowerCase() === lc || t.toLowerCase().includes(lc))
          if (match) setOccasionFilter(match)
          // If still no match, just clear the filter — don't show 0 results
        }
      }
    }
    try { localStorage.setItem('skss_onboarded', '1') } catch {}
    setShowOnboard(false)
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#080502', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      {/* Show logo image if already loaded, otherwise just the mark — never show hardcoded text */}
      {config.logo_url ? (
        <img src={config.logo_url} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain', opacity: 0.9 }} />
      ) : (
        <svg width="52" height="52" viewBox="0 0 34 34" fill="none">
          <circle cx="17" cy="17" r="15" fill="rgba(139,26,43,0.2)" stroke="rgba(201,168,76,0.5)" strokeWidth="1"/>
          <path d="M17 7C21 7 25 10 25 15C25 20 21 23 17 25C17 25 13 23 11 20C9 17 10 12 13 10C14.5 8.5 15.8 7 17 7Z" fill="rgba(139,26,43,0.7)" stroke="#C9A84C" strokeWidth="0.8"/>
          <circle cx="17" cy="11" r="2" fill="#C9A84C"/>
          <path d="M15 19C15 19 16 21 17 21C18 21 19 20 19 19" stroke="rgba(201,168,76,0.75)" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      )}
      {/* Only show brand name once config has loaded — avoids the SKSS fallback flash */}
      {config.brand_name ? (
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 400, color: 'rgba(255,255,255,0.7)', letterSpacing: 2 }}>{config.brand_name}</p>
      ) : (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(201,168,76,0.5)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}/>
          ))}
        </div>
      )}
    </div>
  )

  // Occasion onboarding — shown on first visit
  if (showOnboard) {
    return <OccasionScreen occasions={occasions} onSelect={handleOccasionSelect}/>
  }

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

          {/* Combined filter row: category + occasion + budget */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 7, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
            {/* Category chips */}
            {categories.slice(0, 5).map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={{ flexShrink: 0, borderRadius: 20, padding: '5px 13px', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', border: catFilter === cat ? '1.5px solid #C9A84C' : '1px solid rgba(255,255,255,0.12)', background: catFilter === cat ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)', color: catFilter === cat ? '#C9A84C' : 'rgba(255,255,255,0.45)', transition: 'all 0.15s' }}>{cat}</button>
            ))}
            {/* Divider */}
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }}/>
            {/* Budget chips */}
            {BUDGETS.slice(1).map((b, i) => (
              <button key={b.label} onClick={() => setBudgetIdx(budgetIdx === i + 1 ? 0 : i + 1)} style={{ flexShrink: 0, borderRadius: 20, padding: '5px 13px', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', border: budgetIdx === i + 1 ? '1.5px solid rgba(139,26,43,0.7)' : '1px solid rgba(255,255,255,0.12)', background: budgetIdx === i + 1 ? 'rgba(139,26,43,0.2)' : 'rgba(255,255,255,0.04)', color: budgetIdx === i + 1 ? '#F8A3AF' : 'rgba(255,255,255,0.45)', transition: 'all 0.15s' }}>{b.label}</button>
            ))}
            {/* Active filter count */}
            {(catFilter !== 'All' || budgetIdx > 0 || occasionFilter) && (
              <button onClick={() => { setCatFilter('All'); setBudgetIdx(0); setOccasionFilter(null) }} style={{ flexShrink: 0, borderRadius: 20, padding: '5px 10px', fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {products.length}
              </button>
            )}
          </div>

          {/* Card stack — no paddingTop, removed 4px that clipped images */}
          <div style={{ flexShrink: 0, height: dims.h + 28, overflow: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            {isDone ? (
              <div style={{ width: dims.w, height: dims.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 56 }}>🥻</div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 400, color: '#fff' }}>
                  {products.length === 0 ? 'No sarees match your filters' : "You've seen everything!"}
                </h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  {products.length === 0 ? 'Try removing a filter.' : wishlist.length > 0 ? `${wishlist.length} saree${wishlist.length !== 1 ? 's' : ''} shortlisted.` : 'Browse again to save favourites.'}
                </p>
                {products.length === 0 && <button onClick={() => { setCatFilter('All'); setBudgetIdx(0); setOccasionFilter(null) }} style={{ padding: '12px 0', width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 13, color: '#fff', fontSize: 14, cursor: 'pointer' }}>Clear filters</button>}
                {wishlist.length > 0 && <button onClick={() => setShowWL(true)} style={{ padding: '13px 0', width: '100%', background: 'linear-gradient(135deg,#8B1A2B,#6B1220)', border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>View shortlist & Book call</button>}
                {products.length > 0 && <button onClick={() => setIdx(0)} style={{ padding: '11px 0', width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>Browse again</button>}
              </div>
            ) : (
              [...stack].reverse().map((p, ri) => {
                const si = stack.length - 1 - ri
                return <TinderCard key={p.id} product={p} stackIndex={si} isTop={si === 0} dragProgress={dragProg} onSwipe={swipe} onTap={() => setDetail(p)} onDragProgress={si === 0 ? setDragProg : () => {}} cardW={dims.w} cardH={dims.h} flashSale={flashSale}/>
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

          {/* Floating WhatsApp pill — total price included */}
          {wishlist.length >= 2 && !showWL && !detail && waNum && (
            <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 40, animation: 'floatIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <button onClick={handleBookCall}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#25D366', border: 'none', borderRadius: 28, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(37,211,102,0.45)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Book a call · {wishlist.length} saved · {fmt(wishlist.reduce((s,it) => s+(it.salePrice??it.originalPrice),0))}
              </button>
            </div>
          )}

          {/* Saved toast — brief confirmation on right swipe */}
          {savedToast && (
            <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'none', animation: 'floatIn 0.25s ease' }}>
              <div style={{ background: 'rgba(139,26,43,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#F87171"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Saved to shortlist</span>
              </div>
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

      <style>{`
        @keyframes sheetUp{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}
        @keyframes floatIn{from{opacity:0;transform:translateX(-50%) translateY(12px) scale(0.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
        @keyframes pulse{0%,80%,100%{opacity:0.3;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}
      `}</style>

      {showCapture && <PhoneCaptureSheet wishlist={wishlist} waNum={waNum} onClose={() => setShowCapture(false)}/> }
      {detail && <DetailSheet product={detail} isLoved={loved(detail.id)} onClose={() => setDetail(null)} onLove={() => loved(detail.id) ? remove(detail.id) : save(detail)} waNum={waNum} flashSale={flashSale} onBookCall={handleBookCall}/>}
      {showWL  && <WishlistScreen items={wishlist} onClose={() => setShowWL(false)} onRemove={remove} onCall={handleBookCall} waNum={waNum}/>}
    </>
  )
}
