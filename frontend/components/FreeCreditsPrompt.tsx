'use client'

import { useState } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'

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
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = () => {
    setIsLoading(true)
    onSignIn()
    // Note: Loading state will be reset when component unmounts/remounts after auth
  }
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
            Sign in to Continue
          </h3>
          
          <p className="text-text-secondary mb-6">
            Sign in to process {feature}. You'll get <strong>5 processing credits</strong> to get started immediately.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium py-3 px-4 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Opening Google...</span>
                </>
              ) : (
                <span>Sign In & Start Processing</span>
              )}
            </button>
            
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-full text-text-muted hover:text-text-primary py-2 transition-colors disabled:opacity-50"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
