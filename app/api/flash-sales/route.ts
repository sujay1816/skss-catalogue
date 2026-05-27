import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60 // revalidate every minute for countdown accuracy

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('flash_sales')
    .select('id, title, ends_at, flash_sale_products(product_id, sale_price)')
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .limit(1)
    .single()

  if (error || !data) return NextResponse.json(null)
  // Build a map: product_id -> sale_price
  const saleMap: Record<string, number> = {}
  ;(data.flash_sale_products || []).forEach((fp: any) => {
    if (fp.product_id) saleMap[fp.product_id] = fp.sale_price
  })
  return NextResponse.json({ id: data.id, title: data.title, ends_at: data.ends_at, saleMap })
}
