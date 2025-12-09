'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Mail, Download, ArrowRight, Settings, Database, Zap, Clock, Bell, Sparkles } from 'lucide-react'
import { analytics } from '@/lib/analytics'
import Image from 'next/image'
import DemoVideoPopover from './DemoVideoPopover'
import ScrollReveal from './ScrollReveal'
import { useAuth } from './AuthProvider'

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
    <div className="min-h-screen bg-[#090909] text-white relative overflow-hidden">
      {/* Floating star particles - Very faint */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(30)].map((_, i) => {
          const positions = [
            { left: 10, top: 20, delay: 0, size: 1 },
            { left: 85, top: 15, delay: 1.2, size: 1.5 },
            { left: 25, top: 80, delay: 2.4, size: 1 },
            { left: 70, top: 60, delay: 0.8, size: 2 },
            { left: 50, top: 30, delay: 3.6, size: 1 },
            { left: 15, top: 70, delay: 1.8, size: 1.5 },
            { left: 90, top: 45, delay: 4.2, size: 1 },
            { left: 35, top: 85, delay: 0.6, size: 1 },
            { left: 75, top: 25, delay: 2.8, size: 1.5 },
            { left: 55, top: 75, delay: 3.2, size: 1 },
            { left: 20, top: 40, delay: 1.5, size: 2 },
            { left: 80, top: 70, delay: 4.0, size: 1 },
            { left: 45, top: 10, delay: 2.2, size: 1.5 },
            { left: 65, top: 55, delay: 0.4, size: 1 },
            { left: 30, top: 65, delay: 3.8, size: 1 },
            { left: 85, top: 35, delay: 1.0, size: 1.5 },
            { left: 40, top: 90, delay: 2.6, size: 1 },
            { left: 75, top: 20, delay: 4.4, size: 2 },
            { left: 60, top: 50, delay: 1.4, size: 1 },
            { left: 25, top: 35, delay: 3.0, size: 1.5 },
            { left: 5, top: 50, delay: 0.5, size: 1 },
            { left: 95, top: 80, delay: 3.5, size: 1.5 },
            { left: 50, top: 5, delay: 2.0, size: 1 },
            { left: 12, top: 90, delay: 4.5, size: 1 },
            { left: 88, top: 25, delay: 1.8, size: 2 },
            { left: 42, top: 68, delay: 2.5, size: 1 },
            { left: 68, top: 42, delay: 3.8, size: 1.5 },
            { left: 33, top: 15, delay: 1.2, size: 1 },
            { left: 78, top: 88, delay: 4.8, size: 1 },
            { left: 58, top: 92, delay: 2.8, size: 1.5 }
          ];
          const pos = positions[i] || { left: 50, top: 50, delay: 0, size: 1 };

          return (
            <div
              key={i}
              className="absolute bg-white/10 rounded-full"
              style={{
                width: `${pos.size}px`,
                height: `${pos.size}px`,
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                animation: `float 8s ease-in-out infinite ${pos.delay}s`,
                boxShadow: '0 0 2px rgba(255, 255, 255, 0.1)'
              }}
            />
          );
        })}
      </div>


      {/* Floating Value Proposition - Always visible on desktop, positioned on left */}


      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section - Mem0 Style */}
        <section className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden">
          {/* Pure black background for image area */}
          <div className="absolute inset-0 bg-[#090909]"></div>

          <div className="max-w-7xl mx-auto w-full relative z-10">
            {/* Header */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 mb-6 animate-fade-in-down">
                <span className="text-sm text-gray-400">1000+ users</span>
              </div>

              <h1 className="text-4xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                AI Chats Forget<br />
                Context Packs Remember
              </h1>

              <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                Migrate or Backup Your AI Memory
              </p>
              {/*If the user is not signed in, send them to /process if they are signed in send them to /packs */}
              <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                {
                  user ? (
                    <a href="/packs" className="inline-block bg-white hover:bg-gray-100 text-black px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-xl">
                      Get Started
                    </a>
                  ) : (
                    <a
                      href="/process"
                      className="inline-block bg-white hover:bg-gray-100 text-black px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-xl"
                    >
                      Get Started
                    </a>
                  )}
              </div>
            </div>

            {/* Main Visual - Hidden on mobile */}
            <div className="hidden md:block max-w-5xl mx-auto md:pl-16 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <Image
                src="/main-image.png"
                alt="Memory Fading vs Organized Memory"
                width={1400}
                height={700}
                className="w-full h-auto animate-float-subtle"
                priority
              />
            </div>
          </div>

        </section>

        {/* Cross Platform Section */}
        <section className="py-12 md:py-24 px-6 relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 md:gap-16 items-center">
              {/* Left Column: Visual Representation - Hidden on mobile */}
              <div className="hidden md:block relative lg:col-span-3">
                <ScrollReveal delay={0.3}>
                  <div className="relative">
                    <video
                      src="/main3_video.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-auto scale-110 animate-float-subtle"
                    />
                  </div>
                </ScrollReveal>
              </div>

              {/* Right Column: Text Content */}
              <div className="lg:col-span-2 md:col-span-2">
                <ScrollReveal>
                  <h2 className="text-3xl md:text-4xl lg:text-6xl font-bold text-white mb-8 leading-tight text-center md:text-left">
                    Move Chats <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 animate-text-shimmer bg-[length:200%_auto]">Across Platforms.</span>
                  </h2>
                </ScrollReveal>

                <ScrollReveal delay={0.4}>
                  <div className="space-y-4">

                    <div className="flex items-center gap-4 p-4 -mx-4 rounded-xl hover:bg-white/5 transition-all duration-300 group cursor-default">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Zap className="h-6 w-6 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Seamless Migration</h3>
                        <p className="text-gray-400">Switch from ChatGPT to Claude or Gemini without losing context.</p>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        {/* Fading Memory Section */}
        <section className="py-12 md:py-24 px-6 relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
              {/* Left Column: Text Content */}
              <div className="text-center md:text-left">
                <ScrollReveal>
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
                    Your AI Memories <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-400 to-gray-600 animate-text-shimmer bg-[length:200%_auto]">Fade Away.</span>
                  </h2>
                </ScrollReveal>

                <ScrollReveal delay={0.4}>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 -mx-4 rounded-xl hover:bg-white/5 transition-all duration-300 group cursor-default">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Database className="h-6 w-6 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Context Limits</h3>
                        <p className="text-gray-400">Limited memory erases old conversations.</p>
                      </div>
                    </div>


                    <div className="flex items-center gap-4 p-4 -mx-4 rounded-xl hover:bg-white/5 transition-all duration-300 group cursor-default">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Sparkles className="h-6 w-6 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">The Solution</h3>
                        <p className="text-gray-400">Context Pack manages your chats</p>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              </div>

              {/* Right Column: Visual Representation - Hidden on mobile */}
              <div className="hidden md:block relative">
                <ScrollReveal delay={0.3}>
                  <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent p-1">
                    <div className="relative bg-[#0A0A0A] rounded-xl overflow-hidden">
                      <Image
                        src="/main2-image.png"
                        alt="AI Memories Fading"
                        width={800}
                        height={600}
                        className="w-full h-auto animate-float-subtle"
                      />
                    </div>
                  </div>
                </ScrollReveal>
              </div>
            </div>
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
