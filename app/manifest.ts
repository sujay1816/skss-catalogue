import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Saree Catalogue',
    short_name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Catalogue',
    description: 'Swipe sarees, shortlist favourites, book a video call.',
    start_url: '/catalogue',
    display: 'standalone',
    background_color: '#0D0905',
    theme_color: '#0D0905',
    orientation: 'portrait',
    icons: [
      {
        src: process.env.NEXT_PUBLIC_OG_IMAGE || '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: process.env.NEXT_PUBLIC_OG_IMAGE || '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
