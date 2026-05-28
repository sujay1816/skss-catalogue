export type SiteConfig = {
  brand_name?: string
  brand_subtitle?: string
  brand_tagline?: string
  logo_url?: string
  whatsapp_number?: string
  color_primary?: string
  color_accent?: string
}

export type Occasion = { id: string; name: string; slug: string; image_url: string }

export type FlashSale = {
  id: string
  title: string
  ends_at: string
  saleMap: Record<string, number>
} | null
