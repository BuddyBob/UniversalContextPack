'use client'

import { useState } from 'react'
import AuthWrapper from '@/components/AuthWrapper'
import UserProfileComponent from '@/components/UserProfileComponent'
import PaymentNotification, { usePaymentNotifications } from '@/components/PaymentNotification'
import { User, Settings, Key } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [openaiKey, setOpenaiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const { notification, hideNotification, showUpgradeSuccess } = usePaymentNotifications()

  const handleUpgrade = () => {
    // This will be replaced with Stripe integration
    alert('Stripe integration coming soon! You will be redirected to secure payment.')
    // For demo purposes, show success notification
    setTimeout(() => {
      showUpgradeSuccess()
    }, 1000)
  }

  const saveOpenAIKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email!,
          openai_api_key: openaiKey,
          r2_user_directory: `users/${user.id}`,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setMessage('OpenAI API key saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error: any) {
      console.error('Error saving API key:', error.message)
      setMessage('Error saving API key: ' + error.message)
    } finally {
      setSaving(false)
    }
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
            <p className="text-gray-400">Manage your account, billing, and API keys</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-8 bg-gray-900 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <User size={16} />
              <span>Profile & Billing</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Key size={16} />
              <span>API Settings</span>
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* User Profile Component */}
              <UserProfileComponent 
                onUpgrade={handleUpgrade}
                className="bg-gray-950 border-gray-800"
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="bg-gray-950 rounded-2xl border border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">API Configuration</h2>
              
              <form onSubmit={saveOpenAIKey} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Your API key is encrypted and stored securely. This is optional - you can use our built-in processing with Pro plan.
                  </p>
                </div>

                {message && (
                  <div className={`text-sm p-3 rounded-lg ${
                    message.includes('Error') 
                      ? 'bg-red-900/50 text-red-400 border border-red-800' 
                      : 'bg-green-900/50 text-green-400 border border-green-800'
                  }`}>
                    {message}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save API Key'}
                  </button>
                </div>
              </form>

              {/* API Key Benefits */}
              <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                <h3 className="text-sm font-medium text-blue-300 mb-2">Why provide your API key?</h3>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>• Use your own OpenAI credits instead of our Pro plan</li>
                  <li>• Direct access to latest GPT models</li>
                  <li>• No monthly subscription required</li>
                  <li>• Full control over your AI processing costs</li>
                </ul>
              </div>

              {/* Sign Out */}
              <div className="mt-8 pt-6 border-t border-gray-800">
                <button
                  onClick={signOut}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthWrapper>
  )
}
