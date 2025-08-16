'use client'

import { useState } from 'react'
import AuthWrapper from '@/components/AuthWrapper'
import UserProfileComponent from '@/components/UserProfileComponent'
import PaymentNotification, { usePaymentNotifications } from '@/components/PaymentNotification'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const { notification, hideNotification, showUpgradeSuccess } = usePaymentNotifications()

  const handleUpgrade = () => {
    // This will be replaced with Stripe integration
    alert('Stripe integration coming soon! You will be redirected to secure payment.')
    // For demo purposes, show success notification
    setTimeout(() => {
      showUpgradeSuccess()
    }, 1000)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-black">
        {/* Payment Notification */}
        <PaymentNotification
          show={notification.show}
          type={notification.type}
          message={notification.message}
          chunksUsed={notification.chunksUsed}
          chunksAllowed={notification.chunksAllowed}
          onClose={hideNotification}
          onUpgrade={handleUpgrade}
          autoHide={notification.type === 'upgrade_success'}
        />

        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
            <p className="text-gray-400">Manage your account and billing</p>
          </div>

          {/* Profile Content */}
          <div className="space-y-6">
            {/* User Profile Component */}
            <UserProfileComponent 
              onUpgrade={handleUpgrade}
              className="bg-gray-950 border-gray-800"
            />
            
            {/* Sign Out Section */}
            <div className="bg-gray-950 rounded-2xl border border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Account Actions</h2>
              <button
                onClick={signOut}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthWrapper>
  )
}
