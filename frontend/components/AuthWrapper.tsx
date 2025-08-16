'use client'

import { useAuth } from '@/components/AuthProvider'
import { useEffect, useState } from 'react'
import AuthModal from '@/components/AuthModal'

interface AuthWrapperProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export default function AuthWrapper({ children, requireAuth = true }: AuthWrapperProps) {
  const { user, loading } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    if (!loading && requireAuth && !user) {
      setShowAuthModal(true)
    }
  }, [user, loading, requireAuth])

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If auth is required but user is not logged in, show auth modal
  if (requireAuth && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-gray-900 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-xl font-bold text-white">U</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to UCP</h1>
          <p className="text-gray-600 mb-6">
            Please sign in to access your Universal Context Pack workspace and start processing your chat exports.
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Sign In to Continue
          </button>
        </div>
        
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
      </div>
    )
  }

  // User is authenticated or auth not required
  return <>{children}</>
}
