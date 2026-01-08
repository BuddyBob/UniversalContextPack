'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import { API_BASE_URL } from '@/lib/api'

interface JobResult {
  job_id: string
  status: string
  created_at: string
  stats?: {
    total_chunks: number
    total_input_tokens: number
    total_output_tokens: number
    total_cost: number
  }
}

export default function ResultsPage() {
  const { session } = useAuth()
  const [jobs, setJobs] = useState<JobResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [jobDetails, setJobDetails] = useState<any>(null)
  const [viewingChunk, setViewingChunk] = useState<number | null>(null)
  const [chunkContent, setChunkContent] = useState<string>('')

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (e) {
      console.error('Failed to load jobs:', e)
      // Fallback to empty array if API fails
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  const loadJobDetails = async (jobId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      const data = await response.json()
      setJobDetails(data)
      setSelectedJob(jobId)
    } catch (e) {
      console.error('Failed to load job details:', e)
    }
  }

  const viewChunk = async (jobId: string, chunkIndex: number) => {
    try {
      // Use 1-based indexing to match backend
      const response = await fetch(`${API_BASE_URL}/api/download/${jobId}/chunk/${chunkIndex + 1}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      const text = await response.text()
      setChunkContent(text)
      setViewingChunk(chunkIndex)
    } catch (e) {
      console.error('Failed to load chunk:', e)
    }
  }

  const downloadFile = async (jobId: string, type: 'complete' | 'original' | 'chunks') => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/download/${jobId}/${type}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_${jobId}.${type === 'chunks' ? 'zip' : 'txt'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Download failed: ${e}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-400">Loading jobs...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-white text-center mb-12">Processing Results</h1>
        
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Jobs List */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-white mb-6">Recent Jobs</h2>
            <div className="space-y-4">
              {jobs.length === 0 ? (
                <div className="bg-gray-950 rounded-2xl p-8 text-center border border-gray-800">
                  <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <div className="w-4 h-4 bg-purple-500 rounded"></div>
                  </div>
                  <div className="text-gray-400 text-sm mb-4">No jobs found</div>
                  <a 
                    href="/packs" 
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-block"
                  >
                    Process a file
                  </a>
                </div>
              ) : (
                jobs.map(job => (
                  <div
                    key={job.job_id}
                    onClick={() => loadJobDetails(job.job_id)}
                    className={`bg-gray-950 rounded-2xl p-4 cursor-pointer transition-all border ${
                      selectedJob === job.job_id 
                        ? 'ring-2 ring-purple-500 border-purple-500' 
                        : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-mono text-sm text-gray-300">
                        {job.job_id.slice(0, 8)}...
                      </div>
                      <div className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        job.status === 'completed' 
                          ? 'bg-green-900/50 text-green-400 border border-green-800' :
                        job.status === 'processing' 
                          ? 'bg-purple-900/50 text-purple-400 border border-purple-800' :
                          'bg-red-900/50 text-red-400 border border-red-800'
                      }`}>
                        {job.status}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-400 mb-3">
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                    
                    {job.stats && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{job.stats.total_chunks} chunks</span>
                        <span>${job.stats.total_cost.toFixed(3)}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Job Details */}
          <div className="lg:col-span-3">
            {selectedJob ? (
              <div className="space-y-6">
                <div className="bg-gray-950 rounded-2xl p-6 border border-gray-800">
                  <h3 className="text-xl font-semibold text-white mb-6">Job Details</h3>
                  
                  {jobDetails?.stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <div className="bg-gray-900 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-purple-400 mb-1">
                          {jobDetails.stats.total_chunks}
                        </div>
                        <div className="text-sm text-gray-400">Chunks</div>
                      </div>
                      <div className="bg-gray-900 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-purple-300 mb-1">
                          {jobDetails.stats.total_input_tokens?.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-400">Input Tokens</div>
                      </div>
                      <div className="bg-gray-900 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-purple-200 mb-1">
                          {jobDetails.stats.total_output_tokens?.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-400">Output Tokens</div>
                      </div>
                      <div className="bg-gray-900 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-purple-100 mb-1">
                          ${jobDetails.stats.total_cost?.toFixed(3)}
                        </div>
                        <div className="text-sm text-gray-400">Total Cost</div>
                      </div>
                    </div>
                  )}

                  {/* Download Buttons */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => downloadFile(selectedJob, 'complete')}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors border border-white/20"
                    >
                       Download Complete UCP
                    </button>
                    <button
                      onClick={() => downloadFile(selectedJob, 'original')}
                      className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
                    >
                       Original Text
                    </button>
                    <button
                      onClick={() => downloadFile(selectedJob, 'chunks')}
                      className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
                    >
                       All Chunks
                    </button>
                  </div>
                </div>

                {/* Chunk Browser */}
                {jobDetails?.stats && (
                  <div className="bg-gray-950 rounded-2xl p-6 border border-gray-800">
                    <h3 className="text-xl font-semibold text-white mb-6">Browse Chunks</h3>
                    
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 mb-6">
                      {Array.from({ length: jobDetails.stats.total_chunks }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => viewChunk(selectedJob, i)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            viewingChunk === i
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>

                    {viewingChunk !== null && chunkContent && (
                      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-medium text-white">Chunk {viewingChunk + 1}</h4>
                          <button
                            onClick={() => setViewingChunk(null)}
                            className="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="bg-black rounded-lg p-4 max-h-96 overflow-y-auto">
                          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                            {chunkContent}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-950 rounded-2xl p-12 text-center border border-gray-800">
                <h3 className="text-xl font-medium text-white mb-2">Select a job to view details</h3>
                <p className="text-gray-400">Choose a processing job from the sidebar to see results and download files.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
