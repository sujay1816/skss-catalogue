import type { SiteConfig } from '../types'

export function Logo({ config }: { config: SiteConfig }) {
  const name     = config.brand_name     || ''
  const subtitle = config.brand_subtitle || ''
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
