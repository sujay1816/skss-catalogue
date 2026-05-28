import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_CATALOGUE_URL || ''
  return {
    rules: { userAgent: '*', allow: '/' },
    ...(baseUrl ? { sitemap: `${baseUrl}/sitemap.xml` } : {}),
  }
}
