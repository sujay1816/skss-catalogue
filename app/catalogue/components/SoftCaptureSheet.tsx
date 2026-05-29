'use client'
import React, { useState, useRef, useEffect } from 'react'
import type { WishlistItem } from '@/types'
import { track } from '@/lib/analytics'

const STORAGE_KEY = 'skss_soft_captured'

/** Returns true if the user has already seen/dismissed the soft capture. */
export function hasSoftCaptured(): boolean {
  try { return !!localStorage.getItem(STORAGE_KEY) } catch { return false }
}

/**
 * Non-blocking bottom sheet shown after the 4th shortlist item.
 * A single phone field, skippable/dismissible. On submit it POSTs
 * to /api/catalogue-session (no WhatsApp redirect — goal is the lead).
 */
export function SoftCaptureSheet({
  wishlist,
  onSubmit,
  onDismiss,
}: {
  wishlist: WishlistItem[]
  onSubmit: (phone: string) => void
  onDismiss: () => void
}) {
  const [phone,   setPhone]   = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus phone field once the sheet has animated in
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350)
    return () => clearTimeout(t)
  }, [])

  const markSeen = () => { try { localStorage.setItem(STORAGE_KEY, '1') } catch {} }

  const handleSubmit = () => {
    const digits = phone.replace(/\D/g, '')
    const p = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits
    if (p.length !== 10) { setError('Please enter a valid 10-digit number'); return }
    setError('')
    setLoading(true)
    markSeen()
    track('soft_capture_submitted')
    onSubmit(p)
    setLoading(false)
  }

  const handleDismiss = () => {
    markSeen()
    onDismiss()
  }

  return (
    <>
      {/* Tap-outside backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 480,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save your shortlist"
        style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, zIndex: 481,
          background: '#0f0a06', borderRadius: '20px 20px 0 0',
          boxShadow: '0 -16px 60px rgba(0,0,0,0.95)',
          animation: 'sheetUp 0.35s cubic-bezier(0.32,0.72,0,1)',
          padding: '16px 24px calc(32px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}/>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{
              fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 400,
              color: '#fff', marginBottom: 4,
            }}>
              Save your shortlist?
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
              {wishlist.length} saree{wishlist.length !== 1 ? 's' : ''} saved
              {' '}— we&apos;ll WhatsApp you a link anytime.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.45)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Phone input + submit */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none',
            }}>
              +91
            </span>
            <input
              ref={inputRef}
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="98765 43210"
              inputMode="numeric"
              maxLength={12}
              autoComplete="tel"
              style={{
                width: '100%', height: 50, borderRadius: 12,
                padding: '0 16px 0 52px',
                background: 'rgba(255,255,255,0.06)',
                border: error ? '1.5px solid #f87171' : '1.5px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 15, outline: 'none',
                fontFamily: 'var(--font-body)', boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = 'rgba(201,168,76,0.6)' }}
              onBlur={e => { if (!error) e.target.style.borderColor = 'rgba(255,255,255,0.12)' }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              height: 50, borderRadius: 12, padding: '0 22px',
              background: 'var(--crimson, #8B1A2B)', border: 'none',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
              opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>{error}</p>
        )}

        {/* Item 3: privacy reassurance near the phone field */}
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 10, lineHeight: 1.5, textAlign: 'center' }}>
          We&apos;ll only message you about your shortlist. No spam, no sharing your number.
        </p>

        <button
          onClick={handleDismiss}
          style={{
            marginTop: 14, width: '100%', background: 'none', border: 'none',
            fontSize: 12, color: 'rgba(255,255,255,0.25)', cursor: 'pointer', padding: '4px 0',
          }}
        >
          No thanks, I&apos;ll keep browsing
        </button>
      </div>
    </>
  )
}
