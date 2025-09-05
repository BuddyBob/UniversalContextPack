// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  profile: `${API_BASE_URL}/api/profile`,
  userProfile: `${API_BASE_URL}/api/user/profile`,
  status: (jobId: string) => `${API_BASE_URL}/api/status/${jobId}`,
  progressStream: (jobId: string) => `${API_BASE_URL}/api/progress-stream/${jobId}`,
  results: (jobId: string) => `${API_BASE_URL}/api/results/${jobId}`,
  jobSummary: (jobId: string) => `${API_BASE_URL}/api/job-summary/${jobId}`,
  extract: `${API_BASE_URL}/api/extract`,
  chunk: (jobId: string) => `${API_BASE_URL}/api/chunk/${jobId}`,
  analyze: (jobId: string) => `${API_BASE_URL}/api/analyze/${jobId}`,
  downloadPack: (jobId: string) => `${API_BASE_URL}/api/download/${jobId}/pack`,
  downloadChunk: (ucpId: string, chunkIndex: number) => `${API_BASE_URL}/api/download/${ucpId}/chunk/${chunkIndex}`,
  downloadComplete: (ucpId: string) => `${API_BASE_URL}/api/download/${ucpId}/complete`,
  downloadUltraCompact: (ucpId: string) => `${API_BASE_URL}/api/download/${ucpId}/ultra-compact`,
  downloadStandard: (ucpId: string) => `${API_BASE_URL}/api/download/${ucpId}/standard`,
  downloadChunked: (ucpId: string) => `${API_BASE_URL}/api/download/${ucpId}/chunked`,
  downloadChunkedPart: (ucpId: string, partNumber: number) => `${API_BASE_URL}/api/download/${ucpId}/chunked/${partNumber}`,
  ucpInfo: (ucpId: string) => `${API_BASE_URL}/api/ucp-info/${ucpId}`,
  downloadResult: (ucpId: string, index: number) => {
    const paddedIndex = index.toString().padStart(3, '0');
    return `${API_BASE_URL}/api/download/${ucpId}/result_${paddedIndex}.json`;
  },
  downloadSummary: (ucpId: string) => `${API_BASE_URL}/api/download/${ucpId}/summary.json`,
  createPaymentIntent: `${API_BASE_URL}/api/create-payment-intent`,
  createCheckoutSession: `${API_BASE_URL}/api/create-checkout-session`,
  addCreditsManual: `${API_BASE_URL}/api/add-credits-manual`,
  paymentStatus: `${API_BASE_URL}/api/payment/status`,
};

export default API_BASE_URL;
