export type SiteConfig = {
  brand_name?: string
  brand_subtitle?: string
  brand_tagline?: string
  logo_url?: string
  whatsapp_number?: string
  color_primary?: string
  color_accent?: string
  color_background?: string
  color_page_bg?: string
  // Hero image shown at the top of the occasion / onboarding screen
  hero_image?: string

  // Catalogue UI text — editable from admin site_config
  catalogue_cta_book_call?: string       // e.g. "Book a Call on WhatsApp"
  catalogue_cta_opening_wa?: string      // e.g. "Opening WhatsApp…"
  catalogue_capture_title?: string       // e.g. "Almost there!"
  catalogue_capture_subtitle?: string    // e.g. "Just your name and number so we know who to expect on WhatsApp."
  catalogue_capture_privacy?: string     // e.g. "We use this only to contact you about your shortlist. We never share your details."
  catalogue_occasion_eyebrow?: string    // e.g. "Curated for you"
  catalogue_occasion_heading?: string    // e.g. "What are you shopping for?"
  catalogue_occasion_subtext?: string    // e.g. "We'll show you the most relevant sarees first"
  catalogue_occasion_browse_all?: string // e.g. "Browse all sarees"
  catalogue_wishlist_title?: string      // e.g. "Your Shortlist"
  catalogue_wishlist_empty_title?: string   // e.g. "Nothing saved yet"
  catalogue_wishlist_empty_body?: string    // e.g. "Swipe right or tap the heart on any saree to save it here"
  catalogue_wa_message_template?: string    // e.g. "{greeting}{occLine}\n\nI browsed your saree catalogue and shortlisted:\n\n{list}\n\nTotal: {total}\n\nCan we schedule a video call to see these in detail?"
  catalogue_meta_title?: string             // e.g. "Swipe & Discover"
  catalogue_meta_description?: string       // e.g. "Browse our handpicked saree collection. Swipe to save your favourites, then book a personal video call."
}

export type Occasion = { id: string; name: string; slug: string; image_url: string }

export type FlashSale = {
  id: string
  title: string
  ends_at: string
  saleMap: Record<string, number>
} | null
