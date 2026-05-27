export interface CatalogueVariant {
  id: string
  colour: string
  colourHex: string
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
  isNew: boolean
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
