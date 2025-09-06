'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Brain, BarChart3, Clock, CheckCircle } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { API_ENDPOINTS } from '@/lib/api'
import { analytics } from '@/lib/analytics'

interface UCPResult {
  ucpId: string
  status: string
  totalChunks: number
  completedChunks: number
  totalInputTokens?: number
  totalOutputTokens?: number
  totalCost?: number
  completedAt?: string
  chunks?: any[]
}

export default function ResultsPage({ params }: { params: { ucpId: string } }) {
  const { session, user } = useAuth()
  const router = useRouter()
  const [result, setResult] = useState<UCPResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper function to format token counts
  const formatTokenCount = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${Math.round(tokens / 1000000)}M tokens`
    } else if (tokens >= 1000) {
      return `${Math.round(tokens / 1000)}k tokens`
    }
    return `${tokens} tokens`
  }

  // Check if download options should be enabled
  const canDownloadCompact = (outputTokens: number | undefined): boolean => {
    return !outputTokens || outputTokens >= 50000
  }

  const canDownloadStandard = (outputTokens: number | undefined): boolean => {
    return !outputTokens || outputTokens >= 100000
  }

  useEffect(() => {
    // Check if user is authenticated
    if (!user) {
      setError('Authentication required. Please sign in to view results.')
      setLoading(false)
      return
    }

    if (params.ucpId) {
      // Try to load from localStorage first
      const cached = localStorage.getItem(`ucp_result_${params.ucpId}`)
      if (cached) {
        try {
          const cachedResult = JSON.parse(cached)
          setResult(cachedResult)
          setLoading(false)
          // Still fetch fresh data in background
          fetchResult(params.ucpId)
          return
        } catch (e) {
          // Failed to parse cached result
        }
      }
      
      fetchResult(params.ucpId)
    }
  }, [params.ucpId, user])

  const fetchResult = async (ucpId: string) => {
    try {
      setLoading(true)
      const headers: Record<string, string> = {}
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch(API_ENDPOINTS.results(ucpId), {
        headers,
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError('UCP result not found. Please check the URL or try uploading again.')
        } else if (response.status === 401) {
          setError('Authentication required. Please sign in to view results.')
        } else {
          setError('Failed to load results. Please try again.')
        }
        return
      }

      const data = await response.json()
      setResult(data)
      
      // Cache the result
      localStorage.setItem(`ucp_result_${ucpId}`, JSON.stringify(data))
      
    } catch (err) {
      setError('Failed to load results. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const downloadUltraCompact = async () => {
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(API_ENDPOINTS.downloadUltraCompact(params.ucpId), {
        headers,
      })
      
      if (!response.ok) throw new Error('Ultra-compact UCP not available')
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ultra_compact_ucp_${params.ucpId}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Ultra-compact UCP not available for this job')
    }
  }

  const downloadStandard = async () => {
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(API_ENDPOINTS.downloadStandard(params.ucpId), {
        headers,
      })
      
      if (!response.ok) throw new Error('Standard UCP not available')
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `standard_ucp_${params.ucpId}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Standard UCP not available for this job')
    }
  }

  const downloadComplete = async () => {
    try {
      // Track download
      analytics.downloadUCP();
      
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(API_ENDPOINTS.downloadComplete(params.ucpId), {
        headers,
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to download complete UCP: ${response.status}`)
      }
      
      const blob = await response.blob()
      
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty')
      }
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `complete_ucp_${params.ucpId}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      alert(`Failed to download complete UCP: ${errorMessage}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/process')}
            className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Back to Process
          </button>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-gray-600">No result found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">UCP Results</h1>
          <p className="text-gray-600 text-sm">UCP ID: {result.ucpId}</p>
        </div>

        {/* Status & Downloads */}
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            {result.status === 'completed' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : result.status === 'processing' ? (
              <Clock className="h-5 w-5 text-gray-500" />
            ) : (
              <Brain className="h-5 w-5 text-gray-500" />
            )}
            <h2 className="text-lg font-medium text-gray-900 capitalize">
              {result.status.replace('_', ' ')}
            </h2>
          </div>
          
          {/* Download Options */}
          {result.status === 'completed' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Download UCP</h3>
              
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={canDownloadCompact(result.totalOutputTokens) ? downloadUltraCompact : undefined}
                  disabled={!canDownloadCompact(result.totalOutputTokens)}
                  className={`p-4 border rounded-lg transition-all text-center group ${
                    canDownloadCompact(result.totalOutputTokens)
                      ? 'border-gray-300 bg-white hover:bg-gray-50 cursor-pointer'
                      : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Download className={`h-5 w-5 mx-auto mb-2 group-hover:scale-110 transition-transform ${
                    canDownloadCompact(result.totalOutputTokens) ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <div className={`font-medium ${
                    canDownloadCompact(result.totalOutputTokens) ? 'text-gray-900' : 'text-gray-500'
                  }`}>Compact</div>
                  <div className={`text-sm ${
                    canDownloadCompact(result.totalOutputTokens) ? 'text-gray-500' : 'text-gray-400'
                  }`}>~50k tokens</div>
                  <div className={`text-xs ${
                    canDownloadCompact(result.totalOutputTokens) ? 'text-gray-400' : 'text-gray-300'
                  }`}>Good for GPT</div>
                </button>
                
                <button
                  onClick={canDownloadStandard(result.totalOutputTokens) ? downloadStandard : undefined}
                  disabled={!canDownloadStandard(result.totalOutputTokens)}
                  className={`p-4 border rounded-lg transition-all text-center group ${
                    canDownloadStandard(result.totalOutputTokens)
                      ? 'border-gray-300 bg-white hover:bg-gray-50 cursor-pointer'
                      : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Download className={`h-5 w-5 mx-auto mb-2 group-hover:scale-110 transition-transform ${
                    canDownloadStandard(result.totalOutputTokens) ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <div className={`font-medium ${
                    canDownloadStandard(result.totalOutputTokens) ? 'text-gray-900' : 'text-gray-500'
                  }`}>Standard</div>
                  <div className={`text-sm ${
                    canDownloadStandard(result.totalOutputTokens) ? 'text-gray-500' : 'text-gray-400'
                  }`}>~100k tokens</div>
                  <div className={`text-xs ${
                    canDownloadStandard(result.totalOutputTokens) ? 'text-gray-400' : 'text-gray-300'
                  }`}>Good for Claude</div>
                </button>
                
                <button
                  onClick={downloadComplete}
                  className="p-4 border border-gray-300 bg-white hover:bg-gray-50 rounded-lg transition-all text-center group"
                >
                  <Download className="h-5 w-5 text-gray-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <div className="font-medium text-gray-900">Complete</div>
                  <div className="text-sm text-gray-500">
                    {result.totalOutputTokens 
                      ? `~${formatTokenCount(result.totalOutputTokens)}` 
                      : 'All tokens'
                    }
                  </div>
                  <div className="text-xs text-gray-400">Good for Gemini</div>
                </button>
              </div>
            </div>
          )}

          {result.completedAt && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Completed at {new Date(result.completedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {result.status === 'processing' && (
          <div className="bg-white border border-gray-200 p-6 mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Processing Progress</span>
              <span>{Math.round((result.completedChunks / result.totalChunks) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 h-2">
              <div 
                className="bg-gray-600 h-2 transition-all duration-500"
                style={{ width: `${(result.completedChunks / result.totalChunks) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
