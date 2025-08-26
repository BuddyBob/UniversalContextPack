'use client'

import { useState } from 'react'
import { X, Chrome, Loader2 } from 'lucide-react'
import { useAuth } from './AuthProvider'

interface FreeCreditsPromptProps {
  isOpen: boolean
  onClose: () => void
  feature?: string
}

export default function FreeCreditsPrompt({ 
  isOpen, 
  onClose, 
  feature = "this feature" 
}: FreeCreditsPromptProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signInWithGoogle } = useAuth()

  const handleSignIn = async () => {
    try {
      setIsLoading(true)
      setError(null)
      await signInWithGoogle()
      // The redirect will happen automatically
    } catch (error: any) {
      setError(error.message || 'Failed to sign in')
      setIsLoading(false)
    }
  }
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border-primary rounded-lg max-w-md w-full p-6 relative shadow-lg">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-accent-primary/20 p-4 rounded-full">
              <Chrome className="w-8 h-8 text-accent-primary" />
            </div>
          </div>

          <h3 className="text-xl font-semibold text-text-primary mb-3 text-center">
            Sign in to Continue
          </h3>
          
          <p className="text-text-secondary mb-6 text-center">
            You'll get <strong>5 processing credits</strong> to get started immediately. Quick Google sign-in.
          </p>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

                    <div className="space-y-4">
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full bg-accent-primary hover:bg-accent-primary-hover text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Opening Google...</span>
                </>
              ) : (
                <>
                  <Chrome className="w-5 h-5" />
                  <span>Sign in with Google</span>
                </>
              )}
            </button>
            
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-full text-text-muted hover:text-text-primary py-2 transition-colors disabled:opacity-50 text-sm"
            >
              Maybe later
            </button>
            
            {/* Info about redirect */}
            <p className="text-center text-xs text-text-muted">
              You'll be taken to Google to sign in, then returned here to continue.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
