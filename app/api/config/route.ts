import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Fetches brand config from the same site_config table the admin uses.
// Only exposes safe public fields — no keys, no secrets.
const PUBLIC_KEYS = [
  'brand_name', 'brand_short_name', 'brand_subtitle',
  'brand_tagline', 'logo_url', 'whatsapp_number',
]

export const revalidate = 300 // cache for 5 minutes

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
  data?.forEach((r: any) => { config[r.key] = r.value })

  return NextResponse.json(config)
}
