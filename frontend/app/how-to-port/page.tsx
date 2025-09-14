'use client'

import { useState } from 'react'
import { ArrowLeft, Copy, CheckCircle } from 'lucide-react'
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

  const codeExamples = [
    {
      platform: 'AI Platform',
      prompt: `Here is my conversation history and context from another AI. Please review this and acknowledge that you understand my previous conversations and context.

[Paste your Universal Context Pack above this line]`
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Documentation</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-lg font-semibold text-gray-900">Context Pack Integration</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Context Pack Integration</h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Import your Universal Context Pack into any AI platform to maintain conversation history and context across different services.
            </p>
          </div>

          {/* Quick Start */}
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Start</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <ol className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-900 text-white text-xs font-medium rounded-full flex items-center justify-center mr-3 mt-0.5">1</span>
                  <span><strong>Download your Context Pack:</strong> Navigate to your packs page and download the <code className="bg-gray-200 px-1 rounded text-sm">ucp_complete.txt</code> file</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-900 text-white text-xs font-medium rounded-full flex items-center justify-center mr-3 mt-0.5">4</span>
                  <span>Add a context prompt to help the AI understand the import</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-900 text-white text-xs font-medium rounded-full flex items-center justify-center mr-3 mt-0.5">3</span>
                  <span>Paste your Context Pack as the first message</span>
                </li>
              </ol>
            </div>
          </div>

          {/* Download Instructions */}
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Downloading Your Context Pack</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-xs font-medium rounded-full flex items-center justify-center mt-0.5">!</div>
                <div>
                  <h3 className="text-base font-medium text-blue-900 mb-2">Important: Download the Complete Pack</h3>
                  <p className="text-blue-800 text-sm">
                    Download your <code className="bg-blue-100 px-1 rounded">complete_ucp.txt</code> file from the packs tab. 
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Integration */}
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Platform Integration</h2>
            
            {codeExamples.map((example, index) => (
              <div key={example.platform} className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-3">{example.platform}</h3>
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                    <span className="text-sm font-medium text-gray-300">Prompt Template</span>
                    <button
                      onClick={() => copyToClipboard(example.prompt, example.platform)}
                      className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
                    >
                      {copiedSteps[example.platform] ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span className="text-sm">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-4">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                      {example.prompt}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>


          {/* Troubleshooting */}
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Troubleshooting</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-2">Context not recognized</h3>
                <p className="text-gray-600 text-sm">
                  If the AI doesn't seem to understand your context, try rephrasing the prompt or breaking the Context Pack into smaller chunks.
                </p>
              </div>
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-2">File too large</h3>
                <p className="text-gray-600 text-sm">
                  Most platforms have message length limits. Consider using the compact version of your Context Pack or importing in multiple messages.
                </p>
              </div>
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-2">Partial context transfer</h3>
                <p className="text-gray-600 text-sm">
                  Verify the entire Context Pack was pasted correctly. Some platforms may truncate long messages during copy/paste operations.
                </p>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="border-t border-gray-200 pt-8">
            <div className="text-center">
              <p className="text-gray-600 mb-4">Need help with integration?</p>
              <Link 
                href="/process"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Create Context Pack
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HowToPortPage