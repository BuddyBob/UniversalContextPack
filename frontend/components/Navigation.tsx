'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import AuthModal from './AuthModal'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, User, LogOut, Key, X, Eye, EyeOff, Sun, Moon } from 'lucide-react'

export default function Navigation() {
  const { user, userProfile, signOut, loading, session, makeAuthenticatedRequest } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [theme, setTheme] = useState('dark')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Theme toggle function
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme === 'light' ? 'light' : '')
    localStorage.setItem('theme', newTheme)
  }

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : '')
  }, [])

  // Check if user has an API key when profile loads
  useEffect(() => {
    const checkApiKey = async () => {
      if (user) {
        try {
          const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/profile`)
          
          if (response.ok) {
            const data = await response.json()
            setHasApiKey(data.profile?.has_openai_key || false)
          }
        } catch (error) {
          console.error('Error checking API key:', error)
        }
      }
    }
    
    checkApiKey()
  }, [user, makeAuthenticatedRequest])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSaveApiKey = async () => {
    if (!apiKey.trim() || !user) return
    
    setIsLoading(true)
    try {
      const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/profile/openai-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      })
      
      if (response.ok) {
        setHasApiKey(true)
        setApiKey('')
        setShowApiKey(false)
        setShowApiKeyModal(false)
      } else {
        const error = await response.json()
        alert(`Error saving API key: ${error.detail || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      alert('Error saving API key. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveApiKey = async () => {
    if (!user) return
    
    setIsLoading(true)
    try {
      const response = await makeAuthenticatedRequest(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/profile/openai-key`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setHasApiKey(false)
        setApiKey('')
        setShowApiKey(false)
        setShowApiKeyModal(false)
      } else {
        const error = await response.json()
        alert(`Error removing API key: ${error.detail || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error removing API key:', error)
      alert('Error removing API key. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <header className="nav-header">
        <div className="nav-container">
          <div className="nav-content">
            <div className="nav-brand">
              <div className="nav-logo">U</div>
              <h1 className="nav-title">Universal Context Pack</h1>
            </div>
            <div className="w-20 h-8 bg-card animate-pulse rounded"></div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <>
      <header className="nav-header">
        <div className="nav-container">
          <div className="nav-content">
            <Link href="/" className="nav-brand">
              <div className="nav-logo">U</div>
              <h1 className="nav-title">Universal Context Pack</h1>
            </Link>

            {/* Navigation Links */}
            <nav className="nav-links hidden md:flex">
              <Link 
                href="/" 
                className={`nav-link ${pathname === '/' ? 'active' : ''}`}
              >
                Home
              </Link>
              <Link 
                href="/process" 
                className={`nav-link ${pathname === '/process' ? 'active' : ''}`}
              >
                Process
              </Link>
              <Link 
                href="/packs" 
                className={`nav-link ${pathname === '/packs' ? 'active' : ''}`}
              >
                Packs
              </Link>
            </nav>

            {/* Right Side Navigation */}
            <div className="nav-right-section">
              {/* Theme Toggle */}
              <div className="nav-theme-toggle">
                <button
                  onClick={toggleTheme}
                  className="nav-theme-btn"
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* User Menu */}
              <div className="nav-user-section">
              {user ? (
                <div className="relative" ref={dropdownRef}>
                  <div 
                    className="nav-user-dropdown"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                  >
                    {userProfile?.avatar_url && (
                      <img
                        src={userProfile.avatar_url}
                        alt={userProfile.full_name || 'User'}
                        className="nav-user-avatar"
                      />
                    )}
                    <div className="nav-user-info hidden md:block">
                      <p className="nav-user-name">
                        {userProfile?.full_name || user.email?.split('@')[0]}
                      </p>
                      <p className="nav-user-email">{user.email}</p>
                    </div>
                  </div>

                  {showUserDropdown && (
                    <div className="nav-dropdown-menu">
                      <button
                        onClick={() => {
                          setShowApiKeyModal(true)
                          setShowUserDropdown(false)
                        }}
                        className="nav-dropdown-item"
                      >
                        <Key className="h-4 w-4" />
                        Manage API Key
                      </button>
                      <div className="nav-dropdown-divider"></div>
                      <button
                        onClick={signOut}
                        className="nav-dropdown-item"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="nav-sign-in-btn"
                >
                  Sign In
                </button>
              )}
            </div>
            </div>
          </div>
        </div>
      </header>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="api-key-modal">
          <div className="api-key-modal-content">
            <div className="api-key-modal-header">
              <h3 className="api-key-modal-title">OpenAI API Key</h3>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="nav-dropdown-item"
                style={{ padding: '0.5rem', width: 'auto' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="api-key-input-group">
              <label className="api-key-label">
                API Key
              </label>
              {hasApiKey && !apiKey ? (
                <div className="bg-card border border-border rounded-md p-3 mb-3">
                  <p className="text-sm text-muted">
                    ✅ You have an OpenAI API key saved securely in your profile.
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Enter a new key below to replace it, or remove the current one.
                  </p>
                </div>
              ) : null}
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasApiKey ? "Enter new API key..." : "sk-proj-..."}
                  className="api-key-input"
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted hover:text-primary"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted mt-2">
                Your API key is stored securely in your profile and used for AI processing. 
                Get your key from <a href="https://platform.openai.com/account/api-keys" target="_blank" className="text-accent hover:underline">OpenAI Platform</a>.
              </p>
            </div>
            
            <div className="api-key-actions">
              {hasApiKey && (
                <button
                  onClick={handleRemoveApiKey}
                  disabled={isLoading}
                  className="btn-secondary-improved"
                  style={{ width: 'auto', padding: '0.5rem 1rem' }}
                >
                  {isLoading ? 'Removing...' : 'Remove'}
                </button>
              )}
              <button
                onClick={() => setShowApiKeyModal(false)}
                disabled={isLoading}
                className="btn-secondary-improved"
                style={{ width: 'auto', padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKey.trim() || isLoading}
                className="btn-primary-improved"
                style={{ width: 'auto', padding: '0.5rem 1rem' }}
              >
                {isLoading ? 'Saving...' : (hasApiKey ? 'Update' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </>
  )
}
