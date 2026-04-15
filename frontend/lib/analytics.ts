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

// Send a funnel event to the backend server log (fire-and-forget)
export const sendServerEvent = (
  eventName: string,
  token: string,
  props?: { pack_id?: string; label?: string; value?: number }
) => {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  fetch(`${API_BASE_URL}/api/v2/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ event: eventName, ...props }),
    keepalive: true,
  }).catch(() => {});
};

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

  // Process page funnel (pack created → upload started)
  packPageLoaded: () => trackUCPEvent('pack_page_loaded'),
  sourceTileHovered: (tile: string) => trackUCPEvent('source_tile_hovered', { label: tile }),
  sourceTileClicked: (tile: string) => trackUCPEvent('source_tile_clicked', { label: tile }),
  filePickerOpened: () => trackUCPEvent('file_picker_opened'),
  fileSelected: () => trackUCPEvent('file_selected'),
  packAbandoned: (secondsOnPage: number) => trackUCPEvent('pack_abandoned', { value: secondsOnPage }),
}
