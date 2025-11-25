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
    <div className="bg-gradient-to-r from-red-600 via-green-600 to-red-600 border-b border-red-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xl animate-pulse">🎄</span>
            <button
              onClick={handleClick}
              className="flex-1 text-left hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white whitespace-nowrap">
                  🎁 Limited Holiday Deal:
                </span>
                <span className="text-sm text-white/90">
                  Unlimited Plan for just
                </span>
                <span className="text-lg font-bold text-yellow-300">
                  $2.99
                </span>
                <span className="text-xs text-white/80 bg-white/20 px-2 py-0.5 rounded-full">
                  Save 25%
                </span>
              </div>
            </button>
          </div>
          
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white transition-colors p-1 flex-shrink-0"
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
