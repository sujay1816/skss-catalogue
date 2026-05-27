import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { name, phone, wishlist, device_id } = body

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  // Basic phone validation — must have at least 10 digits
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) {
    return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Upsert — if same device_id comes back, update their session
  const { data, error } = await supabase
    .from('catalogue_sessions')
    .upsert(
      {
        name:       name.trim(),
        phone:      digits,
        wishlist:   wishlist ?? [],
        device_id:  device_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'device_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) {
    // Table may not exist yet — return success anyway so UX isn't blocked
    console.error('catalogue_sessions error:', error.message)
    return NextResponse.json({ id: null, warning: 'session_not_saved' })
  }

  return NextResponse.json({ id: data?.id })
}
