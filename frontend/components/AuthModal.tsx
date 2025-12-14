'use client'

import { useState } from 'react'
import { X, Chrome, Loader2, Key, Eye, EyeOff } from 'lucide-react'
import { useAuth } from './AuthProvider'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithGoogle, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'signin' | 'apikey'>('signin')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  if (!isOpen) return null

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)
      await signInWithGoogle()

      // Since the backend now handles OpenAI API keys, we don't need user to provide their own
      onClose()
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with Google')
      setLoading(false)
    }
  }

  const handleApiKeySubmit = () => {
    if (!apiKey.trim()) {
      setError('Please enter your OpenAI API key')
      return
    }

    if (!apiKey.startsWith('sk-')) {
      setError('Please enter a valid OpenAI API key (starts with sk-)')
      return
    }

    // Store API key securely in localStorage
    localStorage.setItem('openai_api_key', apiKey.trim())
    setError(null)
    onClose()
  }

  const handleSkipApiKey = () => {
    // Allow users to skip for now but they'll need it for processing
    onClose()
  }

  if (step === 'apikey') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Key className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Your OpenAI API Key</h2>
            <p className="text-gray-600">
              To process and analyze your chat exports, we need your OpenAI API key
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* API Key Input */}
          <div className="mb-6">
            <label htmlFor="apikey" className="block text-sm font-medium text-gray-700 mb-2">
              OpenAI API Key
            </label>
            <div className="relative">
              <input
                id="apikey"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Your API key is stored locally and never sent to our servers
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleApiKeySubmit}
              className="w-full bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Save and Continue
            </button>
            <button
              onClick={handleSkipApiKey}
              className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Skip for Now
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-gray-900 underline">OpenAI Platform</a></p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={loading}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in to Continue</h2>
          <p className="text-gray-600">
            You'll get 10 processing credits to start immediately. Quick Google sign-in.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center space-x-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Chrome className="h-5 w-5" />
          )}
          <span>{loading ? 'Opening Google...' : 'Sign in with Google'}</span>
        </button>

      </div>
    </div>
  )
}
