'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { CatalogueProduct, WishlistItem } from '@/types'
import type { SiteConfig, Occasion, FlashSale } from './types'

import { Logo }              from './components/Logo'
import { Countdown }         from './components/Countdown'
import { OccasionScreen }    from './components/OccasionScreen'
import { TinderCard }        from './components/TinderCard'
import { DetailSheet }       from './components/DetailSheet'
import { WishlistScreen }    from './components/WishlistScreen'
import { PhoneCaptureSheet } from './components/PhoneCaptureSheet'

// ─── Constants ────────────────────────────────────────────────────────────────
const UNDO_MS = 3500
const ONBOARD_EXPIRY_DAYS = 30   // FIX-7: expiry for onboarding
const BUDGETS = [
  { label: 'All',        min: 0,     max: Infinity },
  { label: 'Under ₹10K', min: 0,     max: 9999     },
  { label: '₹10K–₹25K', min: 10000, max: 24999     },
  { label: 'Above ₹25K', min: 25000, max: Infinity  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt     = (n: number) => '₹' + n.toLocaleString('en-IN')
const imgOf   = (p: CatalogueProduct) => (p.images.find(i => i.isPrimary) || p.images[0])?.url || ''
const priceOf = (p: CatalogueProduct) => p.salePrice ?? p.originalPrice

const toWL = (p: CatalogueProduct): WishlistItem => ({
  id: p.id, name: p.name, slug: p.slug, image: imgOf(p),
  fabric: p.fabric, categoryName: p.categoryName,
  originalPrice: p.originalPrice, salePrice: p.salePrice,
})

function getDeviceId(): string {
  try {
    let id = localStorage.getItem('skss_device_id')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('skss_device_id', id) }
    return id
  } catch { return 'unknown' }
}

// FIX-7: timestamp-based onboard check (30-day expiry)
function shouldShowOnboard(): boolean {
  try {
    const ts = localStorage.getItem('skss_onboarded_at')
    if (!ts) return true
    const age = Date.now() - parseInt(ts, 10)
    return age > ONBOARD_EXPIRY_DAYS * 86400000
  } catch { return true }
}

// FIX-3: slot injected into WA message
function buildWA(items: WishlistItem[], waNum: string, customerName?: string, occasion?: string | null, template?: string, slot?: string) {
  const total    = items.reduce((s, it) => s + (it.salePrice ?? it.originalPrice), 0)
  const list     = items.map((it, i) => `${i + 1}. ${it.name} — ${fmt(it.salePrice ?? it.originalPrice)}`).join('\n')
  const greeting = customerName ? `Hi, I'm ${customerName}.` : 'Hi!'
  const occLine  = occasion ? `\nShopping for: ${occasion}` : ''
  const slotLine = slot ? `\nPreferred call time: ${slot}` : ''
  const msg = template
    ? template
        .replace('{greeting}', greeting)
        .replace('{occLine}', occLine)
        .replace('{slotLine}', slotLine)   // FIX-4: slot in template path too
        .replace('{list}', list)
        .replace('{total}', fmt(total))
    : `${greeting}${occLine}${slotLine}\n\nI browsed your saree catalogue and shortlisted:\n\n${list}\n\nTotal: ${fmt(total)}\n\nCan we schedule a video call to see these in detail?`
  return `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`
}

// FIX-4: tag-weight scoring for deck personalisation
function scoreProduct(p: CatalogueProduct, weights: { fabrics: Record<string, number>; occasions: Record<string, number>; maxPrice: number; minPrice: number }): number {
  let score = 0
  // FIX-9: normalise to lowercase so "Silk" and "silk" score the same
  const fabricKey = p.fabric?.toLowerCase() || ''
  if (fabricKey && weights.fabrics[fabricKey]) score += weights.fabrics[fabricKey] * 3
  for (const occ of p.occasion || []) {
    const occKey = occ.toLowerCase()
    if (weights.occasions[occKey]) score += weights.occasions[occKey] * 2
  }
  const avgPrice = (weights.maxPrice + weights.minPrice) / 2 || 0
  if (avgPrice > 0) {
    const dist = Math.abs(priceOf(p) - avgPrice) / Math.max(avgPrice, 1)
    score += Math.max(0, 1 - dist)
  }
  return score
}

// FIX-2: fetch with AbortController timeout
async function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  const ctrl = new AbortController()
  const id   = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(id)
    return res
  } catch (e) {
    clearTimeout(id)
    throw e
  }
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard({ w, h }: { w: number; h: number }) {
  return (
    <div style={{ position: 'absolute', width: w, height: h, borderRadius: 16, overflow: 'hidden', background: '#1a1008' }}>
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s infinite' }}/>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px' }}>
        <div style={{ height: 28, width: '65%', background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 10 }}/>
        <div style={{ height: 16, width: '40%', background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 10 }}/>
        <div style={{ height: 24, width: '30%', background: 'rgba(201,168,76,0.15)', borderRadius: 4 }}/>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CataloguePage() {
  const pendingSavedRef   = useRef<string[] | null>(null)
  const longPressRef      = useRef<number>(0)
  const syncTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stackRef          = useRef<HTMLDivElement>(null)
  const labelsShownRef    = useRef(false)
  const pillShownRef      = useRef(false)  // FIX-16: one-time pill animation
  const currentIdxRef     = useRef(0)      // FIX-2+3: stable idx for loadMore's rerankDeck call

  // FIX-4: affinity weights updated on each right-swipe
  const affinityRef = useRef<{ fabrics: Record<string, number>; occasions: Record<string, number>; maxPrice: number; minPrice: number }>({
    fabrics: {}, occasions: {}, maxPrice: 0, minPrice: Infinity,
  })

  const [allProducts,    setAllProducts]    = useState<CatalogueProduct[]>([])
  const [config,         setConfig]         = useState<SiteConfig>({})
  const [occasions,      setOccasions]      = useState<Occasion[]>([])
  const [flashSale,      setFlashSale]      = useState<FlashSale>(null)
  const [loading,        setLoading]        = useState(true)
  const [slowLoad,       setSlowLoad]       = useState(false)
  const [loadError,      setLoadError]      = useState(false)
  const [occasionsLoaded, setOccasionsLoaded] = useState(false)  // FIX-6: guard auto-dismiss
  const [showOnboard,    setShowOnboard]    = useState(shouldShowOnboard)  // FIX-7
  const [idx,            setIdx]            = useState(0)
  const [wishlist,       setWishlist]       = useState<WishlistItem[]>([])
  const [seenIds,        setSeenIds]        = useState<Set<string>>(new Set())
  const [detail,         setDetail]         = useState<CatalogueProduct | null>(null)
  const [showWL,         setShowWL]         = useState(false)
  const [undoSkip,       setUndoSkip]       = useState<{ p: CatalogueProduct; t: ReturnType<typeof setTimeout> } | null>(null)
  const [undoRm,         setUndoRm]         = useState<{ it: WishlistItem; t: ReturnType<typeof setTimeout> } | null>(null)
  const [dragProg,       setDragProg]       = useState(0)
  const [showCapture,    setShowCapture]    = useState(false)
  const [savedToast,     setSavedToast]     = useState('')
  const [sharedToast,    setSharedToast]    = useState('')
  const [undoHintShown,  setUndoHintShown]  = useState(false)
  const [undoHintActive, setUndoHintActive] = useState(false)
  const [showBtnLabels,  setShowBtnLabels]  = useState(true)
  const [totalProducts,  setTotalProducts]  = useState(0)
  const [loadingMore,    setLoadingMore]    = useState(false)
  const [catFilter,      setCatFilter]      = useState('All')
  const [budgetIdx,      setBudgetIdx]      = useState(0)
  const [occasionFilter, setOccasionFilter] = useState<string | null>(null)
  const [showMoreCats,   setShowMoreCats]   = useState(false)
  const [dims,           setDims]           = useState({ w: 340, h: 520 })
  // FIX-4: ranked product deck
  const [rankedProducts, setRankedProducts] = useState<CatalogueProduct[]>([])

  const waNum    = config.whatsapp_number || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
  const brandCss = [
    config.color_primary ? `--crimson:${config.color_primary};--crimson-dark:${config.color_primary}` : '',
    config.color_accent  ? `--gold:${config.color_accent};--gold-light:${config.color_accent}` : '',
  ].filter(Boolean).join(';')

  const categories = ['All', ...Array.from(new Set(allProducts.map(p => p.categoryName).filter(Boolean)))]

  // Base filter (category + budget + occasion)
  const filteredProducts = allProducts.filter(p => {
    const catOk    = catFilter === 'All' || p.categoryName === catFilter
    const b        = BUDGETS[budgetIdx]
    const price    = priceOf(p)
    const budgetOk = price >= b.min && price <= b.max
    const occOk    = !occasionFilter || (p.occasion || []).includes(occasionFilter)
    return catOk && budgetOk && occOk
  })

  // FIX-4: use ranked deck when affinity is built, otherwise use filtered order
  const products = rankedProducts.length > 0
    ? rankedProducts.filter(p => filteredProducts.some(fp => fp.id === p.id))
    : filteredProducts

  const stack       = products.slice(idx, idx + 3)
  const isDone      = !loading && idx >= products.length
  const canLoadMore = isDone && allProducts.length < totalProducts && products.length === allProducts.length

  // FIX-2+3: re-rank only the UNSEEN tail (idx+1 onward) so cards already in
  // the visible stack never jump. Takes current idx so it knows the cut point.
  // FIX-1+2: rerankDeck now receives the already-filtered list so the head/tail
  // cut is based on position in the FILTERED view (which matches idx), not the
  // full allProducts array. Caller passes filteredProducts, not allProducts.
  const rerankDeck = useCallback((filtered: CatalogueProduct[], currentIdx: number) => {
    const aff = affinityRef.current
    const hasAffinity = Object.keys(aff.fabrics).length > 0 || Object.keys(aff.occasions).length > 0
    if (!hasAffinity) { setRankedProducts([]); return }

    // head = cards already seen or currently on screen — order stays fixed
    // tail = everything from currentIdx+1 onward — reordered by affinity score
    const head       = filtered.slice(0, currentIdx + 1)
    const tail       = filtered.slice(currentIdx + 1)
    const sortedTail = [...tail].sort((a, b) => scoreProduct(b, aff) - scoreProduct(a, aff))
    setRankedProducts([...head, ...sortedTail])
  }, [])

  // Card dimensions
  useEffect(() => {
    const calc = () => {
      const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10) || 0
      const w = Math.min(window.innerWidth, 480) - 32
      const usedH = 280 + safeTop
      const h = Math.min(window.innerHeight - usedH, w * 1.48)
      setDims({ w: Math.round(w), h: Math.round(Math.max(h, 380)) })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  useEffect(() => { setIdx(0); setRankedProducts([]) }, [catFilter, budgetIdx, occasionFilter])  // FIX-5: clear ranked order on filter change
  useEffect(() => { currentIdxRef.current = idx }, [idx])  // FIX-2+3: keep ref in sync

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setSlowLoad(true), 2000)
    return () => clearTimeout(t)
  }, [loading])

  useEffect(() => {
    if (!labelsShownRef.current && idx > 0) {
      labelsShownRef.current = true
      const t = setTimeout(() => setShowBtnLabels(false), 800)
      return () => clearTimeout(t)
    }
  }, [idx])

  // FIX-2 + FIX-6: two-wave fetch — config/occasions first, products second
  useEffect(() => {
    let cancelled = false

    // Wave 1: config + occasions (fast) → renders occasion screen immediately
    Promise.allSettled([
      fetchWithTimeout('/api/config').then(r => r.json()).catch(() => ({})),
      fetchWithTimeout('/api/occasions').then(r => r.json()).catch(() => []),
    ]).then(([cfgRes, occRes]) => {
      if (cancelled) return
      if (cfgRes.status === 'fulfilled') setConfig(cfgRes.value || {})
      if (occRes.status === 'fulfilled') setOccasions(occRes.value || [])
      setOccasionsLoaded(true)  // FIX-6: signal that occasions fetch is done
    })

    // Wave 2: products + flash-sales (heavier) — updates deck once ready
    Promise.allSettled([
      fetchWithTimeout('/api/products?limit=80').then(r => r.json()),
      fetchWithTimeout('/api/flash-sales').then(r => r.json()).catch(() => null),
    ]).then(([pdRes, flashRes]) => {
      if (cancelled) return
      if (pdRes.status === 'fulfilled') {
        const pd = pdRes.value
        setAllProducts(pd.products || [])
        setTotalProducts(pd.total || 0)
      } else {
        setLoadError(true)
      }
      if (flashRes.status === 'fulfilled') setFlashSale(flashRes.value || null)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    try { const s = localStorage.getItem('skss_wl'); if (s) setWishlist(JSON.parse(s)) } catch {}
    try { const occ = localStorage.getItem('skss_occasion'); if (occ) setOccasionFilter(occ) } catch {}
    const params = new URLSearchParams(window.location.search)
    const saved  = params.get('saved')
    if (saved) pendingSavedRef.current = saved.split(',')
  }, [])

  useEffect(() => {
    if (!pendingSavedRef.current || allProducts.length === 0) return
    const tokens   = pendingSavedRef.current
    const matching = allProducts.filter(p => tokens.includes(p.id) || tokens.includes(p.slug))
    if (matching.length > 0) {
      setWishlist(prev => {
        const existingIds = new Set(prev.map(it => it.id))
        return [...prev, ...matching.filter(p => !existingIds.has(p.id)).map(toWL)]
      })
      setSharedToast(`${matching.length} saree${matching.length !== 1 ? 's' : ''} shared with you`)
      setTimeout(() => setSharedToast(''), 3500)
    }
    pendingSavedRef.current = null
    try { window.history.replaceState({}, '', '/catalogue') } catch {}
  }, [allProducts])

  useEffect(() => {
    try { localStorage.setItem('skss_wl', JSON.stringify(wishlist)) } catch {}
  }, [wishlist])

  useEffect(() => {
    if (wishlist.length === 0) return
    const name  = typeof window !== 'undefined' ? localStorage.getItem('skss_customer_name') : null
    const phone = typeof window !== 'undefined' ? localStorage.getItem('skss_customer_phone') : null
    if (!name || !phone) return
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      fetch('/api/catalogue-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, wishlist, device_id: getDeviceId() }),
      }).catch(() => {})
    }, 3000)
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }
  }, [wishlist])

  const loved  = useCallback((id: string) => wishlist.some(it => it.id === id), [wishlist])
  const save   = useCallback((p: CatalogueProduct) => {
    setWishlist(prev => prev.find(it => it.id === p.id) ? prev : [...prev, toWL(p)])
  }, [])
  const remove = useCallback((id: string) => {
    const it = wishlist.find(x => x.id === id); if (!it) return
    setWishlist(prev => prev.filter(x => x.id !== id))
    if (undoRm) clearTimeout(undoRm.t)
    setUndoRm({ it, t: setTimeout(() => setUndoRm(null), UNDO_MS) })
  }, [wishlist, undoRm])

  const swipe = useCallback((dir: 1 | -1) => {
    const p = products[idx]; if (!p) return
    if (dir === 1) {
      save(p)
      if (undoSkip) { clearTimeout(undoSkip.t); setUndoSkip(null) }

      // FIX-1+2+9: write affinity weights (lowercase keys for case-consistent matching)
      // and re-rank only the unseen tail every 3rd save.
      // Pass filteredProducts so the head/tail cut lines up with idx in the filtered view.
      const aff = affinityRef.current
      const fabricKey = p.fabric?.toLowerCase() || ''
      if (fabricKey) aff.fabrics[fabricKey] = (aff.fabrics[fabricKey] || 0) + 1
      for (const occ of p.occasion || []) {
        const occKey = occ.toLowerCase()
        aff.occasions[occKey] = (aff.occasions[occKey] || 0) + 1
      }
      const price = priceOf(p)
      aff.maxPrice = Math.max(aff.maxPrice, price)
      aff.minPrice = Math.min(aff.minPrice === Infinity ? price : aff.minPrice, price)
      const rightSwipes = Object.values(aff.fabrics).reduce((a, b) => a + b, 0)
      if (rightSwipes % 3 === 0) rerankDeck(filteredProducts, idx)

      // FIX-10: double-pulse haptic for save
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([10, 50, 10])
    } else {
      // FIX-10: single pulse for skip
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
      if (!undoHintShown) {
        setUndoHintShown(true); setUndoHintActive(true)
        setTimeout(() => setUndoHintActive(false), 2500)
      }
      if (undoSkip) clearTimeout(undoSkip.t)
      setUndoSkip({ p, t: setTimeout(() => setUndoSkip(null), UNDO_MS) })
    }
    setSeenIds(prev => new Set([...prev, p.id]))
    // FIX-13: truncate product name in toast
    if (dir === 1) {
      const name = p.name.length > 28 ? p.name.slice(0, 28) + '…' : p.name
      setSavedToast(name); setTimeout(() => setSavedToast(''), 1800)
    }
    setDragProg(0); setIdx(i => i + 1)
  }, [products, idx, save, undoSkip, undoHintShown, rerankDeck, filteredProducts])

  // FIX-4: always show the capture sheet so returning users can pick a slot.
  // PhoneCaptureSheet pre-fills name/phone from localStorage so it is not extra friction.
  const handleBookCall = useCallback(() => {
    if (wishlist.length === 0 || !waNum) return
    setShowCapture(true)
  }, [wishlist, waNum])

  // FIX-3: slot param added, saved to session + injected into WA message
  const handleCaptureSubmit = useCallback((name: string, phone: string, slot?: string) => {
    const digits      = phone.replace(/\D/g, '')
    const storedPhone = digits.startsWith('91') ? digits : `91${digits}`
    localStorage.setItem('skss_customer_name', name)
    localStorage.setItem('skss_customer_phone', storedPhone)
    fetch('/api/catalogue-session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone: storedPhone, wishlist, device_id: getDeviceId(), occasion: occasionFilter ?? null, preferred_slot: slot ?? null }),
    }).catch(() => {})
    window.open(buildWA(wishlist, waNum, name, occasionFilter, config.catalogue_wa_message_template, slot), '_blank', 'noopener,noreferrer')
  }, [wishlist, waNum, occasionFilter, config.catalogue_wa_message_template])

  const btnSwipe = useCallback((dir: 1 | -1) => {
    const el = stackRef.current?.querySelector<HTMLElement>('[data-top-card]')
    if (el) {
      const stamp = el.querySelector<HTMLElement>(dir === 1 ? '.s-like' : '.s-nope')
      if (stamp) { stamp.style.opacity = '1' }
      setTimeout(() => {
        el.style.transition = 'transform 0.35s ease, opacity 0.3s ease'
        el.style.transform  = `translate(${dir * (dims.w + 300)}px, 0) rotate(${dir * 28}deg)`
        el.style.opacity    = '0'
        setTimeout(() => swipe(dir), 320)
      }, 120)
    } else swipe(dir)
  }, [dims.w, swipe])

  const loadMore = useCallback(async () => {
    if (loadingMore || allProducts.length >= totalProducts) return
    setLoadingMore(true)
    try {
      const res = await fetchWithTimeout(`/api/products?limit=40&offset=${allProducts.length}`)
      const pd  = await res.json()
      if (pd.products?.length > 0) {
        setAllProducts(prev => {
          const ids    = new Set(prev.map(p => p.id))
          const merged = [...prev, ...pd.products.filter((p: CatalogueProduct) => !ids.has(p.id))]
          // Rerank after state settles — setTimeout lets the new filteredProducts be computed first
          setTimeout(() => rerankDeck(
            merged.filter(p => {
              const b = BUDGETS[budgetIdx]
              const price = p.salePrice ?? p.originalPrice
              const catOk    = catFilter === 'All' || p.categoryName === catFilter
              const budgetOk = price >= b.min && price <= b.max
              const occOk    = !occasionFilter || (p.occasion || []).includes(occasionFilter)
              return catOk && budgetOk && occOk
            }),
            currentIdxRef.current
          ), 0)
          return merged
        })
      }
    } catch {}
    setLoadingMore(false)
  }, [loadingMore, allProducts.length, totalProducts, rerankDeck, catFilter, budgetIdx, occasionFilter])

  // FIX-7: timestamp-based onboard save
  const handleOccasionSelect = useCallback((slug: string | null) => {
    if (slug) {
      const matchingOcc = occasions.find(o => o.slug === slug)
      if (matchingOcc) {
        const occName  = matchingOcc.name
        const hasExact = allProducts.some(p => (p.occasion || []).includes(occName))
        if (hasExact) {
          setOccasionFilter(occName)
          try { localStorage.setItem('skss_occasion', occName) } catch {}
        } else {
          const lc    = occName.toLowerCase()
          const match = allProducts.flatMap(p => p.occasion || []).find(t => t.toLowerCase() === lc || t.toLowerCase().includes(lc))
          if (match) {
            setOccasionFilter(match)
            try { localStorage.setItem('skss_occasion', match) } catch {}
          }
        }
      }
    } else {
      try { localStorage.removeItem('skss_occasion') } catch {}
    }
    // FIX-7: store timestamp instead of boolean
    try { localStorage.setItem('skss_onboarded_at', String(Date.now())) } catch {}
    setShowOnboard(false)
  }, [occasions, allProducts])

  const openDetailById = useCallback((id: string) => {
    const p = allProducts.find(x => x.id === id)
    if (p) { setShowWL(false); setTimeout(() => setDetail(p), 50) }
  }, [allProducts])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (detail || showWL || showCapture || showOnboard) return
      if (e.key === 'ArrowRight')     btnSwipe(1)
      else if (e.key === 'ArrowLeft') btnSwipe(-1)
      else if (e.key === 'Enter' && products[idx]) setDetail(products[idx])
      else if (e.key === 'Escape')    { setDetail(null); setShowWL(false) }
      else if ((e.key === 'z' || e.key === 'Z') && undoSkip) {
        clearTimeout(undoSkip.t); setIdx(i => Math.max(0, i - 1)); setUndoSkip(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [btnSwipe, detail, showWL, showCapture, showOnboard, products, idx, undoSkip])

  const safeAreaStyle = `
    :root { --sat: env(safe-area-inset-top, 0px); }
    * { box-sizing: border-box; }
    @keyframes sheetUp{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}
    @keyframes floatIn{from{opacity:0;transform:translateX(-50%) translateY(12px) scale(0.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
    @keyframes pulse{0%,80%,100%{opacity:0.3;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}
    @keyframes btnLabelFade{0%,70%{opacity:1}100%{opacity:0}}
    @keyframes pillAppear{from{opacity:0;transform:translateX(-50%) translateY(12px) scale(0.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
  `

  // ── Error ──────────────────────────────────────────────────────────────────
  if (loadError) return (
    <div style={{ position: 'fixed', inset: 0, background: '#080502', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
      {config.logo_url ? <img src={config.logo_url} alt="logo" style={{ width: 52, height: 52, objectFit: 'contain', opacity: 0.7 }}/> : <svg width="44" height="44" viewBox="0 0 34 34" fill="none"><circle cx="17" cy="17" r="15" fill="rgba(139,26,43,0.2)" stroke="rgba(201,168,76,0.4)" strokeWidth="1"/><line x1="10" y1="10" x2="24" y2="24" stroke="#f87171" strokeWidth="2" strokeLinecap="round"/><line x1="24" y1="10" x2="10" y2="24" stroke="#f87171" strokeWidth="2" strokeLinecap="round"/></svg>}
      <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 400, color: '#fff', marginBottom: 8 }}>Couldn&apos;t load the catalogue</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>Check your connection and try again.</p>
      <button onClick={() => { setLoadError(false); setLoading(true); window.location.reload() }} style={{ marginTop: 8, padding: '12px 32px', background: 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.4)', borderRadius: 12, color: 'var(--gold, #C9A84C)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Try again</button>
    </div>
  )

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#080502', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <style>{safeAreaStyle}</style>
      {config.logo_url
        ? <img src={config.logo_url} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain', opacity: 0.9 }}/>
        : <svg width="52" height="52" viewBox="0 0 34 34" fill="none"><circle cx="17" cy="17" r="15" fill="rgba(139,26,43,0.2)" stroke="rgba(201,168,76,0.5)" strokeWidth="1"/><path d="M17 7C21 7 25 10 25 15C25 20 21 23 17 25C17 25 13 23 11 20C9 17 10 12 13 10C14.5 8.5 15.8 7 17 7Z" fill="rgba(139,26,43,0.7)" stroke="#C9A84C" strokeWidth="0.8"/><circle cx="17" cy="11" r="2" fill="#C9A84C"/></svg>
      }
      <div style={{ position: 'relative', width: dims.w, height: dims.h }}>
        <div style={{ position: 'absolute', width: dims.w, height: dims.h, borderRadius: 16, background: 'rgba(255,255,255,0.03)', transform: 'translateY(14px) scale(0.95)', transformOrigin: 'center bottom' }}/>
        <SkeletonCard w={dims.w} h={dims.h}/>
      </div>
      {slowLoad && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5 }}>Loading catalogue…</p>}
    </div>
  )

  if (showOnboard) return <OccasionScreen occasions={occasions} config={config} occasionsLoaded={occasionsLoaded} onSelect={handleOccasionSelect}/>

  // ── Main catalogue ──────────────────────────────────────────────────────────
  return (
    <>
      {brandCss && <style>{`:root{${brandCss}}`}</style>}
      <style>{safeAreaStyle}</style>
      {/* FIX-12: filter bar fade mask via global style */}
      <style>{`
        .filter-bar-wrap { position: relative; }
        .filter-bar-wrap::after {
          content: '';
          position: absolute;
          right: 0; top: 0; bottom: 0;
          width: 40px;
          background: linear-gradient(to right, transparent, #0d0805);
          pointer-events: none;
        }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, background: '#080502', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 480, height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0805', overflow: 'hidden' }}>

          {/* Top bar */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top, 12px) + 36px) 20px 12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <button
                onPointerDown={() => { longPressRef.current = Date.now() }}
                onPointerUp={() => {
                  if (Date.now() - longPressRef.current > 600) {
                    try { localStorage.removeItem('skss_onboarded_at'); localStorage.removeItem('skss_occasion') } catch {}
                    setOccasionFilter(null); setShowOnboard(true)
                  }
                }}
                onClick={() => {}}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'default', textAlign: 'left' }}
                title="Hold to change occasion"
              >
                <Logo config={config}/>
              </button>
              {/* FIX-11: occasion chip taps to open screen (not just clear) */}
              {occasionFilter && (
                <button
                  onClick={() => {
                    // FIX-11: tap chip → reopen occasion screen
                    try { localStorage.removeItem('skss_onboarded_at') } catch {}
                    setShowOnboard(true)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, padding: '2px 8px', cursor: 'pointer', width: 'fit-content' }}
                >
                  <span style={{ fontSize: 10, color: 'var(--gold, #C9A84C)', fontWeight: 500 }}>{occasionFilter}</span>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--gold, #C9A84C)" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              )}
            </div>

            <button onClick={() => setShowWL(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, padding: '8px 16px 8px 12px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={wishlist.length > 0 ? '#F87171' : 'none'} stroke={wishlist.length > 0 ? '#F87171' : 'rgba(255,255,255,0.7)'} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              Saved
              {wishlist.length > 0 && <span style={{ background: 'var(--crimson, #8B1A2B)', color: '#fff', borderRadius: '50%', minWidth: 20, height: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{wishlist.length}</span>}
            </button>
          </div>

          {/* Flash sale banner */}
          {flashSale && !isDone && (
            <div style={{ flexShrink: 0, margin: '0 16px 8px', background: 'rgba(220,38,38,0.13)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: 12, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#f87171', fontWeight: 600 }}>⏱ {flashSale.title}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Ends in <Countdown endsAt={flashSale.ends_at}/></span>
            </div>
          )}

          {/* FIX-12: filter bar with fade mask wrapper */}
          <div className="filter-bar-wrap" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 7, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
              {(showMoreCats ? categories : categories.slice(0, 5)).map(cat => (
                <button key={cat} onClick={() => setCatFilter(cat)} style={{ flexShrink: 0, borderRadius: 20, padding: '5px 13px', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', border: catFilter === cat ? '1.5px solid var(--gold, #C9A84C)' : '1px solid rgba(255,255,255,0.12)', background: catFilter === cat ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.04)', color: catFilter === cat ? 'var(--gold, #C9A84C)' : 'rgba(255,255,255,0.45)', transition: 'all 0.15s' }}>{cat}</button>
              ))}
              {categories.length > 5 && (
                <button onClick={() => setShowMoreCats(v => !v)} style={{ flexShrink: 0, borderRadius: 20, padding: '5px 10px', fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {showMoreCats ? '↑ less' : `+${categories.length - 5} more`}
                </button>
              )}
              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }}/>
              {BUDGETS.slice(1).map((b, i) => (
                <button key={b.label} onClick={() => setBudgetIdx(budgetIdx === i + 1 ? 0 : i + 1)} style={{ flexShrink: 0, borderRadius: 20, padding: '5px 13px', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', border: budgetIdx === i + 1 ? '1.5px solid rgba(139,26,43,0.7)' : '1px solid rgba(255,255,255,0.12)', background: budgetIdx === i + 1 ? 'rgba(139,26,43,0.2)' : 'rgba(255,255,255,0.04)', color: budgetIdx === i + 1 ? '#F8A3AF' : 'rgba(255,255,255,0.45)', transition: 'all 0.15s' }}>{b.label}</button>
              ))}
              {(catFilter !== 'All' || budgetIdx > 0 || occasionFilter) && (
                <button onClick={() => { setCatFilter('All'); setBudgetIdx(0); setOccasionFilter(null) }} style={{ flexShrink: 0, borderRadius: 20, padding: '5px 10px', fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  {products.length}
                </button>
              )}
              {/* padding right so last chip isn't hidden behind fade mask */}
              <div style={{ width: 32, flexShrink: 0 }}/>
            </div>
          </div>

          {(catFilter !== 'All' || budgetIdx > 0 || occasionFilter) && !isDone && (
            <div style={{ flexShrink: 0, padding: '0 16px 8px' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.3 }}>Showing {products.length} of {allProducts.length} sarees</p>
            </div>
          )}

          {/* Card stack */}
          <div ref={stackRef} style={{ flexShrink: 0, height: dims.h + 28, overflow: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', position: 'relative' }}>
            {isDone ? (
              <div style={{ width: dims.w, height: dims.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 56 }}>🥻</div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 400, color: '#fff' }}>
                  {products.length === 0 ? (occasionFilter ? `No sarees found for "${occasionFilter}"` : 'No sarees match your filters') : "You've seen everything!"}
                </h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  {products.length === 0
                    ? (occasionFilter ? 'Try a different occasion or browse all sarees.' : 'Try removing a filter.')
                    : wishlist.length > 0 ? `${wishlist.length} saree${wishlist.length !== 1 ? 's' : ''} shortlisted.` : 'Browse again to save favourites.'}
                </p>
                {products.length === 0 && occasionFilter && <button onClick={() => setOccasionFilter(null)} style={{ padding: '12px 0', width: '100%', background: 'rgba(201,168,76,0.12)', border: '1.5px solid rgba(201,168,76,0.35)', borderRadius: 13, color: 'var(--gold, #C9A84C)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>{config.catalogue_occasion_browse_all || 'Browse all sarees'}</button>}
                {products.length === 0 && <button onClick={() => { setCatFilter('All'); setBudgetIdx(0); setOccasionFilter(null) }} style={{ padding: '12px 0', width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 13, color: '#fff', fontSize: 14, cursor: 'pointer' }}>Clear all filters</button>}
                {wishlist.length > 0 && <button onClick={() => setShowWL(true)} style={{ padding: '13px 0', width: '100%', background: 'linear-gradient(135deg,var(--crimson, #8B1A2B),var(--crimson-dark, #6B1220))', border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>View shortlist & Book a call</button>}
                {products.length > 0 && <button onClick={() => { setIdx(0); setSeenIds(new Set()) }} style={{ padding: '11px 0', width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>Browse again</button>}
                {canLoadMore && (
                  <button onClick={async () => { await loadMore(); setIdx(0) }} disabled={loadingMore}
                    style={{ padding: '13px 0', width: '100%', background: loadingMore ? 'rgba(201,168,76,0.1)' : 'rgba(201,168,76,0.15)', border: '1.5px solid rgba(201,168,76,0.4)', borderRadius: 14, color: 'var(--gold, #C9A84C)', fontSize: 14, fontWeight: 600, cursor: loadingMore ? 'default' : 'pointer' }}>
                    {loadingMore ? 'Loading more sarees…' : `Load more · ${totalProducts - allProducts.length} remaining`}
                  </button>
                )}
              </div>
            ) : (
              ([...stack] as CatalogueProduct[]).reverse().map((p: CatalogueProduct, ri: number) => {
                const si = stack.length - 1 - ri
                return (
                  <TinderCard
                    key={p.id} product={p} stackIndex={si} isTop={si === 0}
                    dragProgress={dragProg} onSwipe={swipe} onTap={() => setDetail(p)}
                    onDragProgress={si === 0 ? setDragProg : () => {}}
                    cardW={dims.w} cardH={dims.h} flashSale={flashSale}
                    wasSeen={seenIds.has(p.id)} isFirstCard={idx === 0 && si === 0}
                    isLoved={loved(p.id)}
                    onToggleSave={() => loved(p.id) ? remove(p.id) : save(p)}
                  />
                )
              })
            )}
          </div>

          {/* Progress bar — FIX-15: uses CSS variable */}
          {!isDone && products.length > 0 && idx > 0 && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '8px 16px' }}>
              <div style={{ height: 3, flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((idx / Math.max(products.length, 1)) * 100)}%`, background: 'var(--gold, #C9A84C)', borderRadius: 2, transition: 'width 0.3s ease' }}/>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginLeft: 10, flexShrink: 0 }}>{products.length - idx} left</span>
            </div>
          )}

          {/* FIX-16: WhatsApp pill — animation only on first appearance */}
          {wishlist.length >= 1 && !showWL && !detail && waNum && !isDone && (
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', paddingBottom: 6 }}>
              <button onClick={handleBookCall}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#25D366', border: 'none', borderRadius: 28, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(37,211,102,0.45)',
                  // FIX-16: animate only once when first shown
                  animation: pillShownRef.current ? 'none' : 'pillAppear 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
                }}
                ref={el => { if (el && !pillShownRef.current) pillShownRef.current = true }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Book a call · {wishlist.length} saved · {fmt(wishlist.reduce((s, it) => s + (it.salePrice ?? it.originalPrice), 0))}
              </button>
            </div>
          )}

          {/* Action buttons */}
          {!isDone && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 14, padding: '2px 0 20px', position: 'relative' }}>
              {undoHintActive && (
                <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, background: 'rgba(251,191,36,0.95)', borderRadius: 20, padding: '6px 14px', whiteSpace: 'nowrap', pointerEvents: 'none', animation: 'floatIn 0.3s ease' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1008' }}>Tap ↩ to undo that skip</p>
                </div>
              )}

              {[
                { label: 'Undo', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.14"/></svg>, onClick: () => { if (undoSkip) { clearTimeout(undoSkip.t); setIdx(i => Math.max(0, i - 1)); setUndoSkip(null) } }, disabled: !undoSkip, size: 46, style: { background: undoSkip ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)', border: undoSkip ? '1.5px solid rgba(251,191,36,0.5)' : '1.5px solid rgba(255,255,255,0.08)', color: undoSkip ? '#FBBF24' : 'rgba(255,255,255,0.2)' }, ariaLabel: 'Undo skip' },
                { label: 'Skip', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>, onClick: () => btnSwipe(-1), disabled: false, size: 64, style: { background: '#fff', border: 'none', color: '#F87171', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }, ariaLabel: 'Skip this saree' },
                { label: 'Save', icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, onClick: () => btnSwipe(1), disabled: false, size: 64, style: { background: '#fff', border: 'none', color: '#4ade80', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }, ariaLabel: 'Save to shortlist' },
                { label: 'Details', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, onClick: () => products[idx] && setDetail(products[idx]), disabled: false, size: 46, style: { background: 'rgba(139,26,43,0.12)', border: '1.5px solid rgba(139,26,43,0.35)', color: '#F87171' }, ariaLabel: 'View saree details' },
              ].map(btn => (
                <div key={btn.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <button
                    aria-label={btn.ariaLabel}
                    onClick={btn.onClick}
                    disabled={btn.disabled}
                    style={{ width: btn.size, height: btn.size, borderRadius: '50%', cursor: btn.disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0, ...btn.style }}
                  >
                    {btn.icon}
                  </button>
                  {showBtnLabels && (
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5, textTransform: 'uppercase', animation: idx > 0 ? 'btnLabelFade 0.8s ease forwards' : 'none' }}>
                      {btn.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Toasts */}
          {sharedToast && (
            <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'none', animation: 'floatIn 0.3s ease' }}>
              <div style={{ background: 'rgba(201,168,76,0.95)', backdropFilter: 'blur(12px)', borderRadius: 24, padding: '9px 18px', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(10,6,2,0.7)" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(10,6,2,0.8)' }}>{sharedToast}</span>
              </div>
            </div>
          )}
          {/* FIX-13: truncated name in saved toast */}
          {savedToast && (
            <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'none', animation: 'floatIn 0.25s ease' }}>
              <div style={{ background: 'rgba(139,26,43,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#F87171"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{savedToast}</span>
              </div>
            </div>
          )}
          {undoRm && (
            <div style={{ position: 'absolute', bottom: 110, left: 16, right: 16, zIndex: 50, background: 'rgba(15,10,5,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Removed from shortlist</span>
              <button onClick={() => { clearTimeout(undoRm.t); setWishlist(prev => prev.find(x => x.id === undoRm.it.id) ? prev : [...prev, undoRm.it]); setUndoRm(null) }} style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 8, padding: '5px 14px', color: 'var(--gold, #C9A84C)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Undo</button>
            </div>
          )}
        </div>
      </div>

      {showCapture && <PhoneCaptureSheet wishlist={wishlist} waNum={waNum} config={config} onClose={() => setShowCapture(false)} occasion={occasionFilter} onSubmit={handleCaptureSubmit}/>}
      {detail && <DetailSheet product={detail} isLoved={loved(detail.id)} onClose={() => setDetail(null)} onLove={() => loved(detail.id) ? remove(detail.id) : save(detail)} waNum={waNum} flashSale={flashSale} config={config} onBookCall={handleBookCall} allProducts={allProducts} onSelectSimilar={p => setDetail(p)}/>}
      {showWL && <WishlistScreen items={wishlist} config={config} onClose={() => setShowWL(false)} onRemove={remove} onCall={handleBookCall} waNum={waNum} onOpenDetail={openDetailById}/>}
    </>
  )
}
