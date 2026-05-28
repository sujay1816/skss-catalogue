export interface CatalogueVariant {
  id: string
  colour: string
  colourHex: string | null   // FIX-10: was string, DB column is nullable
  stock: number
  imageUrl: string | null
}

export interface CatalogueImage {
  id: string
  url: string
  altText: string
  isPrimary: boolean
  order: number
}

export interface CatalogueProduct {
  id: string
  name: string
  slug: string
  description: string
  fabric: string
  weaveType: string
  originRegion: string
  occasion: string[]
  careInstructions: string
  blouseIncluded: boolean
  length: number
  weightGrams: number
  categoryName: string
  categorySlug: string
  originalPrice: number
  salePrice: number | null
  discountPercent: number | null
  gstRate: number
  images: CatalogueImage[]
  variants: CatalogueVariant[]
  totalStock: number
  isFeatured: boolean
  isBestseller: boolean
  // BUG-9 FIX: isNew was computed server-side inside a cached route (revalidate=60),
  // meaning the badge could lag up to 60 s at the 30-day boundary. We now ship
  // createdAt as a raw ISO string so each client computes isNew at render-time.
  createdAt: string
  averageRating: number
  reviewCount: number
  videoUrl: string | null
}

export interface WishlistItem {
  id: string
  name: string
  slug: string
  image: string
  fabric: string
  categoryName: string
  originalPrice: number
  salePrice: number | null
}
