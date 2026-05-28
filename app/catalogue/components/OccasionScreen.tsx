'use client'
import { useEffect } from 'react'
import type { Occasion, SiteConfig } from '../types'

// FIX-6: occasionsLoaded prop added — auto-dismiss only fires after the fetch
// has actually completed (not while occasions array is still empty mid-load).
export function OccasionScreen({
  occasions,
  config,
  occasionsLoaded,
  onSelect,
}: {
  occasions: Occasion[]
  config: SiteConfig
  occasionsLoaded: boolean
  onSelect: (slug: string | null) => void
}) {
  const eyebrow   = config.catalogue_occasion_eyebrow    || 'Curated for you'
  const heading   = config.catalogue_occasion_heading    || 'What are you shopping for?'
  const subtext   = config.catalogue_occasion_subtext    || "We'll show you the most relevant sarees first"
  const browseAll = config.catalogue_occasion_browse_all || 'Browse all sarees'

  // FIX-6: only auto-dismiss when occasionsLoaded is true (Wave 1 resolved)
  // and the result is genuinely empty — not just "not loaded yet"
  useEffect(() => {
    if (occasionsLoaded && occasions.length === 0) onSelect(null)
  }, [occasionsLoaded, occasions.length, onSelect])

  // Show a loading state while Wave 1 is still in-flight
  if (!occasionsLoaded) return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--ivory, #FDFAF7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', animation: 'pulse 1.2s ease infinite' }}/>
    </div>
  )

  if (occasions.length === 0) return null

  const cols = occasions.length >= 6 ? 3 : 2
  const maxW = cols === 3 ? 420 : 360
  const items = occasions.slice(0, 6)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'var(--ivory, #FDFAF7)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 20px', overflowY: 'auto',
        animation: 'occasionFadeIn 0.4s ease',
      }}
    >
      <style>{`@keyframes occasionFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,80%,100%{opacity:0.3;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexShrink: 0 }}>
        <div style={{ height: 1, width: 32, background: 'linear-gradient(to right, transparent, #C9A84C)' }}/>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C' }}/>
        <div style={{ height: 1, width: 32, background: 'linear-gradient(to left, transparent, #C9A84C)' }}/>
      </div>

      <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 10, fontWeight: 500, flexShrink: 0 }}>
        {eyebrow}
      </p>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(24px, 7vw, 36px)', fontWeight: 300, color: '#1A1A1A', textAlign: 'center', lineHeight: 1.15, marginBottom: 6, letterSpacing: 0.5, flexShrink: 0 }}>
        {heading.includes('\n')
          ? heading.split('\n').map((line, i) => <span key={i}>{i > 0 && <br/>}{i === 1 ? <em style={{ color: '#8B1A2B', fontStyle: 'italic' }}>{line}</em> : line}</span>)
          : (() => {
              const words = heading.split(' ')
              if (words.length <= 2) return <em style={{ color: '#8B1A2B', fontStyle: 'italic' }}>{heading}</em>
              return <>{words.slice(0, -2).join(' ')}<br/><em style={{ color: '#8B1A2B', fontStyle: 'italic' }}>{words.slice(-2).join(' ')}</em></>
            })()
        }
      </h1>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#5A4A3A', marginBottom: 28, textAlign: 'center', lineHeight: 1.6, flexShrink: 0 }}>
        {subtext}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, width: '100%', maxWidth: maxW, flexShrink: 0 }}>
        {items.map(occ => (
          <button
            key={occ.id}
            onClick={() => onSelect(occ.slug)}
            style={{ borderRadius: 14, overflow: 'hidden', position: 'relative', aspectRatio: '3/4', cursor: 'pointer', padding: 0, border: 'none', background: '#F5EDE3', boxShadow: '0 2px 16px rgba(139,26,43,0.08)', transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 28px rgba(139,26,43,0.15)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = '0 2px 16px rgba(139,26,43,0.08)' }}
          >
            {occ.image_url
              ? <img src={occ.image_url} alt={occ.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}/>
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #F5EDE3, #EDE0D0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>🥻</div>
            }
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(139,26,43,0.75) 0%, transparent 55%)', pointerEvents: 'none' }}/>
            <p style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: cols === 3 ? 9 : 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {occ.name}
            </p>
          </button>
        ))}
      </div>

      <button
        onClick={() => onSelect(null)}
        style={{ marginTop: 22, background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: 12, color: '#5A4A3A', cursor: 'pointer', padding: '8px 0', letterSpacing: 0.5, textDecoration: 'underline', textDecorationColor: '#E8DDD4', textUnderlineOffset: 3, flexShrink: 0 }}
      >
        {browseAll}
      </button>
    </div>
  )
}
