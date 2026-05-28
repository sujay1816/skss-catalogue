/** @type {import('next').NextConfig} */

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : '*.supabase.co'

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js inline scripts and eval needed during dev; in prod only 'self'
  "script-src 'self' 'unsafe-inline'",
  // Inline styles are used extensively via React style props
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Fonts from next/font (Google Fonts proxied) and fallback direct
  "font-src 'self' https://fonts.gstatic.com data:",
  // Images from all allowed storage providers
  [
    "img-src 'self' data: blob:",
    "https://res.cloudinary.com",
    "https://*.supabase.co https://*.supabase.in",
    "https://*.amazonaws.com",
    "https://storage.googleapis.com",
    "https://*.imgix.net",
    "https://images.unsplash.com",
  ].join(' '),
  // API calls: own origin + Supabase
  `connect-src 'self' https://${supabaseHost} https://*.supabase.co wss://*.supabase.co`,
  // Iframes: none
  "frame-src 'none'",
  // Workers: none
  "worker-src 'none'",
  // No object/embed
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ')

const nextConfig = {
  images: {
    remotePatterns: [
      // Cloudinary — all regions/subdomains
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Supabase storage
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      // AWS S3 (any region bucket) — narrow this to your specific bucket when known
      { protocol: 'https', hostname: '*.amazonaws.com' },
      // Google Cloud Storage
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      // Imgix
      { protocol: 'https', hostname: '*.imgix.net' },
      // Unsplash (used in testing/seeding)
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',            value: 'DENY' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy',    value: ContentSecurityPolicy },
          { key: 'X-DNS-Prefetch-Control',     value: 'on' },
          { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
