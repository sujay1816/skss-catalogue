import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { name, phone, wishlist, device_id, occasion } = body

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) {
    return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
  }

  // Use the service role key for server-side writes — this key is never exposed to the browser.
  // Falls back to anon key in local dev if service role is not set.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('catalogue_sessions')
    .upsert(
      {
        name:       name.trim(),
        phone:      digits.startsWith('91') ? digits : '91' + digits,
        wishlist:   wishlist ?? [],
        occasion:   occasion ?? null,
        device_id:  device_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'device_id', ignoreDuplicates: false }
    )
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('catalogue_sessions error:', error.message)
    return NextResponse.json({ id: null, warning: 'session_not_saved' })
  }

  return NextResponse.json({ id: data?.id })
}
