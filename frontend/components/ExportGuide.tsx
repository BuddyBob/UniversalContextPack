'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Mail, Download, ArrowRight, Settings, Database, Zap, Clock, Bell, Sparkles } from 'lucide-react'
import { analytics } from '@/lib/analytics'
import Image from 'next/image'
import DemoVideoPopover from './DemoVideoPopover'
import ScrollReveal from './ScrollReveal'
import { useAuth } from './AuthProvider'
import UseCaseTabs from './UseCaseTabs'

const ExportGuide = () => {
  const { user } = useAuth()
  const [scrollY, setScrollY] = useState(0)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    // Track landing page view
    analytics.landingPage()

    const handleScroll = () => setScrollY(window.scrollY)
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  const exportSteps = [
    {
      platform: 'ChatGPT',
      url: 'https://chatgpt.com/#settings/DataControls',
      icon: Settings,
    },
    {
      platform: 'Claude',
      url: 'https://claude.ai/settings/data-privacy-controls',
      icon: Database,
    }
  ]

  return (
    <div className="min-h-screen bg-[#080a09] text-white relative overflow-hidden">

      {/* Floating Value Proposition - Always visible on desktop, positioned on left */}

      {/* Stats Display - Bottom Left */}
      <div className="fixed bottom-8 left-8 z-50 hidden md:block">
        <div className="flex flex-row gap-6 items-center">
          {/* Packs Count */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">5.5k+</span>
            <span className="text-sm text-gray-400">packs</span>
          </div>
          {/* Memories Count */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">55k</span>
            <span className="text-sm text-gray-400">memories</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section - 3D Bubble Style */}
        <section className="min-h-screen flex items-center justify-center px-6 py-40 relative overflow-hidden">
          {/* Floating star particles - Visible */}
          <div className="absolute inset-0 pointer-events-none z-50">
            {[...Array(12)].map((_, i) => {
              const positions = [
                { left: 10, top: 20, delay: 0, size: 1 },
                { left: 85, top: 15, delay: 1.2, size: 1 },
                { left: 25, top: 75, delay: 2.4, size: 1 },
                { left: 70, top: 55, delay: 0.8, size: 1 },
                { left: 50, top: 30, delay: 3.6, size: 1 },
                { left: 15, top: 65, delay: 1.8, size: 1 },
                { left: 90, top: 45, delay: 4.2, size: 1 },
                { left: 35, top: 80, delay: 0.6, size: 1 },
                { left: 75, top: 25, delay: 2.8, size: 1 },
                { left: 55, top: 70, delay: 3.2, size: 1 },
                { left: 20, top: 40, delay: 1.5, size: 1 },
                { left: 80, top: 60, delay: 4.0, size: 1 }
              ];
              const pos = positions[i] || { left: 50, top: 50, delay: 0, size: 1 };

              return (
                <div
                  key={i}
                  className="absolute bg-white/40 rounded-full"
                  style={{
                    width: `${pos.size * 2}px`,
                    height: `${pos.size * 2}px`,
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    animation: `float 8s ease-in-out infinite ${pos.delay}s`,
                    boxShadow: '0 0 4px rgba(255, 255, 255, 0.3)'
                  }}
                />
              );
            })}
          </div>

          <div className="max-w-7xl mx-auto w-full relative z-10">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left Column - Text Content */}
              <div className="text-left">
                {/* Main Headline */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                  AI Chats Forget
                  <br />
                  Context Pack Remembers
                </h1>

                {/* Subheadline */}
                <p className="text-xl text-gray-400 max-w-2xl mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  Keep your AI chats persistent across conversations and platforms.
                </p>

                {/* Trust Badges */}
                <div className="flex flex-wrap items-center gap-6 mb-10 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-400">Migrate AI Chats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-400">Upload Chat Exports</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-400">Long-term Memory</span>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="relative z-30 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <a
                    href="/packs"
                    className="inline-block px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 relative overflow-hidden group"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
                      color: 'white'
                    }}
                  >
                    <span className="relative z-10">Start Your Pack</span>
                    {/* Hover glow effect */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.1), transparent)',
                      }}
                    ></div>
                  </a>
                </div>
              </div>

              {/* Right Column - Hero Image */}
              <div className="hidden lg:block relative animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <div className="relative w-full transform scale-125 origin-center">
                  <Image
                    src="/main-image.png"
                    alt="Context Pack Hero"
                    width={1600}
                    height={800}
                    className="w-full h-auto"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* Tabbed Use Cases Section */}
        <section className="py-16 md:py-24 px-6 bg-secondary">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
                Built for how you actually work
              </h2>
              <p className="text-lg text-muted">
                Context Pack adapts to your workflow, not the other way around.
              </p>
            </div>

            {/* Tab Navigation */}
            <UseCaseTabs />
          </div>
        </section>


        <section id="export" className="py-16 md:py-32 px-6 relative overflow-hidden">
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="text-center mb-12 md:mb-20">
              <div className="inline-block mb-4">
                <span className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-gray-400 text-sm font-medium">
                  Step 1
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Export Your Conversations
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
                One click to download your entire chat history
              </p>

              {/* How to get chats info */}
              <div className="max-w-xl mx-auto p-4 rounded-xl bg-white/[0.02] border border-white/10 backdrop-blur-sm">
                <p className="text-sm text-gray-400">
                  Click your platform below → Settings → Export Data → Check your email in 5-10 minutes
                </p>
              </div>
            </div>

            {/* Glass cards */}
            <div className="flex flex-col md:flex-row gap-6 max-w-5xl mx-auto">
              {exportSteps.map((step, index) => (
                <a
                  key={step.platform}
                  href={step.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex-1 animate-fade-in-up"
                  style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                >
                  {/* Glass card */}
                  <div className="relative h-full p-8 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300">
                    {/* Icon */}
                    <div className="mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center group-hover:scale-105 group-hover:bg-white/[0.08] transition-all duration-300">
                        <step.icon className="h-8 w-8 text-gray-400 group-hover:text-gray-300 transition-colors duration-300" />
                      </div>
                    </div>

                    {/* Platform name */}
                    <h3 className="text-2xl font-bold text-white mb-3">
                      {step.platform}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-400 mb-8 text-sm leading-relaxed">
                      Request your complete chat history and receive it via email
                    </p>

                    {/* CTA */}
                    <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                      <span className="text-sm font-medium">
                        Get My Data
                      </span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>

                    {/* Subtle shine effect */}
                    <div className="absolute top-0 left-0 w-full h-full rounded-2xl overflow-hidden pointer-events-none">
                      <div className="absolute top-0 -left-full w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-12 group-hover:left-full transition-all duration-1000"></div>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* Info badge */}
            <div className="text-center mt-16">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/[0.02] border border-white/10 backdrop-blur-sm">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-gray-400 text-sm">
                  Delivered to your inbox in 5-10 minutes
                </span>
              </div>
            </div>
          </div>
        </section>


        {/* Spacing section with subtle blue gradient */}
        <section className="py-12 bg-gradient-to-b from-transparent via-slate-700/10 to-transparent">
          <div className="max-w-4xl mx-auto px-6">
            <div className="h-8"></div>
          </div>
        </section>
      </div>

      {/* Demo Video Popover */}
      <DemoVideoPopover />

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes textShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-text-shimmer {
          background-size: 200% auto;
          animation: textShimmer 3s linear infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(120deg); }
          66% { transform: translateY(5px) rotate(240deg); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(30px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInDown {
          0% {
            opacity: 0;
            transform: translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes floatSubtle {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-fade-in-down {
          animation: fadeInDown 0.6s ease-out forwards;
          opacity: 0;
        }
        .animate-float-subtle {
          animation: floatSubtle 6s ease-in-out infinite;
        }
        @keyframes fadeAway {
          0% { opacity: 0.8; transform: translateY(0); }
          50% { opacity: 0.4; transform: translateY(-5px); }
          100% { opacity: 0.1; transform: translateY(-10px); }
        }
        .animate-memory-fade-1 {
          animation: fadeAway 4s ease-in-out infinite alternate;
        }
        .animate-memory-fade-2 {
          animation: fadeAway 4s ease-in-out infinite alternate 1s;
        }
        .animate-memory-fade-3 {
          animation: fadeAway 4s ease-in-out infinite alternate 2s;
        }
      `}</style>
    </div >
  )
}

export default ExportGuide
