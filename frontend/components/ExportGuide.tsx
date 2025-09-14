'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Mail, Download, ArrowRight, Settings, Database, Zap } from 'lucide-react'
import { analytics } from '@/lib/analytics'
import Image from 'next/image'

const ExportGuide = () => {
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
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-blue-500/10 to-transparent rounded-full blur-3xl"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
            transition: 'all 0.3s ease-out'
          }}
        />
        <div 
          className="absolute w-64 h-64 bg-gradient-to-l from-purple-500/10 to-transparent rounded-full blur-2xl"
          style={{
            left: mousePosition.x - 128,
            top: mousePosition.y + 100,
            transition: 'all 0.5s ease-out'
          }}
        />
        
        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => {
            const positions = [
              { left: 10, top: 20, delay: 0 },
              { left: 85, top: 15, delay: 1.2 },
              { left: 25, top: 80, delay: 2.4 },
              { left: 70, top: 60, delay: 0.8 },
              { left: 50, top: 30, delay: 3.6 },
              { left: 15, top: 70, delay: 1.8 },
              { left: 90, top: 45, delay: 4.2 },
              { left: 35, top: 85, delay: 0.6 },
              { left: 75, top: 25, delay: 2.8 },
              { left: 55, top: 75, delay: 3.2 },
              { left: 20, top: 40, delay: 1.5 },
              { left: 80, top: 70, delay: 4.0 },
              { left: 45, top: 10, delay: 2.2 },
              { left: 65, top: 55, delay: 0.4 },
              { left: 30, top: 65, delay: 3.8 },
              { left: 85, top: 35, delay: 1.0 },
              { left: 40, top: 90, delay: 2.6 },
              { left: 75, top: 20, delay: 4.4 },
              { left: 60, top: 50, delay: 1.4 },
              { left: 25, top: 35, delay: 3.0 }
            ];
            const pos = positions[i] || { left: 50, top: 50, delay: 0 };
            
            return (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white/20 rounded-full"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                  animation: `float 6s ease-in-out infinite ${pos.delay}s`
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center px-6 relative">
          <div className="absolute inset-0 hero-gradient transform skew-y-1"></div>
          
          <div className="max-w-6xl mx-auto text-center relative z-10">
            <div className="mb-8">
              <div className="text-sm text-blue-400 font-mono mb-4">~/universal-context-pack</div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl text-white mb-6 font-bold leading-tight">
                Your AI
                <br />
                <span className="text-white font-medium">
                  Memory
                </span>
                <br />
                <span className="text-gray-400">Everywhere</span>
              </h1>
            </div>
            
            {/* Status Message - Green Info Box */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-8 max-w-md mx-auto">
              <p className="text-green-400 text-sm">
                Currently supported: ChatGPT | Grok | Claude
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => {
                  document.getElementById('export')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg text-lg font-medium transition-all duration-300 hover:shadow-2xl hover:scale-105"
              >
                Get Started
              </button>
              
              <a 
                href="/process"
                className="text-purple-400 hover:text-white transition-colors duration-300 flex items-center gap-2 group border border-purple-500 hover:border-purple-400 hover:bg-purple-600 px-6 py-4 rounded-lg"
              >
                <span>Skip to Upload</span>
                <div className="w-4 h-6 transform group-hover:translate-x-1 transition-transform duration-300">→</div>
              </a>
            </div>
          </div>

          {/* Floating Text Bubbles - Outside Container - Hidden on Mobile */}
          <div className="absolute inset-0 pointer-events-none hidden lg:block">
            {/* Bubble 1 - Far Left Edge */}
            <div className="absolute" style={{ left: '5vw', top: '40%' }}>
              <div className="bg-gray-800/40 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-600/30">
                <span className="text-gray-300 text-base">Extract your conversations</span>
              </div>
            </div>
            
            {/* Bubble 2 - Far Right Edge */}
            <div className="absolute" style={{ right: '5vw', top: '35%' }}>
              <div className="bg-gray-800/40 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-600/30">
                <span className="text-gray-300 text-base">Store them securely</span>
              </div>
            </div>
            
            {/* Bubble 3 - Left Side */}
            <div className="absolute" style={{ left: '12vw', top: '65%' }}>
              <div className="bg-gray-800/40 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-600/30">
                <span className="text-gray-300 text-base">Port across different AI's</span>
              </div>
            </div>
            
              {/* Bubble 4 - Center Bottom */}
              <div className="absolute" style={{ left: '50%', bottom: '20%', transform: 'translateX(-50%)' }}>
                <div className="bg-gray-700/40 backdrop-blur-sm rounded-full px-5 py-3 border border-gray-600/30">
                  <span className="text-gray-200 text-base font-medium">Your conversations are your data</span>
                </div>
              </div>            {/* Bubble 5 - Right Side */}
            <div className="absolute" style={{ right: '12vw', top: '70%' }}>
              <div className="bg-gray-800/40 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-600/30">
                <span className="text-gray-300 text-base">AI Memory Manager</span>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Security Section */}
        <section className="py-16 px-6 relative">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-800/40 rounded-2xl p-8 border border-gray-700">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Data Security & Privacy</h2>
                <p className="text-gray-300 text-lg">Your conversations are processed securely through encrypted infrastructure</p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Encrypted Storage</h3>
                  <p className="text-gray-400 text-sm">Files are encrypted during processing and securely stored using industry-standard protocols.</p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Secure Processing</h3>
                  <p className="text-gray-400 text-sm">All data processing happens through encrypted channels with automatic cleanup protocols.</p>
                </div>
                
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-2">Confidential Processing</h3>
                  <p className="text-gray-400 text-sm">Your conversations remain confidential - we don't read, analyze, or use your data for any other purpose.</p>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                <p className="text-gray-300 text-sm text-center">
                  <strong>Security Standards:</strong> We use AES-256 encryption for data at rest and TLS 1.3 for data in transit. 
                  Your files are processed in isolated environments and automatically purged after Context Pack generation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Export Guide Section */}
        <section id="export" className="py-20 px-6 bg-gray-900/20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">
                Export Your AI Chats
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Get your conversation history from ChatGPT or Claude and use it anywhere
              </p>
            </div>

            {/* Clean Export Interface */}
            <div className="max-w-3xl mx-auto mb-16">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-8">
                <h3 className="text-lg font-semibold text-white mb-6">Download Your Chats</h3>
                
                <div className="space-y-3">
                  {exportSteps.map((step) => (
                    <a 
                      key={step.platform}
                      href={step.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 bg-white hover:bg-gray-700/50 border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <step.icon className="h-5 w-5 text-gray-900" />
                        <span className="text-black font-medium">{step.platform}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-sm text-black">Download My Chats</span>
                        <ExternalLink className="h-4 w-4" />
                      </div>
                    </a>
                  ))}
                </div>
                
                <p className="text-gray-500 text-sm mt-4">
                  Files sent to your email in 5-10 minutes
                </p>
              </div>
            </div>

            {/* Simple Process Steps */}
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center bg-gray-800 p-6 rounded-lg">
                <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-semibold">1</span>
                </div>
                <h3 className="text-white font-medium mb-2">Download</h3>
                <p className="text-gray-500 text-sm">Get your chat history</p>
              </div>

              <div className="text-center bg-gray-800 p-6 rounded-lg">
                <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-semibold">2</span>
                </div>
                <h3 className="text-white font-medium mb-2">Upload</h3>
                <p className="text-gray-500 text-sm mb-4">Create your memory pack</p>
                <a 
                  href="/process"
                  className="inline-flex items-center gap-2 bg-white text-black hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Upload Files
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="text-center bg-gray-800 p-6 rounded-lg">
                <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-semibold">3</span>
                </div>
                <h3 className="text-white font-medium mb-2">Use Anywhere</h3>
                <p className="text-gray-500 text-sm mb-4">Paste into any AI chat</p>
                <a 
                  href="/how-to-port"
                  className="inline-flex items-center gap-2 border bg-white border-gray-600 text-black hover:text-white hover:border-gray-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  How to Use
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

       

        {/* Spacing section with subtle blue gradient */}
        <section className="py-12 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent">
          <div className="max-w-4xl mx-auto px-6">
            <div className="h-8"></div>
          </div>
        </section>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(120deg); }
          66% { transform: translateY(5px) rotate(240deg); }
        }
      `}</style>
    </div>
  )
}

export default ExportGuide
