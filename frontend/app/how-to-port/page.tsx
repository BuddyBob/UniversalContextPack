'use client'

import { useState } from 'react'
import { ArrowLeft, Copy, CheckCircle, ExternalLink, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const HowToPortPage = () => {
  const [copiedSteps, setCopiedSteps] = useState<{[key: string]: boolean}>({})

  const copyToClipboard = (text: string, stepId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSteps(prev => ({ ...prev, [stepId]: true }))
    setTimeout(() => {
      setCopiedSteps(prev => ({ ...prev, [stepId]: false }))
    }, 2000)
  }

  const platforms = [
    {
      name: 'ChatGPT',
      icon: '🤖',
      color: 'from-green-500 to-teal-500',
      instructions: [
        {
          title: 'Start a New Chat',
          description: 'Open ChatGPT and create a fresh conversation',
          action: 'Click "New chat" in the sidebar'
        },
        {
          title: 'Paste Your Context Pack',
          description: 'Copy your entire Universal Context Pack and paste it as the first message',
          copyText: 'Here is my conversation history and context from another AI. Please review this and acknowledge that you understand my previous conversations and context.',
          action: 'Paste the Context Pack, then add the prompt above'
        },
        {
          title: 'Verify Understanding',
          description: 'ChatGPT will confirm it has reviewed your context',
          action: 'Continue your conversation with full context!'
        }
      ]
    },
    {
      name: 'Claude',
      icon: '🧠',
      color: 'from-orange-500 to-red-500',
      instructions: [
        {
          title: 'Create New Conversation',
          description: 'Start a fresh chat with Claude',
          action: 'Click "New conversation" or the "+" button'
        },
        {
          title: 'Import Your Context',
          description: 'Paste your Context Pack with a clear instruction',
          copyText: 'I\'m continuing a conversation from another AI. Here is my complete conversation history and context. Please review and acknowledge that you understand my background before we continue.',
          action: 'Paste Context Pack + the prompt above'
        },
        {
          title: 'Continue Seamlessly',
          description: 'Claude will acknowledge your context and continue naturally',
          action: 'Your conversation context is now fully transferred!'
        }
      ]
    },
    {
      name: 'Grok',
      icon: '🚀',
      color: 'from-blue-500 to-purple-500',
      instructions: [
        {
          title: 'Open New Chat',
          description: 'Navigate to Grok and start a new conversation',
          action: 'Click "New chat" or similar option'
        },
        {
          title: 'Transfer Context',
          description: 'Paste your Universal Context Pack with context',
          copyText: 'I have conversation history from another AI that I want to continue here. Please review this context and let me know you understand my previous interactions.',
          action: 'Paste your Context Pack followed by the prompt'
        },
        {
          title: 'Verify and Continue',
          description: 'Grok will confirm understanding of your context',
          action: 'Resume your conversation with complete context!'
        }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Home</span>
            </Link>
            <div className="h-6 w-px bg-gray-700"></div>
            <h1 className="text-2xl font-bold text-white">How to Port Your Context Pack</h1>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </div>
            <h2 className="text-4xl font-bold text-white mb-4">
              Transfer Your Conversations
              <br />
              <span className="text-purple-400">Across Any AI Platform</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Step-by-step tutorials for seamlessly importing your Universal Context Pack into different AI platforms
            </p>
          </div>

          {/* Quick Tips */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 mb-12">
            <h3 className="text-lg font-semibold text-blue-300 mb-4">💡 Pro Tips for Successful Porting</h3>
            <div className="grid md:grid-cols-2 gap-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-400 text-xs">1</span>
                </div>
                <p className="text-gray-300 text-sm">Always paste your Context Pack as the <strong>first message</strong> in a new conversation</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-400 text-xs">2</span>
                </div>
                <p className="text-gray-300 text-sm">Use the provided prompts to help the AI <strong>understand the context</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-400 text-xs">3</span>
                </div>
                <p className="text-gray-300 text-sm">Wait for <strong>confirmation</strong> before continuing your conversation</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-400 text-xs">4</span>
                </div>
                <p className="text-gray-300 text-sm">Test with a <strong>follow-up question</strong> to verify the context transfer</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Tutorials */}
      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-1 gap-8">
            {platforms.map((platform, platformIndex) => (
              <div key={platform.name} className="bg-gray-800/30 rounded-2xl p-8 border border-gray-700">
                {/* Platform Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className={`w-16 h-16 bg-gradient-to-r ${platform.color} rounded-xl flex items-center justify-center text-2xl`}>
                    {platform.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Porting to {platform.name}</h3>
                    <p className="text-gray-400">Follow these steps to transfer your context</p>
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-6">
                  {platform.instructions.map((instruction, index) => (
                    <div key={index} className="flex gap-6">
                      {/* Step Number */}
                      <div className="flex-shrink-0">
                        <div className={`w-10 h-10 bg-gradient-to-r ${platform.color} rounded-full flex items-center justify-center text-white font-bold`}>
                          {index + 1}
                        </div>
                        {index < platform.instructions.length - 1 && (
                          <div className="w-px h-8 bg-gray-600 mx-auto mt-4"></div>
                        )}
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 pb-6">
                        <h4 className="text-lg font-semibold text-white mb-2">{instruction.title}</h4>
                        <p className="text-gray-300 mb-4">{instruction.description}</p>
                        
                        {/* Copy Prompt */}
                        {instruction.copyText && (
                          <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-300">Suggested Prompt:</span>
                              <button
                                onClick={() => copyToClipboard(instruction.copyText!, `${platform.name}-${index}`)}
                                className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
                              >
                                {copiedSteps[`${platform.name}-${index}`] ? (
                                  <>
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="text-sm">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-4 w-4" />
                                    <span className="text-sm">Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-gray-200 text-sm italic">"{instruction.copyText}"</p>
                          </div>
                        )}

                        {/* Action */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <p className="text-blue-300 text-sm">
                            <strong>Action:</strong> {instruction.action}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-6 border-t border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to Create Your Context Pack?</h2>
          <p className="text-gray-300 mb-8">
            Export your conversations and create a Universal Context Pack to start porting between AI platforms
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/process"
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              <span>Create Context Pack</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link 
              href="/"
              className="inline-flex items-center gap-2 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white px-6 py-3 rounded-lg transition-colors"
            >
              <span>Back to Export Guide</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HowToPortPage