'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import AuthModal from './AuthModal'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Settings, User, LogOut, Sun, Moon, Menu, X } from 'lucide-react'

export default function Navigation() {
  const { user, userProfile, signOut, loading, session, makeAuthenticatedRequest } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
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
              <Image
                src="/Logo.png"
                alt="UCP Logo"
                width={32}
                height={32}
                className="nav-logo-img"
              />
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
              <Image
                src="/Logo.png"
                alt="UCP Logo"
                width={32}
                height={32}
                className="nav-logo-img"
              />
              <h1 className="nav-title">Universal Context Pack</h1>
            </Link>

            {/* Desktop Navigation Links */}
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

              {/* Desktop User Menu */}
              <div className="nav-user-section hidden md:block">
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
                      <div className="nav-user-info">
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
                    className="nav-sign-in-btn group relative"
                  >
                    <span>Sign In</span>
                  </button>
                )}
              </div>

              {/* Mobile Hamburger Button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors"
                aria-label="Toggle mobile menu"
              >
                {showMobileMenu ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden mt-4 pb-4 border-t border-border-primary">
              <nav className="flex flex-col space-y-2 pt-4">
                <Link 
                  href="/" 
                  className={`mobile-nav-link ${pathname === '/' ? 'active' : ''}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  Home
                </Link>
                <Link 
                  href="/process" 
                  className={`mobile-nav-link ${pathname === '/process' ? 'active' : ''}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  Process
                </Link>
                <Link 
                  href="/packs" 
                  className={`mobile-nav-link ${pathname === '/packs' ? 'active' : ''}`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  Packs
                </Link>
                
                {/* Mobile User Section */}
                <div className="pt-4 border-t border-border-primary mt-4">
                  {user ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 px-3 py-2">
                        {userProfile?.avatar_url && (
                          <img
                            src={userProfile.avatar_url}
                            alt={userProfile.full_name || 'User'}
                            className="w-8 h-8 rounded-full"
                          />
                        )}
                        <div>
                          <p className="text-text-primary font-medium text-sm">
                            {userProfile?.full_name || user.email?.split('@')[0]}
                          </p>
                          <p className="text-text-muted text-xs">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          signOut()
                          setShowMobileMenu(false)
                        }}
                        className="flex items-center space-x-2 w-full text-left px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-bg-card-hover rounded-md transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowAuthModal(true)
                        setShowMobileMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 text-accent-primary font-medium hover:bg-bg-card-hover rounded-md transition-colors"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </>
  )
}
