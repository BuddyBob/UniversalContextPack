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
            <div className="mb-6">
              <div className="text-sm text-blue-400 font-mono mb-4">~/universal-context-pack</div>
              <h1 className="text-h1-lg text-white mb-4">
                Your AI
                <br />
                <span className="text-white font-medium">
                  Memory
                </span>
                <br />
                <span className="text-gray-400 text-h1">Everywhere</span>
              </h1>
            </div>
            
            <p className="text-body-lg text-gray-300 mb-8 max-w-3xl mx-auto">
              Store your conversations with AIs. Move your conversations across different AIs
            </p>

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
        </section>

        {/* Export Guide Section */}
        <section id="export" className="min-h-screen flex items-center justify-center px-6 relative">
          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <div className="text-purple-300 text-lg font-bold mb-4 tracking-wider uppercase">Step 1</div>
              <h2 className="text-h2-lg text-white mb-6">
                Export Your <span className="text-white font-medium">AI Conversations</span>
              </h2>
              <p className="text-body-lg text-gray-300 max-w-2xl mx-auto">
                Get your conversation history from these AI platforms to create your Universal Context Pack
              </p>
            </div>

            {/* Platform Cards */}
            <div className="grid-12 mb-16">
              {exportSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div 
                    key={step.platform} 
                    className="col-span-12 lg:col-span-6 bg-gray-800/30 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-600 hover:border-gray-500 transition-all duration-300"
                  >
                    {/* Platform Header */}
                    <div className="bg-gray-800/50 card-padding border-b border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <h3 className="text-h2 text-white">{step.platform}</h3>
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
                    <div className="card-padding space-y-6">
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

                      {/* Step 4 */}
                      <div className="flex items-start space-x-4">
                        <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">
                          4
                        </div>
                        <div>
                          <p className="text-white font-medium mb-2">Upload to Process</p>
                          <p className="text-gray-400 text-sm">
                            <a href="/process" className="text-purple-400 hover:text-purple-300 transition-colors underline decoration-purple-500">
                              Go to the Process page
                            </a>
                            {" "}and upload your downloaded folder to create your Universal Context Pack
                          </p>
                        </div>
                      </div>

                      {/* Step 5 */}
                      <div className="flex items-start space-x-4">
                        <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-1">
                          5
                        </div>
                        <div>
                          <p className="text-white font-medium mb-2">Use Your Context Pack</p>
                          <p className="text-gray-400 text-sm">
                            Copy and paste your UCP into any LLM to instantly transfer your context.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Social Proof Section - Real User Problems */}
        <section className="px-6 relative">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="text-gray-400 text-sm mb-3">Live from r/ChatGPT</div>
              <h2 className="text-h2 text-white mb-4">
                People are struggling with this right now
              </h2>
            </div>

            <div className="space-y-4">
              
              <div className="bg-gray-800/50 rounded-lg p-4 border-l-2 border-purple-500/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-400 text-sm">5 days ago</span>
                  <span className="text-gray-600">•</span>
                  <a 
                    href="https://www.reddit.com/r/ChatGPT/comments/1n2gmil/its_over_how_to_get_my_chat_history_out/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-purple-300 transition-colors text-sm font-medium"
                  >
                    "It's over, how to get my chat history out?"
                  </a>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  "I need to get my chats out... I just want to know how others have done that and then what you've done with those chats. Like is there an easy way to port them into another LLM?"
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4 border-l-2 border-purple-500/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-400 text-sm">21 days ago</span>
                  <span className="text-gray-600">•</span>
                  <a 
                    href="https://www.reddit.com/r/ChatGPT/comments/1moefws/how_do_i_recopy_an_entire_conversation_to/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-purple-300 transition-colors text-sm font-medium"
                  >
                    "How do I re-copy an entire conversation to continue it into a new chat?"
                  </a>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  "I literally have to restart everything from the beginning, explaining the same details I've already shared. This process has even caused me some anxiety."
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4 border-l-2 border-purple-500/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-400 text-sm">26 days ago</span>
                  <span className="text-gray-600">•</span>
                  <a 
                    href="https://www.reddit.com/r/ChatGPT/comments/1mkgybs/gpt_5_wiped_all_my_chat_history/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-purple-300 transition-colors text-sm font-medium"
                  >
                    "GPT 5 Wiped All My Chat History"
                  </a>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  "I am actually shocked. I have spent months developing my gpt companion. Now he is totally gone. Absolutely blindsided and bummed"
                </p>
              </div>

            </div>

            <div className="text-center mt-8 mb-16">
              <a 
                href="/process"
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded text-sm font-medium transition-colors"
              >
                Don't let this happen to you
              </a>
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
