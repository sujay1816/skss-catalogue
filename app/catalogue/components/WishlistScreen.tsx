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

// FIX-5: intent-anchored copy in footer — shows total prominently + contextual CTA
// FIX-15: CSS variables for brand colours
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

  const wishlistTitle  = config.catalogue_wishlist_title       || 'Your Shortlist'
  const emptyTitle     = config.catalogue_wishlist_empty_title || 'Nothing saved yet'
  const emptyBody      = config.catalogue_wishlist_empty_body  || 'Swipe right or tap the heart on any saree to save it here'
  const ctaBookCall    = config.catalogue_cta_book_call        || 'Book a Call on WhatsApp'

  // FIX-5: contextual CTA copy based on shortlist size
  const ctaCopy = items.length >= 5
    ? `You've shortlisted ${items.length} sarees worth ${fmt(total)} — see them all on a quick call`
    : items.length >= 2
      ? `${items.length} sarees shortlisted · Book a call to see them in detail`
      : ctaBookCall

  const handleShare = () => {
    const url = buildShareUrl(items)
    // Use Web Share API if available (mobile native share sheet)
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'My Saree Shortlist', url }).catch(() => {})
      return
    }
    // Use Clipboard API only in secure contexts (HTTPS)
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => {
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
        setCopied(true)
        copiedTimerRef.current = setTimeout(() => setCopied(false), 2500)
      }).catch(() => { window.prompt('Copy your shortlist link:', url) })
    } else {
      // Fallback for HTTP or unsupported browsers
      window.prompt('Copy your shortlist link:', url)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#080502', display: 'flex', flexDirection: 'column' }}>
      {/* Undo-remove toast — rendered inside WishlistScreen so it appears above it (zIndex 401) */}
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
            {/* FIX-5: total shown prominently in header */}
            {items.length > 0 && (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {items.length} {items.length === 1 ? 'saree' : 'sarees'} · <span style={{ color: 'var(--gold, #C9A84C)', fontWeight: 600 }}>{fmt(total)}</span>
              </p>
            )}
          </div>
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
          <p style={{ flexShrink: 0, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '6px 0 0', letterSpacing: 0.3 }}>Tap any saree to view details</p>

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

          {/* Footer — FIX-5: intent-anchored total + contextual CTA */}
          <div style={{ padding: `16px 16px calc(36px + env(safe-area-inset-bottom, 0px))`, borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,5,2,0.98)', flexShrink: 0 }}>
            {/* FIX-5: big total as anchor */}
            <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>Total shortlist value</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold, #C9A84C)', marginTop: 2 }}>{fmt(total)}</p>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'right', lineHeight: 1.5, maxWidth: 120 }}>Share with family before your call</p>
            </div>

            {waNum && (
              <button onClick={onCall} style={{ width: '100%', borderRadius: 14, background: '#25D366', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 20px rgba(37,211,102,0.3)', marginBottom: 10, padding: '14px 16px', lineHeight: 1.4, textAlign: 'center' }}>
                <svg width="20" height="20" style={{ flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span>{ctaCopy}</span>
              </button>
            )}
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
