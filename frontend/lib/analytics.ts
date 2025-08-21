// Google Analytics 4 integration
declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: any) => void;
  }
}

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (url: string) => {
  if (typeof window !== 'undefined' && GA_TRACKING_ID) {
    window.gtag('config', GA_TRACKING_ID, {
      page_location: url,
    })
  }
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = ({
  action,
  category,
  label,
  value,
}: {
  action: string
  category: string
  label?: string
  value?: number
}) => {
  if (typeof window !== 'undefined' && GA_TRACKING_ID) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}

// Track UCP-specific events
export const trackUCPEvent = (eventName: string, properties?: Record<string, any>) => {
  event({
    action: eventName,
    category: 'UCP',
    label: properties?.label,
    value: properties?.value,
  })
}

// Pre-defined UCP events
export const analytics = {
  // User journey events
  landingPage: () => trackUCPEvent('landing_page_view'),
  exportGuideView: () => trackUCPEvent('export_guide_view'),
  processPageView: () => trackUCPEvent('process_page_view'),
  
  // File processing events
  fileUpload: (fileSize: number) => trackUCPEvent('file_upload', { value: fileSize }),
  extractionStart: () => trackUCPEvent('extraction_start'),
  extractionComplete: (chunks: number) => trackUCPEvent('extraction_complete', { value: chunks }),
  analysisStart: (chunks: number) => trackUCPEvent('analysis_start', { value: chunks }),
  analysisComplete: (cost: number) => trackUCPEvent('analysis_complete', { value: Math.round(cost * 100) }),
  
  // Download events
  downloadUCP: () => trackUCPEvent('download_ucp'),
  downloadPack: () => trackUCPEvent('download_pack'),
  downloadChunk: (chunkIndex: number) => trackUCPEvent('download_chunk', { value: chunkIndex }),
  
  // User actions
  signIn: () => trackUCPEvent('sign_in'),
  signOut: () => trackUCPEvent('sign_out'),
  creditPurchase: (amount: number) => trackUCPEvent('credit_purchase', { value: amount }),
  
  // Errors
  error: (errorType: string) => trackUCPEvent('error', { label: errorType }),
}
