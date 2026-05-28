import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// All public-safe keys from the admin site_config table.
// Brand + colour keys are joined by catalogue UI-text keys so every
// user-facing string can be changed from the admin panel without a deploy.
const PUBLIC_KEYS = [
  // Brand
  'brand_name', 'brand_short_name', 'brand_subtitle', 'brand_tagline',
  'logo_url', 'whatsapp_number',
  // Colours
  'color_primary', 'color_accent', 'color_background', 'color_page_bg',
  // Catalogue UI text
  'catalogue_cta_book_call',
  'catalogue_cta_opening_wa',
  'catalogue_capture_title',
  'catalogue_capture_subtitle',
  'catalogue_capture_privacy',
  'catalogue_occasion_eyebrow',
  'catalogue_occasion_heading',
  'catalogue_occasion_subtext',
  'catalogue_occasion_browse_all',
  'catalogue_wishlist_title',
  'catalogue_wishlist_empty_title',
  'catalogue_wishlist_empty_body',
  'catalogue_wa_message_template',
  'catalogue_meta_title',
  'catalogue_meta_description',
]

export const revalidate = 300

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabase
    .from('site_config')
    .select('key, value')
    .in('key', PUBLIC_KEYS)

  if (error) return NextResponse.json({}, { status: 500 })

  const config: Record<string, string> = {}
  data?.forEach((r: { key: string; value: string }) => { if (r.value?.trim()) config[r.key] = r.value.trim() })

  return NextResponse.json(config)
}
