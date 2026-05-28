/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Cloudinary — all regions/subdomains
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Supabase storage
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      // AWS S3 (any region bucket)
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
          { key: 'X-Content-Type-Options',   value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
