import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// All public-safe brand + colour keys from the admin site_config table
const PUBLIC_KEYS = [
  'brand_name', 'brand_short_name', 'brand_subtitle', 'brand_tagline',
  'logo_url', 'whatsapp_number',
  'color_primary', 'color_accent', 'color_background', 'color_page_bg',
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
