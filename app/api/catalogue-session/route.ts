import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  // FIX-3: accept preferred_slot field and persist to DB
  const { name, phone, wishlist, device_id, occasion, preferred_slot } = body

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
  }

  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) {
    return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const safeDeviceId = (device_id && device_id !== 'unknown') ? device_id : null

  // BUG-5 FIX: when safeDeviceId is null we cannot upsert on phone because two
  // different people can share the same number (family member, in-store demo).
  // Upserting on phone would silently overwrite the first user's wishlist with
  // the second user's data. Instead we always INSERT when there is no device_id,
  // accepting duplicate rows rather than data corruption. The admin view dedupes
  // by phone + recency when displaying sessions.
  if (safeDeviceId) {
    const { data, error } = await supabase
      .from('catalogue_sessions')
      .upsert(
        {
          name:           name.trim(),
          phone:          digits.startsWith('91') ? digits : '91' + digits,
          wishlist:       wishlist ?? [],
          occasion:       occasion ?? null,
          device_id:      safeDeviceId,
          preferred_slot: preferred_slot ?? null,
          updated_at:     new Date().toISOString(),
        },
        { onConflict: 'device_id', ignoreDuplicates: false }
      )
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('catalogue_sessions upsert error:', error.message)
      return NextResponse.json({ id: null, warning: 'session_not_saved' })
    }
    return NextResponse.json({ id: data?.id })
  }

  // No reliable device_id — plain insert to avoid overwriting another user's data.
  const { data, error } = await supabase
    .from('catalogue_sessions')
    .insert({
      name:           name.trim(),
      phone:          digits.startsWith('91') ? digits : '91' + digits,
      wishlist:       wishlist ?? [],
      occasion:       occasion ?? null,
      device_id:      null,
      preferred_slot: preferred_slot ?? null,
      updated_at:     new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('catalogue_sessions insert error:', error.message)
    return NextResponse.json({ id: null, warning: 'session_not_saved' })
  }

  return NextResponse.json({ id: data?.id })
}
