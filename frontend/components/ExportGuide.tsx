'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Mail, Download, ArrowRight, Settings, Database, Zap } from 'lucide-react'
import { analytics } from '@/lib/analytics'

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
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800 transform skew-y-1"></div>
          
          <div className="max-w-6xl mx-auto text-center relative z-10">
            <div className="mb-8">
              <div className="text-sm text-blue-400 font-mono mb-4">~/universal-context-pack</div>
              <h1 className="text-7xl font-light text-white mb-6 leading-tight tracking-tight">
                Your AI
                <br />
                <span className="text-white font-medium">
                  Memory
                </span>
                <br />
                <span className="text-gray-400 text-5xl">Everywhere</span>
              </h1>
            </div>
            
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Transfer months of conversation history between any AI model in seconds
            </p>

            {/* Free Credits Badge */}
            <div className="flex justify-center mb-8">
              <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-400/40 rounded-full px-6 py-3 flex items-center gap-3">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-300 font-medium text-lg">
                  🎉 FREE: Get 5 credits to start • No payment required
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <button 
                onClick={() => {
                  document.getElementById('export')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg text-lg font-medium transition-all duration-300 hover:shadow-2xl hover:scale-105"
              >
                Start Free Trial
              </button>
              
              <a 
                href="/process"
                className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center gap-2 group border border-gray-600 hover:border-purple-500 px-6 py-3 rounded-lg"
              >
                <span>Skip to Upload</span>
                <div className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300">→</div>
              </a>
            </div>
          </div>
        </section>

        {/* Export Guide Section */}
        <section id="export" className="min-h-screen flex items-center justify-center px-6 relative">
          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-light text-white mb-6">
                Export Your <span className="text-white font-medium">AI Conversations</span>
              </h2>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                Get your conversation history from these AI platforms to create your Universal Context Pack
              </p>
            </div>

            {/* Platform Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
              {exportSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div 
                    key={step.platform} 
                    className="bg-gray-800/30 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-600 hover:border-gray-500 transition-all duration-300"
                  >
                    {/* Platform Header */}
                    <div className="bg-gray-800/50 p-6 border-b border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <h3 className="text-2xl font-medium text-white">{step.platform}</h3>
                        </div>
                        <a 
                          href={step.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-flex items-center space-x-2"
                        >
                          <span>Open Settings</span>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    {/* Steps */}
                    <div className="p-6 space-y-6">
                      {/* Step 1 */}
                      <div className="flex items-start space-x-4">
                        <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">
                          1
                        </div>
                        <div>
                          <p className="text-white font-medium mb-2">Visit Settings Page</p>
                          <p className="text-gray-400 text-sm">Click the button above to open the data controls directly</p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-start space-x-4">
                        <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">
                          2
                        </div>
                        <div>
                          <p className="text-white font-medium mb-2">Request Export</p>
                          <p className="text-gray-400 text-sm">Look for "Export" or "Download" button and click it</p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex items-start space-x-4">
                        <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">
                          3
                        </div>
                        <div>
                          <p className="text-white font-medium mb-2">Check Your Email</p>
                          <p className="text-gray-400 text-sm">Download file when it arrives (usually within 5-10 minutes)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Problem and Solution Section */}
        <section className="min-h-screen flex items-center justify-center px-6 relative">
          <div className="max-w-6xl mx-auto">
            
            {/* Split layout: Problem | Solution */}
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              
              {/* Problem Side */}
              <div className="space-y-8">
                <div className="text-red-400 text-sm font-mono mb-4">Error 404: Context Not Found</div>
                <h2 className="text-4xl font-light text-white mb-6 leading-tight">
                  You built a relationship
                  <br />
                  <span className="text-red-400">then had to move</span>
                </h2>
                
                <p className="text-gray-300 text-lg mb-6">
                  You spent months teaching your GPT-4 your preferences, style, and context. 
                  Then GPT-5 rolls out and you want to switch to Claude. Except you can't because Claude doesn't know you at all.
                </p>
                
                <div className="bg-gray-800/30 border border-gray-600 rounded-xl p-6">
                  <div className="text-lg text-gray-300 mb-4 italic">
                    "I'm a developer working on React projects. I prefer clean code, minimal design. 
                    I'm currently building a landing page with animations. My coding style is..."
                  </div>
                  <div className="text-sm text-red-400">← You, explaining yourself to every new AI model. Again. And again.</div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Time wasted: Hours every switch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Relationship lost: Everything</span>
                  </div>
                </div>
              </div>

              {/* Solution Side */}
              <div className="space-y-8">
                <div className="text-green-400 text-sm font-mono mb-4">Solution</div>
                <h3 className="text-4xl font-light text-white mb-6 leading-tight">
                  One file carries 
                  <br />
                  <span className="text-white font-medium">your entire context</span>
                </h3>

                <p className="text-gray-300 text-lg mb-6">
                  Upload your conversations, get a compressed context pack, 
                  then paste it into any AI model.
                </p>

                <div className="bg-gray-800/30 border border-gray-600 rounded-xl p-6 mb-6">
                  <div className="text-sm text-white mb-3">After you upload your context pack:</div>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      <span>Copy your personalized context pack</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      <span>Paste it into ChatGPT, Claude, or Gemini</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                      <span>Start chatting - it knows you instantly</span>
                    </div>
                  </div>
                </div>

                {/* Free Credits Callout */}
                <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-400/30 rounded-xl p-6 mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 bg-green-400 rounded-full flex items-center justify-center">
                      <span className="text-black text-sm font-bold">✓</span>
                    </div>
                    <div className="text-green-300 font-semibold text-lg">Try it FREE right now</div>
                  </div>
                  <div className="text-white mb-3">
                    Get <span className="font-bold text-green-300">5 free credits</span> when you sign up – no payment required!
                  </div>
                  <div className="text-sm text-gray-300">
                    That's enough to process thousands of conversations and create your first context pack.
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400 mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Time saved: Hours → 30 seconds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Context preserved: 100%</span>
                  </div>
                </div>

                <a 
                  href="/process"
                  className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-lg text-lg font-medium transition-all duration-300 hover:bg-gray-100 group"
                >
                  <span>Create My Context Pack</span>
                  <div className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-1">→</div>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Challenge Section */}
        <section className="min-h-screen flex items-center justify-center px-6 relative bg-gray-900/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="text-gray-300 text-sm font-mono mb-4">The Technical Challenge</div>
              <h2 className="text-5xl font-light text-white mb-6 leading-tight">
                The real problem isn't just 
                <br />
                <span className="text-white font-medium">size and mess</span>
              </h2>
              <p className="text-gray-300 text-xl max-w-3xl mx-auto leading-relaxed">
                Exports are massive and unstructured. Manual processing would take forever.
              </p>
            </div>

            {/* Problem Stats */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <div className="text-center p-6 bg-black rounded-xl border border-gray-500">
                <div className="text-3xl font-bold text-white mb-2">100-200MB</div>
                <div className="text-gray-300">Typical export size</div>
              </div>
              <div className="text-center p-6 bg-black rounded-xl border border-gray-500">
                <div className="text-3xl font-bold text-white mb-2">1000+</div>
                <div className="text-gray-300">Conversations to parse</div>
              </div>
              <div className="text-center p-6 bg-black rounded-xl border border-gray-500">
                <div className="text-3xl font-bold text-white mb-2">20+ Hours</div>
                <div className="text-gray-300">Manual extraction time</div>
              </div>
            </div>

            {/* Solution Process */}
            <div className="bg-gray-800/30 border border-gray-600 rounded-2xl p-8">
              <div className="text-center mb-8">
                <h3 className="text-3xl font-light text-white mb-4">
                  Our <span className="text-white font-medium">AI-Powered Solution</span>
                </h3>
                <p className="text-gray-300 text-lg">
                  We built advanced algorithms and AI processing to handle the heavy lifting
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">1</div>
                    <div>
                      <h4 className="text-lg font-medium text-white mb-2">Smart Data Extraction</h4>
                      <p className="text-gray-300 text-sm">Our algorithms parse through messy JSON, filter out noise, and extract only meaningful conversation content.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">2</div>
                    <div>
                      <h4 className="text-lg font-medium text-white mb-2">AI Chunking & Analysis</h4>
                      <p className="text-gray-300 text-sm">We break your conversations into optimal chunks and feed them to advanced AI models for pattern recognition.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">3</div>
                    <div>
                      <h4 className="text-lg font-medium text-white mb-2">Comprehensive Profile Generation</h4>
                      <p className="text-gray-300 text-sm">AI creates a detailed report of your communication style, preferences, expertise areas, and behavioral patterns.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-black/50 rounded-xl p-6 border border-gray-600">
                  <div className="text-xs text-gray-300 mb-3 font-mono">Generated Context Report</div>
                  <div className="text-xs font-mono space-y-2 text-gray-300">
                    <div className="text-white"># Personal AI Context Pack</div>
                    <div>## Communication Style Analysis:</div>
                    <div className="ml-4">- Direct, technical communication</div>
                    <div className="ml-4">- Prefers concise explanations</div>
                    <div className="ml-4">- Values clean, minimal design</div>
                    <div></div>
                    <div>## Expertise Areas Detected:</div>
                    <div className="ml-4">- React/Next.js development</div>
                    <div className="ml-4">- Frontend architecture</div>
                    <div className="ml-4">- UI/UX design principles</div>
                    <div></div>
                    <div>## Current Project Context:</div>
                    <div className="ml-4">- Building landing pages</div>
                    <div className="ml-4">- Animation implementation</div>
                    <div className="ml-4">- User experience optimization</div>
                    <div></div>
                    <div className="text-gray-500">## Patterns extracted from 847 conversations</div>
                  </div>
                </div>
              </div>

              <div className="text-center mt-12">
                <p className="text-gray-300 text-lg mb-6">
                  <strong className="text-white">Result:</strong> A comprehensive, portable context file that any AI can understand instantly
                </p>
                <a 
                  href="/process"
                  className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-lg text-lg font-medium transition-all duration-300 hover:bg-gray-100"
                >
                  <span>Try Our AI Processing</span>
                  <div className="w-6 h-6">→</div>
                </a>
              </div>
            </div>
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
