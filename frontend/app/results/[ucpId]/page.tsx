'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileText, Brain, BarChart3, Clock, CheckCircle } from 'lucide-react'
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
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(API_ENDPOINTS.results(ucpId), {
        headers,
      })
      
      if (response.status === 403) {
        setError('Authentication required. Please sign in to view results.')
        setLoading(false)
        return
      }
      
      if (!response.ok) throw new Error(`Failed to fetch result: ${response.status}`)
      
      const data = await response.json()
      
      // Map backend data to frontend interface
      const mappedResult: UCPResult = {
        ucpId: data.job_id || ucpId,
        status: data.status || 'unknown',
        totalChunks: data.total_chunks || 0,
        completedChunks: data.processed_chunks || data.total_chunks || 0,
        totalInputTokens: data.total_input_tokens,
        totalOutputTokens: data.total_output_tokens,
        totalCost: data.total_cost,
        completedAt: data.completed_at,
        chunks: data.chunks || []
      }
      
      setResult(mappedResult)
      
      // Cache the result in localStorage
      localStorage.setItem(`ucp_result_${ucpId}`, JSON.stringify(mappedResult))
      
      // Result loaded successfully
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load result')
    } finally {
      setLoading(false)
    }
  }

  const downloadChunk = async (chunkIndex: number) => {
    try {
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(API_ENDPOINTS.downloadChunk(params.ucpId, chunkIndex), {
        headers,
      })
      if (!response.ok) throw new Error('Failed to download chunk')
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ucp_chunk_${chunkIndex}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to download chunk')
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

  const downloadResultJson = async (chunkIndex: number) => {
    try {
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const paddedIndex = chunkIndex.toString().padStart(3, '0')
      const response = await fetch(API_ENDPOINTS.downloadResult(params.ucpId, chunkIndex), {
        headers,
      })
      if (!response.ok) throw new Error('Failed to download result JSON')
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `result_${paddedIndex}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Failed to download result_${chunkIndex.toString().padStart(3, '0')}.json`)
    }
  }

  const downloadSummary = async () => {
    try {
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(API_ENDPOINTS.downloadSummary(params.ucpId), {
        headers,
      })
      if (!response.ok) throw new Error('Failed to download summary')
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `summary_${params.ucpId}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to download summary')
    }
  }

  const downloadPack = async () => {
    try {
      // Track download
      analytics.downloadPack();
      
      const headers: Record<string, string> = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(API_ENDPOINTS.downloadPack(params.ucpId), {
        headers,
      })
      if (!response.ok) throw new Error('Failed to download pack')
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ucp_pack_${params.ucpId}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to download pack')
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-red-800 mb-4">{error}</p>
          {error.includes('Authentication') && (
            <button
              onClick={() => router.push('/process')}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              Go to Sign In
            </button>
          )}
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">UCP Results</h1>
        <p className="text-gray-600 text-sm">UCP ID: {result.ucpId}</p>
      </div>

      {/* Status & Stats */}
      <div className="bg-white border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
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
          
          {result.status === 'completed' && (
            <div className="flex space-x-3">
              <button
                onClick={downloadComplete}
                className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 text-sm font-medium transition-colors flex items-center space-x-2 border border-gray-300"
              >
                <Download className="h-4 w-4" />
                <span>Download UCP</span>
              </button>
              <button
                onClick={downloadPack}
                className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download Pack</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard 
            icon={<FileText className="h-5 w-5" />}
            title="Total Chunks" 
            value={result.totalChunks} 
          />
          <StatCard 
            icon={<CheckCircle className="h-5 w-5" />}
            title="Completed" 
            value={result.completedChunks} 
          />
          <StatCard 
            icon={<BarChart3 className="h-5 w-5" />}
            title="Input Tokens" 
            value={result.totalInputTokens?.toLocaleString() || 'N/A'} 
          />
          <StatCard 
            icon={<Brain className="h-5 w-5" />}
            title="Output Tokens" 
            value={result.totalOutputTokens?.toLocaleString() || 'N/A'} 
          />
          <StatCard 
            icon={<BarChart3 className="h-5 w-5" />}
            title="Total Cost" 
            value={result.totalCost ? `$${result.totalCost.toFixed(3)}` : 'N/A'} 
          />
        </div>

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

      {/* Result Files */}
      {result.status === 'completed' && (
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Generated Result Files</h3>
          
          <div className="grid gap-4">
            {/* Complete UCP Text File - Main deliverable */}
            <ResultFileCard 
              icon={<FileText className="h-5 w-5" />}
              title="Complete_UCP.txt"
              description="Complete Universal Context Pack - Main deliverable with all analysis"
              fileType="TXT File"
              onDownload={() => downloadComplete()}
            />
            
            {/* Individual Result JSON Files */}
            {result.completedChunks > 0 && (
              <>
                {Array.from({ length: result.completedChunks }, (_, i) => i + 1).map(chunkIndex => (
                  <ResultFileCard 
                    key={chunkIndex}
                    icon={<FileText className="h-5 w-5" />}
                    title={`Result ${chunkIndex.toString().padStart(3, '0')}.json`}
                    description={`AI analysis result for chunk ${chunkIndex}`}
                    fileType="JSON"
                    onDownload={() => downloadResultJson(chunkIndex)}
                  />
                ))}
              </>
            )}
            
            {/* Summary JSON */}
            <ResultFileCard 
              icon={<BarChart3 className="h-5 w-5" />}
              title="Analysis Summary"
              description="Processing statistics and metadata"
              fileType="JSON"
              onDownload={() => downloadSummary()}
            />
            
            {/* Individual chunks for text content if needed */}
            {result.completedChunks > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  View Individual Chunk Text Files ({result.completedChunks} files)
                </summary>
                <div className="mt-3 grid gap-2 pl-4">
                  {Array.from({ length: result.completedChunks }, (_, i) => i + 1).map(chunkIndex => (
                    <ChunkCard 
                      key={chunkIndex}
                      chunkIndex={chunkIndex}
                      onDownload={() => downloadChunk(chunkIndex)}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>

          {result.totalChunks > result.completedChunks && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-blue-800 font-medium">
                    Limited Analysis
                  </p>
                  <p className="text-blue-700 text-sm">
                    Only {result.completedChunks} out of {result.totalChunks} chunks were analyzed due to plan limits. 
                    <span className="font-medium"> Upgrade to Pro</span> to analyze all chunks.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}

function StatCard({ 
  icon, 
  title, 
  value 
}: { 
  icon: React.ReactNode, 
  title: string, 
  value: string | number 
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 p-4">
      <div className="flex items-center space-x-2 mb-2">
        <div className="text-gray-600">{icon}</div>
        <p className="text-gray-600 text-sm">{title}</p>
      </div>
      <p className="text-gray-900 text-lg font-semibold">{value}</p>
    </div>
  )
}

function ResultFileCard({ 
  icon, 
  title, 
  description,
  fileType,
  onDownload 
}: { 
  icon: React.ReactNode, 
  title: string, 
  description: string,
  fileType: string,
  onDownload: () => void 
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 p-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gray-800 flex items-center justify-center text-white text-xs font-medium rounded">
          {icon}
        </div>
        <div>
          <p className="text-gray-900 font-medium">{title}</p>
          <p className="text-gray-600 text-sm">{description}</p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
            {fileType} File
          </span>
        </div>
      </div>
      
      <button
        onClick={onDownload}
        className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-medium transition-colors flex items-center space-x-2"
      >
        <Download className="h-4 w-4" />
        <span>Download</span>
      </button>
    </div>
  )
}

function ChunkCard({ 
  chunkIndex, 
  onDownload 
}: { 
  chunkIndex: number, 
  onDownload: () => void 
}) {
  return (
    <div className="bg-gray-50 border border-gray-200 p-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gray-800 flex items-center justify-center text-white text-sm font-medium">
          {chunkIndex}
        </div>
        <div>
          <p className="text-gray-900 font-medium">Chunk {chunkIndex}</p>
          <p className="text-gray-600 text-sm">AI analysis result</p>
        </div>
      </div>
      
      <button
        onClick={onDownload}
        className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-medium transition-colors flex items-center space-x-2"
      >
        <Download className="h-4 w-4" />
        <span>Download</span>
      </button>
    </div>
  )
}
