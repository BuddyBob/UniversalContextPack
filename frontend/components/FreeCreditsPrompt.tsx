'use client'

import { useState } from 'react'
import { X, Chrome, Github, Loader2, Eye, EyeOff } from 'lucide-react'
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
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { signInWithGoogle, signInWithGitHub, signInWithEmail, signUpWithEmail } = useAuth()

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      setError(null)
      await signInWithGoogle()
      // Auto-close modal after successful sign-in
      onClose()
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  const handleGitHubSignIn = async () => {
    try {
      setIsLoading(true)
      setError(null)
      await signInWithGitHub()
      // Auto-close modal after successful sign-in
      onClose()
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with GitHub')
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      if (isSignUp) {
        await signUpWithEmail(email, password)
        setError('Check your email to verify your account!')
        setIsLoading(false)
      } else {
        await signInWithEmail(email, password)
        // Auto-close modal after successful sign-in
        onClose()
      }
    } catch (error: any) {
      setError(error.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}`)
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900/95 border border-white/10 rounded-2xl max-w-md w-full p-8 relative shadow-2xl backdrop-blur-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-white mb-3">
            Sign in to Continue
          </h3>
          <p className="text-gray-300">
            You'll get <strong className="text-white">10 processing credits</strong> to get started immediately.
          </p>
        </div>

        {error && (
          <div className={`border px-4 py-3 rounded-lg mb-6 text-sm ${error.includes('Check your email')
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
            {error}
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Chrome className="w-5 h-5" />}
            <span>Sign in with Google</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-900 text-gray-400">Or</span>
          </div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-white/30 focus:border-white/30 text-white placeholder-gray-400"
              disabled={isLoading}
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:ring-2 focus:ring-white/30 focus:border-white/30 text-white placeholder-gray-400 pr-10"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isLoading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-sm text-gray-400 hover:text-white"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </form>

        <button
          onClick={onClose}
          disabled={isLoading}
          className="w-full text-gray-400 hover:text-white py-2 transition-colors disabled:opacity-50 text-sm font-medium mt-4"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
