'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HolidayBanner() {
  const [isVisible, setIsVisible] = useState(true)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    // Check if banner was previously dismissed
    if (typeof window !== 'undefined' && localStorage.getItem('holidayBannerDismissed') === 'true') {
      setIsVisible(false)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('holidayBannerDismissed', 'true')
    }
  }

  const handleClick = () => {
    router.push('/pricing')
  }

  // Don't render on server or if not visible
  if (!mounted || !isVisible) return null

  return (
    <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 border-b border-emerald-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleClick}
            className="flex-1 text-left group transition-all"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-emerald-100">
                Holiday Offer
              </span>
              <span className="text-sm text-emerald-200/80">
                Unlimited Plan —
              </span>
              <span className="text-base font-semibold text-white">
                $3.99
              </span>
              <span className="text-xs text-emerald-300/60">
                (25% off)
              </span>
            </div>
          </button>
          
          <button
            onClick={handleDismiss}
            className="text-emerald-300/60 hover:text-emerald-200 transition-colors p-1 flex-shrink-0"
            aria-label="Dismiss holiday banner"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
