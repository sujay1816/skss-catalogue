import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SELECT = `
  id, name, slug, description, fabric, weave_type, origin_region,
  occasion, care_instructions, blouse_included, length, weight_grams,
  original_price, sale_price, discount_percent, gst_rate,
  is_featured, is_bestseller, created_at, average_rating, review_count,
  video_url,
  categories(name, slug),
  product_images(id, url, alt_text, is_primary, order_index),
  product_variants(id, colour, colour_hex, stock, image_url)
`

// Supabase row types — replace 'any' throughout this file
interface ProductRow {
  id: string; name: string; slug: string; description: string | null
  fabric: string | null; weave_type: string | null; origin_region: string | null
  occasion: string[] | null; care_instructions: string | null
  blouse_included: boolean | null; length: number | null; weight_grams: number | null
  original_price: number; sale_price: number | null; discount_percent: number | null
  gst_rate: number | null; is_featured: boolean | null; is_bestseller: boolean | null
  created_at: string; average_rating: number | null; review_count: number | null
  video_url: string | null; show_in_catalogue: boolean | null
  categories: { name: string; slug: string } | null
  product_images: ImageRow[]
  product_variants: VariantRow[]
}
interface ImageRow { id: string; url: string; alt_text: string | null; is_primary: boolean; order_index: number }
interface VariantRow { id: string; colour: string; colour_hex: string | null; stock: number; image_url: string | null }
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit  = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
  const offset = Number(searchParams.get('offset') ?? '0')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  let q = supabase
    .from('products')
    .select(SELECT, { count: 'exact' })
    .eq('is_active', true)
    .or('show_in_catalogue.eq.true,show_in_catalogue.is.null')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const products = ((data ?? []) as unknown as ProductRow[]).map((r: ProductRow) => {
    const variants = (r.product_variants || []).map((v: VariantRow) => ({
      id: v.id, colour: v.colour, colourHex: v.colour_hex,
      stock: v.stock, imageUrl: v.image_url || null,
    }))
    const images = (r.product_images || [])
      .sort((a: ImageRow, b: ImageRow) => a.order_index - b.order_index)
      .map((i: ImageRow) => ({
        id: i.id, url: i.url, altText: i.alt_text || '',
        isPrimary: i.is_primary, order: i.order_index,
      }))
    const totalStock = variants.reduce((s: number, v: any) => s + (v.stock || 0), 0)
    const createdAt = new Date(r.created_at)
    const isNew = (Date.now() - createdAt.getTime()) < 30 * 86400000

    return {
      id: r.id, name: r.name, slug: r.slug,
      description: r.description || '',
      fabric: r.fabric || '', weaveType: r.weave_type || '',
      originRegion: r.origin_region || '',
      occasion: r.occasion || [],
      careInstructions: r.care_instructions || '',
      blouseIncluded: r.blouse_included || false,
      length: r.length || 5.5, weightGrams: r.weight_grams || 0,
      categoryName: r.categories?.name || '',
      categorySlug: r.categories?.slug || '',
      originalPrice: r.original_price, salePrice: r.sale_price || null,
      discountPercent: r.discount_percent || null,
      gstRate: r.gst_rate || 5,
      images, variants, totalStock, isFeatured: r.is_featured || false,
      isBestseller: r.is_bestseller || false, isNew,
      averageRating: r.average_rating || 0,
      reviewCount: r.review_count || 0,
      videoUrl: r.video_url || null,
    }
  })

  return NextResponse.json({ products, total: count ?? 0 })
}
