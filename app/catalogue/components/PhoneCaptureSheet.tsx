'use client'
import React, { useState, useEffect, useRef } from 'react'
import type { WishlistItem } from '@/types'
import type { SiteConfig } from '../types'

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN')

// FIX-3: d parameter now used to generate a precise readable label with day name
function buildSlots(): { label: string; value: string }[] {
  const now   = new Date()
  const hour  = now.getHours()
  const slots: { label: string; value: string }[] = []

  const addSlot = (d: Date, time: string) => {
    const isToday    = d.toDateString() === now.toDateString()
    const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString()
    const dayName    = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'long' })
    const label      = `${dayName} ${time}`
    slots.push({ label, value: label })
  }

  // Today evening — only show if it's before 7 PM
  if (hour < 19) {
    const todayEvening = new Date(now)
    todayEvening.setHours(18, 0, 0, 0)
    if (todayEvening.getTime() > now.getTime()) addSlot(todayEvening, 'evening (6–8 PM)')
  }

  // Tomorrow morning
  const tmrMorning = new Date(now)
  tmrMorning.setDate(tmrMorning.getDate() + 1)
  tmrMorning.setHours(10, 0, 0, 0)
  addSlot(tmrMorning, 'morning (10–12 PM)')

  // Tomorrow evening
  const tmrEvening = new Date(now)
  tmrEvening.setDate(tmrEvening.getDate() + 1)
  tmrEvening.setHours(18, 0, 0, 0)
  addSlot(tmrEvening, 'evening (6–8 PM)')

  // Day after morning — fallback if we have fewer than 3 slots
  if (slots.length < 3) {
    const dayAfter = new Date(now)
    dayAfter.setDate(dayAfter.getDate() + 2)
    dayAfter.setHours(10, 0, 0, 0)
    addSlot(dayAfter, 'morning (10–12 PM)')
  }

  return slots.slice(0, 3)
}

export function PhoneCaptureSheet({
  wishlist, waNum, config, onClose, occasion, onSubmit,
}: {
  wishlist: WishlistItem[]
  waNum: string
  config: SiteConfig
  onClose: () => void
  occasion?: string | null
  onSubmit: (name: string, phone: string, slot?: string) => void  // FIX-3: slot param
}) {
  const [name,    setName]    = useState(() => { try { return localStorage.getItem('skss_customer_name') || '' } catch { return '' } })
  const [phone,   setPhone]   = useState(() => { try { const p = localStorage.getItem('skss_customer_phone') || ''; return p.startsWith('91') ? p.slice(2) : p } catch { return '' } })
  const [slot,    setSlot]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const slots   = buildSlots()

  const captureTitle    = config.catalogue_capture_title    || 'Almost there!'
  const captureSubtitle = config.catalogue_capture_subtitle || 'Just your name and number so we know who to expect on WhatsApp.'
  const capturePrivacy  = config.catalogue_capture_privacy  || 'We use this only to contact you about your shortlist. We never share your details.'
  const ctaBookCall     = config.catalogue_cta_book_call    || 'Book a Call on WhatsApp'
  const ctaOpeningWa    = config.catalogue_cta_opening_wa   || 'Opening WhatsApp\u2026'

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 300) }, [])

  const handleSubmit = async () => {
    const n = name.trim()
    const p = phone.replace(/\D/g, '')
    if (!n) { setError('Please enter your name'); return }
    if (p.length < 10) { setError('Please enter a valid 10-digit phone number'); return }
    setError('')
    setLoading(true)
    try {
      onSubmit(n, p, slot || undefined)  // FIX-3: pass slot
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
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, zIndex: 501, background: '#0f0a06', borderRadius: '20px 20px 0 0', padding: '0 0 40px', boxShadow: '0 -16px 60px rgba(0,0,0,0.95)', animation: 'sheetUp 0.35s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}/>
        </div>
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 400, color: '#fff', lineHeight: 1.2 }}>{captureTitle}</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 1.5 }}>{captureSubtitle}</p>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Shortlist preview */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(201,168,76,0.7)', marginBottom: 10, fontWeight: 600 }}>
              Your shortlist · {wishlist.length} saree{wishlist.length !== 1 ? 's' : ''}
            </p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
              {wishlist.slice(0, 5).map(it => (
                <div key={it.id} style={{ flexShrink: 0, width: 58, textAlign: 'center' }}>
                  <div style={{ width: 58, height: 78, borderRadius: 8, overflow: 'hidden', background: '#1a1008', marginBottom: 5, border: '1px solid rgba(255,255,255,0.1)' }}>
                    {it.image ? <img src={it.image} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🥻</div>}
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold, #C9A84C)' }}>{fmt(it.salePrice ?? it.originalPrice)}</p>
                </div>
              ))}
              {wishlist.length > 5 && (
                <div style={{ flexShrink: 0, width: 58, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <div style={{ width: 58, height: 78, borderRadius: 8, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: 14, color: 'var(--gold, #C9A84C)', fontWeight: 700 }}>+{wishlist.length - 5}</p>
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>more</p>
                </div>
              )}
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 600, display: 'block', marginBottom: 7 }}>Your name</label>
            <input ref={nameRef} type="text" value={name} onChange={e => { setName(e.target.value); setError('') }} onKeyDown={handleKey} placeholder="e.g. Priya Sharma" autoComplete="name"
              style={{ width: '100%', height: 50, borderRadius: 12, padding: '0 16px', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.6)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 600, display: 'block', marginBottom: 7 }}>WhatsApp number</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>+91</span>
              <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setError('') }} onKeyDown={handleKey} placeholder="98765 43210" autoComplete="tel" inputMode="numeric" maxLength={15}
                style={{ width: '100%', height: 50, borderRadius: 12, padding: '0 16px 0 52px', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.6)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
          </div>

          {/* FIX-3: slot picker */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontWeight: 600, display: 'block', marginBottom: 8 }}>When works for a call? <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slots.map(s => (
                <button key={s.value} onClick={() => setSlot(slot === s.value ? '' : s.value)}
                  style={{ width: '100%', height: 44, borderRadius: 12, padding: '0 16px', background: slot === s.value ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', border: slot === s.value ? '1.5px solid var(--gold, #C9A84C)' : '1px solid rgba(255,255,255,0.1)', color: slot === s.value ? 'var(--gold, #C9A84C)' : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: slot === s.value ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: slot === s.value ? '2px solid var(--gold, #C9A84C)' : '2px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {slot === s.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gold, #C9A84C)' }}/>}
                  </div>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 14 }}>{error}</p>}

          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', marginBottom: 16, lineHeight: 1.5 }}>
            {capturePrivacy}
          </p>

          <button onClick={handleSubmit} disabled={loading}
            style={{ width: '100%', height: 54, borderRadius: 14, background: loading ? 'rgba(37,211,102,0.5)' : '#25D366', border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 20px rgba(37,211,102,0.3)', transition: 'background 0.2s' }}
          >
            {loading
              ? <span style={{ opacity: 0.7 }}>{ctaOpeningWa}</span>
              : (<><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>{slot ? `${ctaBookCall} · ${slot.split('(')[0].trim()}` : ctaBookCall}</>)
            }
          </button>
        </div>
      </div>
    </>
  )
}
