# skss-catalogue

Swipe-to-discover saree catalogue. Customers browse products Tinder-style, shortlist favourites, and book a WhatsApp video call. Built with Next.js 14 App Router, React 18, TypeScript, and Supabase.

## Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Styling:** Inline styles + CSS variables in `globals.css`
- **Fonts:** Cormorant Garamond (headings) + DM Sans (body) via Google Fonts

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in your values
cp .env.local.example .env.local

# 3. Run dev server (port 3002)
npm run dev
```

## Environment variables

See `.env.local.example` for all required variables. Key ones:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | ✅ | WhatsApp number with country code (e.g. `919876543210`) |
| `NEXT_PUBLIC_STOREFRONT_URL` | ✅ | Storefront URL for "Buy Now" links |
| `NEXT_PUBLIC_BRAND_NAME` | — | Static fallback for page title (real value comes from admin `site_config`) |
| `NEXT_PUBLIC_CATALOGUE_URL` | — | Canonical URL for OG meta tags |
| `NEXT_PUBLIC_OG_IMAGE` | — | Image URL for WhatsApp/iMessage link previews |

## Brand config

Logo, brand name, subtitle, and colours are loaded at runtime from the admin `site_config` table — set them in the admin panel, not here. The env vars above are fallbacks for when the DB hasn't loaded yet.

## Supabase — required tables

- `products` + `product_images` + `product_variants` + `categories`
- `occasions` (id, name, slug, image_url, is_active, display_order)
- `flash_sales` + `flash_sale_products`
- `site_config` (key/value pairs for brand settings)
- `catalogue_sessions` (name, phone, wishlist, occasion, device_id, updated_at)

Run `catalogue_sessions_migration.sql` in the Supabase SQL editor if the table doesn't exist.

## Deploy

Deployed on Vercel. Pushes to `main` trigger automatic deploys.

```bash
npm run build   # verify before pushing
npm run lint    # check for lint errors
```
