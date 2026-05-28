import type { Metadata, Viewport } from 'next'
import './globals.css'

// BRAND fallback is intentionally blank — all real values come from admin site_config
// Set NEXT_PUBLIC_BRAND_NAME in Vercel env vars as a static fallback for tab titles
const CATALOGUE_URL = process.env.NEXT_PUBLIC_CATALOGUE_URL || ''
const BRAND         = process.env.NEXT_PUBLIC_BRAND_NAME    || ''
const OG_IMAGE      = process.env.NEXT_PUBLIC_OG_IMAGE      || ''

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0D0905',
}

export const metadata: Metadata = {
  title: BRAND ? `${BRAND} — Swipe & Discover` : 'Saree Catalogue — Swipe & Discover',
  description: 'Browse our handpicked saree collection. Swipe to save your favourites, then book a personal video call.',
  metadataBase: CATALOGUE_URL ? new URL(CATALOGUE_URL) : undefined,
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    title: BRAND ? `${BRAND} — Swipe Saree Catalogue` : 'Swipe Saree Catalogue',
    description: 'Discover handcrafted sarees. Swipe, shortlist, and book a video call.',
    siteName: BRAND || undefined,
    ...(OG_IMAGE ? { images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Saree Catalogue' }] } : {}),
  },
  twitter: { card: 'summary_large_image' },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: BRAND || 'Catalogue' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
