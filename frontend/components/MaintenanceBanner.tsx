'use client'

import { X, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

export default function MaintenanceBanner() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="bg-amber-500 text-white px-4 py-3 relative">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            <strong>Maintenance Mode:</strong> We're currently performing system maintenance. Some features may be working.
            Service will resume at <strong>8-9 PM PST</strong>. Thank you for your patience!
          </p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 hover:bg-amber-600 rounded p-1 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
