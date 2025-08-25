'use client'

import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'

interface FreeCreditsPromptProps {
  isOpen: boolean
  onClose: () => void
  onSignIn: () => void
  feature?: string
}

export default function FreeCreditsPrompt({ 
  isOpen, 
  onClose, 
  onSignIn, 
  feature = "this feature" 
}: FreeCreditsPromptProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-3 rounded-full">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>

          <h3 className="text-xl font-semibold text-text-primary mb-2">
            Get 5 Free Credits!
          </h3>
          
          <p className="text-text-secondary mb-6">
            Sign in to access {feature} with <strong>5 free credits</strong>. No payment required to get started.
          </p>

          <div className="space-y-3">
            <button
              onClick={onSignIn}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium py-3 px-4 rounded-md transition-all duration-200"
            >
              Sign In & Get 5 Free Credits
            </button>
            
            <button
              onClick={onClose}
              className="w-full text-text-muted hover:text-text-primary py-2 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
