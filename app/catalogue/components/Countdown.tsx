'use client'
import { useState, useEffect, useRef } from 'react'

export function Countdown({ endsAt }: { endsAt: string }) {
  const [label, setLabel] = useState('')
  const idRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const tick = () => {
      const end  = new Date(endsAt).getTime()
      if (isNaN(end)) { setLabel(''); return }
      const diff = end - Date.now()
      if (diff <= 0) {
        setLabel('Ended')
        // Stop polling once the sale has ended — no point ticking every second
        if (idRef.current) { clearInterval(idRef.current); idRef.current = null }
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`)
    }
    tick()
    idRef.current = setInterval(tick, 1000)
    return () => { if (idRef.current) clearInterval(idRef.current) }
  }, [endsAt])
  return <>{label}</>
}
