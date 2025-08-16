'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import AuthModal from './AuthModal'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, User, LogOut, Sun, Moon } from 'lucide-react'

export default function Navigation() {
  const { user, userProfile, signOut, loading, session, makeAuthenticatedRequest } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
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

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </>
  )
}
