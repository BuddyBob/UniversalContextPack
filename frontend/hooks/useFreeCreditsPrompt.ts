'use client'

import { useState } from 'react'
import { useAuth } from '../components/AuthProvider'

export function useFreeCreditsPrompt() {
  const { user } = useAuth()
  const [showPrompt, setShowPrompt] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const triggerPrompt = (feature?: string) => {
    if (!user) {
      setShowPrompt(true)
      return false // Prevent the action
    }
    return true // Allow the action
  }

  const handleSignIn = () => {
    setShowPrompt(false)
    setShowAuthModal(true)
  }

  const closePrompt = () => {
    setShowPrompt(false)
  }

  const closeAuthModal = () => {
    setShowAuthModal(false)
  }

  return {
    showPrompt,
    showAuthModal,
    triggerPrompt,
    handleSignIn,
    closePrompt,
    closeAuthModal
  }
}
