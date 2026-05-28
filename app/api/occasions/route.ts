import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Prevent Next.js prerendering this route at build time — Supabase env vars
// are not available during Vercel builds, causing "supabaseUrl is required".
export const dynamic = 'force-dynamic'
export const revalidate = 300

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabase
    .from('occasions')
    .select('id, name, slug, image_url')
    .eq('is_active', true)
    .order('display_order')
    .limit(8)

  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data ?? [])
}
