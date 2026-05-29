'use client'
import { useEffect } from 'react'
import Image from 'next/image'
import type { Occasion, SiteConfig } from '../types'

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

  // Change 10: hero image — prefer explicit config key, fall back to first occasion photo
  const heroImage = config.hero_image || occasions[0]?.image_url || null

  useEffect(() => {
    if (occasionsLoaded && occasions.length === 0) onSelect(null)
  }, [occasionsLoaded, occasions.length, onSelect])

  // Loading state
  if (!occasionsLoaded) return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--ivory, #FDFAF7)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', animation: 'pulse 1.2s ease infinite' }}/>
      <p style={{ fontSize: 12, color: '#9A8070', letterSpacing: 0.5 }}>Loading…</p>
    </div>
  )

  if (occasions.length === 0) return null

  const cols  = occasions.length >= 6 ? 3 : 2
  const maxW  = cols === 3 ? 420 : 360
  const items = occasions.slice(0, 8)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'var(--ivory, #FDFAF7)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
        animation: 'occasionFadeIn 0.4s ease',
      }}
    >
      {/* ── Change 10: Hero saree image ───────────────────────────────────── */}
      {heroImage && (
        <div style={{
          width: '100%', position: 'relative',
          height: 'clamp(180px, 30vh, 250px)',
          flexShrink: 0,
        }}>
          <Image
            src={heroImage}
            alt="Featured saree"
            fill
            style={{ objectFit: 'cover', objectPosition: 'top', pointerEvents: 'none' }}
            sizes="(max-width:480px) 100vw, 480px"
            priority
          />
          {/* Soft fade into page background */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%',
            background: 'linear-gradient(to top, var(--ivory, #FDFAF7) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}/>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: '100%', maxWidth: 480,
        padding: heroImage
          ? '4px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)'
          : 'calc(env(safe-area-inset-top, 0px) + 32px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)',
      }}>

        {/* Decorative dots — only show when no hero (hero already provides visual hierarchy) */}
        {!heroImage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexShrink: 0 }}>
            <div style={{ height: 1, width: 32, background: 'linear-gradient(to right, transparent, #C9A84C)' }}/>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C' }}/>
            <div style={{ height: 1, width: 32, background: 'linear-gradient(to left, transparent, #C9A84C)' }}/>
          </div>
        )}

        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: 3,
          textTransform: 'uppercase', color: '#C9A84C',
          marginBottom: 10, fontWeight: 500, flexShrink: 0,
        }}>
          {eyebrow}
        </p>

        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(24px, 7vw, 36px)',
          fontWeight: 300, color: '#1A1A1A', textAlign: 'center',
          lineHeight: 1.15, marginBottom: 6, letterSpacing: 0.5, flexShrink: 0,
        }}>
          {heading.includes('\n')
            ? heading.split('\n').map((line, i) => (
                <span key={i}>
                  {i > 0 && <br/>}
                  {i === 1 ? <em style={{ color: '#8B1A2B', fontStyle: 'italic' }}>{line}</em> : line}
                </span>
              ))
            : (() => {
                const words = heading.split(' ')
                if (words.length <= 2)
                  return <em style={{ color: '#8B1A2B', fontStyle: 'italic' }}>{heading}</em>
                return (
                  <>
                    {words.slice(0, -2).join(' ')}<br/>
                    <em style={{ color: '#8B1A2B', fontStyle: 'italic' }}>{words.slice(-2).join(' ')}</em>
                  </>
                )
              })()
          }
        </h1>

        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 13, color: '#5A4A3A',
          marginBottom: 20, textAlign: 'center', lineHeight: 1.6, flexShrink: 0,
        }}>
          {subtext}
        </p>

        {/* ── Change 1: "Just browsing" — prominent button ABOVE the grid ── */}
        <button
          onClick={() => onSelect(null)}
          style={{
            width: '100%', maxWidth: maxW, marginBottom: 16, flexShrink: 0,
            borderRadius: 14, padding: '14px 20px',
            background: 'linear-gradient(135deg, #FDF6EC, #F7EDD8)',
            border: '1.5px solid rgba(201,168,76,0.45)',
            cursor: 'pointer', textAlign: 'center',
            boxShadow: '0 2px 12px rgba(201,168,76,0.15)',
            transition: 'box-shadow 0.18s ease, transform 0.18s ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.boxShadow = '0 6px 20px rgba(201,168,76,0.25)'
            el.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.boxShadow = '0 2px 12px rgba(201,168,76,0.15)'
            el.style.transform = 'translateY(0)'
          }}
        >
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600,
            color: '#5A3A1A', marginBottom: 2,
          }}>
            Just browsing — show me everything
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 12, color: '#9A7A5A', fontWeight: 400,
          }}>
            See the full collection
          </p>
        </button>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', maxWidth: maxW, marginBottom: 16, flexShrink: 0,
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(139,26,43,0.12)' }}/>
          <p style={{ fontSize: 11, color: '#9A8070', letterSpacing: 1, textTransform: 'uppercase' }}>or shop by occasion</p>
          <div style={{ flex: 1, height: 1, background: 'rgba(139,26,43,0.12)' }}/>
        </div>

        {/* Occasion grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 10, width: '100%', maxWidth: maxW, flexShrink: 0,
        }}>
          {items.map(occ => (
            <button
              key={occ.id}
              onClick={() => onSelect(occ.slug)}
              style={{
                borderRadius: 14, overflow: 'hidden', position: 'relative',
                aspectRatio: '3/4', cursor: 'pointer', padding: 0,
                border: 'none', background: '#F5EDE3',
                boxShadow: '0 2px 16px rgba(139,26,43,0.08)',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'translateY(-2px)'
                el.style.boxShadow = '0 8px 28px rgba(139,26,43,0.15)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = '0 2px 16px rgba(139,26,43,0.08)'
              }}
            >
              {occ.image_url
                ? <Image
                    src={occ.image_url}
                    alt={occ.name}
                    fill
                    style={{ objectFit: 'cover', objectPosition: 'top' }}
                    sizes="(max-width:480px) 33vw, 140px"
                  />
                : <div style={{
                    width: '100%', height: '100%',
                    background: 'linear-gradient(145deg, #F5EDE3, #EDE0D0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38,
                  }}>🥻</div>
              }
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(139,26,43,0.75) 0%, transparent 55%)',
                pointerEvents: 'none',
              }}/>
              <p style={{
                position: 'absolute', bottom: 10, left: 0, right: 0,
                textAlign: 'center', fontFamily: 'var(--font-body)',
                fontSize: cols === 3 ? 9 : 11, fontWeight: 600,
                letterSpacing: 1.5, textTransform: 'uppercase',
                color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}>
                {occ.name}
              </p>
            </button>
          ))}
        </div>

        {/* Secondary browse-all text link */}
        <button
          onClick={() => onSelect(null)}
          style={{
            marginTop: 20, background: 'none', border: 'none',
            fontFamily: 'var(--font-body)', fontSize: 12, color: '#5A4A3A',
            cursor: 'pointer', padding: '8px 0', letterSpacing: 0.5,
            textDecoration: 'underline', textDecorationColor: '#E8DDD4',
            textUnderlineOffset: 3, flexShrink: 0,
          }}
        >
          {browseAll}
        </button>
      </div>
    </div>
  )
}
