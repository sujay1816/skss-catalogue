import type { Metadata, Viewport } from 'next'
import './globals.css'

const CATALOGUE_URL = process.env.NEXT_PUBLIC_CATALOGUE_URL || ''
const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || 'SKSS'
const OG_IMAGE = process.env.NEXT_PUBLIC_OG_IMAGE || ''

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0D0905',
}

export const metadata: Metadata = {
  title: `${BRAND} Catalogue — Swipe & Discover`,
  description: `Browse our handpicked saree collection. Swipe to save your favourites, then book a personal video call to see more colours and designs.`,
  metadataBase: CATALOGUE_URL ? new URL(CATALOGUE_URL) : undefined,
  openGraph: {
    type: 'website',
    title: `${BRAND} — Swipe Saree Catalogue`,
    description: 'Discover handcrafted sarees. Swipe, shortlist, and book a video call.',
    siteName: BRAND,
    ...(OG_IMAGE ? { images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${BRAND} Silk Saree Catalogue` }] } : {}),
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts — Cormorant for headings, DM Sans for body */}
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
