import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 300

async function getBrandName(): Promise<string> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase
      .from('site_config').select('value').eq('key', 'brand_name').single()
    return data?.value?.trim() || process.env.NEXT_PUBLIC_BRAND_NAME || 'Saree Catalogue'
  } catch {
    return process.env.NEXT_PUBLIC_BRAND_NAME || 'Saree Catalogue'
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getBrandName()
  return {
    name:             brand,
    short_name:       brand,
    description:      'Swipe sarees, shortlist favourites, book a video call.',
    start_url:        '/catalogue',
    display:          'standalone',
    background_color: '#0D0905',
    theme_color:      '#0D0905',
    orientation:      'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
