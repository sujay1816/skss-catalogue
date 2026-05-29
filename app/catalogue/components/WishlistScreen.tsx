'use client'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import type { WishlistItem } from '@/types'
import type { SiteConfig } from '../types'

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN')

function buildShareUrl(items: WishlistItem[]) {
  const ids = items.map(it => it.id).join(',')
  return `${window.location.origin}/catalogue?saved=${encodeURIComponent(ids)}`
}

export function WishlistScreen({
  items, config, onClose, onRemove, onCall, waNum, onOpenDetail, undoRm, onUndoRm,
}: {
  items: WishlistItem[]
  config: SiteConfig
  onClose: () => void
  onRemove: (id: string) => void
  onCall: () => void
  waNum: string
  onOpenDetail: (id: string) => void
  undoRm?: { it: WishlistItem; t: ReturnType<typeof setTimeout> } | null
  onUndoRm?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current) }, [])
  const total = items.reduce((s, it) => s + (it.salePrice ?? it.originalPrice), 0)

  const wishlistTitle  = config.catalogue_wishlist_title        || 'Your Shortlist'
  const emptyTitle     = config.catalogue_wishlist_empty_title  || 'Nothing saved yet'
  const emptyBody      = config.catalogue_wishlist_empty_body   || 'Swipe right or tap the heart on any saree to save it here'

  // ── Change 5: value-anchored CTA from the very first item ────────────────
  const ctaCopy = items.length >= 5
    ? `You've shortlisted ${items.length} sarees worth ${fmt(total)} — see them all on a quick call`
    : items.length >= 2
      ? `${fmt(total)} in your shortlist — book a call to see them in your size and all colours`
      : items.length === 1
        ? `${fmt(total)} in your shortlist — book a call to see it in your size and all colours`
        : config.catalogue_cta_book_call || 'Book a Call on WhatsApp'

  const handleShare = () => {
    const url = buildShareUrl(items)
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'My Saree Shortlist', url }).catch(() => {})
      return
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => {
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
        setCopied(true)
        copiedTimerRef.current = setTimeout(() => setCopied(false), 2500)
      }).catch(() => { window.prompt('Copy your shortlist link:', url) })
    } else {
      window.prompt('Copy your shortlist link:', url)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#080502', display: 'flex', flexDirection: 'column' }}>
      {/* Undo-remove toast */}
      {undoRm && onUndoRm && (
        <div style={{ position: 'absolute', bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))', left: 16, right: 16, zIndex: 401, background: 'rgba(15,10,5,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Removed from shortlist</span>
          <button onClick={onUndoRm} style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 8, padding: '5px 14px', color: 'var(--gold, #C9A84C)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Undo</button>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 16px) + 36px) 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: items.length > 0 ? 14 : 0 }}>
          <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 400, color: '#fff' }}>{wishlistTitle}</h1>
            {items.length > 0 && (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {items.length} {items.length === 1 ? 'saree' : 'sarees'} · <span style={{ color: 'var(--gold, #C9A84C)', fontWeight: 600 }}>{fmt(total)}</span>
              </p>
            )}
          </div>
          {/* Share button stays in header as a convenience affordance */}
          {items.length > 0 && (
            <button onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: 6, background: copied ? 'rgba(37,211,102,0.15)' : 'rgba(255,255,255,0.07)', border: copied ? '1px solid rgba(37,211,102,0.4)' : '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '7px 14px', color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              {copied ? 'Copied!' : 'Share'}
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40, textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(139,26,43,0.12)', border: '1px solid rgba(139,26,43,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🥻</div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 400, color: '#fff', marginBottom: 8 }}>{emptyTitle}</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{emptyBody}</p>
          </div>
          <button onClick={onClose} style={{ marginTop: 8, padding: '12px 28px', background: 'rgba(139,26,43,0.2)', border: '1px solid rgba(139,26,43,0.4)', borderRadius: 12, color: '#F8A3AF', fontSize: 14, cursor: 'pointer' }}>Start browsing</button>
        </div>
      ) : (
        <>
          <p style={{ flexShrink: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '6px 0 0', letterSpacing: 0.3 }}>Tap any saree to view details</p>

          {/* Saree grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: items.length === 1 ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 8, maxWidth: items.length === 1 ? 220 : '100%', margin: items.length === 1 ? '0 auto 8px' : '0 0 8px' }}>
              {items.map(it => (
                <div key={it.id} onClick={() => onOpenDetail(it.id)} style={{ borderRadius: 16, overflow: 'hidden', background: '#1a1008', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', cursor: 'pointer' }}>
                  <div style={{ aspectRatio: '3/4', position: 'relative', overflow: 'hidden' }}>
                    {it.image
                      ? <Image src={it.image} alt={it.name} fill style={{ objectFit: 'cover', objectPosition: 'top' }} sizes="(max-width:480px) 50vw, 220px"/>
                      : <div style={{ width: '100%', height: '100%', background: '#2D1B1B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🥻</div>
                    }
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', pointerEvents: 'none' }}/>
                    <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold, #C9A84C)' }}>{fmt(it.salePrice ?? it.originalPrice)}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); onRemove(it.id) }} style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.3, marginBottom: 3 }}>{it.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{it.fabric || it.categoryName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div style={{ padding: `16px 16px calc(32px + env(safe-area-inset-bottom, 0px))`, borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,5,2,0.98)', flexShrink: 0 }}>

            {/* Total value anchor */}
            <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>Total shortlist value</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold, #C9A84C)', marginTop: 2 }}>{fmt(total)}</p>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'right', lineHeight: 1.5, maxWidth: 110 }}>
                {items.length} {items.length === 1 ? 'saree' : 'sarees'} shortlisted
              </p>
            </div>

            {/* ── Change 6: Trust signals ──────────────────────────────────── */}
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', textAlign: 'center', marginBottom: 12, letterSpacing: 0.3, lineHeight: 1.6 }}>
              Free shipping across India&nbsp;·&nbsp;Family-run shop&nbsp;·&nbsp;Easy returns on defects
            </p>

            {/* ── Change 7: Two equal-weight CTAs ──────────────────────────── */}
            {waNum && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                {/* Book a Call — primary */}
                <button
                  onClick={onCall}
                  style={{
                    flex: 1, borderRadius: 14,
                    background: 'linear-gradient(135deg, var(--crimson, #8B1A2B), var(--crimson-dark, #6B1220))',
                    border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 7,
                    padding: '14px 10px', lineHeight: 1.3, textAlign: 'center',
                    boxShadow: '0 4px 16px rgba(139,26,43,0.4)',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>📞</span>
                  <span>Book a Call</span>
                </button>

                {/* Share with Family — equal weight, gold outline */}
                <button
                  onClick={handleShare}
                  style={{
                    flex: 1, borderRadius: 14,
                    background: 'rgba(201,168,76,0.08)',
                    border: '2px solid rgba(201,168,76,0.5)',
                    color: 'var(--gold, #C9A84C)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 7,
                    padding: '14px 10px', lineHeight: 1.3, textAlign: 'center',
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = 'rgba(201,168,76,0.14)'
                    el.style.borderColor = 'rgba(201,168,76,0.7)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = 'rgba(201,168,76,0.08)'
                    el.style.borderColor = 'rgba(201,168,76,0.5)'
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🔗</span>
                  <span>{copied ? 'Link copied!' : 'Share with Family'}</span>
                </button>
              </div>
            )}

            {/* Value CTA subtext */}
            {waNum && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginBottom: 10, lineHeight: 1.5 }}>
                {ctaCopy}
              </p>
            )}

            <button onClick={onClose} style={{ width: '100%', height: 40, borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer' }}>Keep browsing</button>
          </div>
        </>
      )}
    </div>
  )
}
