'use client'

import { X, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

export default function MaintenanceBanner() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="bg-orange-600 text-white px-4 py-3 relative">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            <strong>Maintenance:</strong> Running maintenance from Dec 9 5:00 PM PST to Dec 9 10:00 PM PST. Services may be intermittently unavailable.
          </p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 hover:bg-orange-700 rounded p-1 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
