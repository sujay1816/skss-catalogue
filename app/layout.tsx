import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { createClient } from '@supabase/supabase-js'
import Script from 'next/script'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-body',
  display: 'swap',
})

async function getSiteConfig(): Promise<Record<string, string>> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase
      .from('site_config')
      .select('key, value')
      .in('key', [
        'brand_name', 'logo_url',
        'catalogue_meta_title', 'catalogue_meta_description',
      ])
    const cfg: Record<string, string> = {}
    data?.forEach((r: { key: string; value: string }) => { if (r.value?.trim()) cfg[r.key] = r.value.trim() })
    return cfg
  } catch { return {} }
}

const CATALOGUE_URL = process.env.NEXT_PUBLIC_CATALOGUE_URL || ''
const OG_IMAGE      = process.env.NEXT_PUBLIC_OG_IMAGE      || ''

export const revalidate = 300

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0D0905',
}

export async function generateMetadata(): Promise<Metadata> {
  const cfg       = await getSiteConfig()
  const brand     = cfg.brand_name                 || process.env.NEXT_PUBLIC_BRAND_NAME || ''
  const metaTitle = cfg.catalogue_meta_title       || 'Swipe & Discover'
  const metaDesc  = cfg.catalogue_meta_description || 'Browse our handpicked saree collection. Swipe to save your favourites, then book a personal video call.'

  return {
    title:       brand ? `${brand} — ${metaTitle}` : `Saree Catalogue — ${metaTitle}`,
    description: metaDesc,
    metadataBase: CATALOGUE_URL ? new URL(CATALOGUE_URL) : undefined,
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      title:       brand ? `${brand} — ${metaTitle}` : metaTitle,
      description: metaDesc,
      siteName:    brand || undefined,
      ...(OG_IMAGE ? { images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Saree Catalogue' }] } : {}),
    },
    twitter: { card: 'summary_large_image' },
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: brand || 'Catalogue' },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body>
        {children}
        {/* Change 3: Plausible analytics — add NEXT_PUBLIC_PLAUSIBLE_DOMAIN to .env.local to activate */}
        {plausibleDomain && (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/plausible.js"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
