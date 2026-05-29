// lib/analytics.ts — typed analytics helper (Plausible by default)
//
// To set up Plausible, add NEXT_PUBLIC_PLAUSIBLE_DOMAIN to your .env.local
// and the script tag is already wired in app/layout.tsx.
//
// To swap providers (PostHog, etc.) only this file needs changing — all call
// sites use the typed `track()` function below.

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> }
    ) => void
  }
}

export type AnalyticsEvent =
  | 'occasion_selected'
  | 'first_swipe_right'
  | 'wishlist_3_reached'
  | 'soft_capture_shown'
  | 'soft_capture_submitted'
  | 'book_call_clicked'
  | 'book_call_submitted'

export function track(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
): void {
  try {
    if (typeof window === 'undefined') return
    if (typeof window.plausible === 'function') {
      window.plausible(event, props ? { props } : undefined)
    }
    // Uncomment to debug locally:
    // console.log('[analytics]', event, props)
  } catch {
    // Never let analytics errors surface to the user
  }
}
