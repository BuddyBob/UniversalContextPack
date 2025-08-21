import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Debug function to get token - REMOVE IN PRODUCTION
if (typeof window !== 'undefined') {
  (window as any).getSupabaseToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }
  // Make supabase available globally for debugging
  (window as any).supabase = supabase
}

// Helper function for authenticated API calls
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('No authentication token available')
  }

  const headers = {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

// Database Types
export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  r2_user_directory: string
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  user_id: string
  job_id: string
  job_type: 'extract' | 'chunk' | 'analyze'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  file_name?: string
  file_size?: number
  r2_path?: string
  progress: number
  error_message?: string
  metadata?: any
  started_at: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface Pack {
  id: string
  user_id: string
  job_id: string
  pack_name: string
  r2_pack_path: string
  extraction_stats?: any
  chunk_stats?: any
  analysis_stats?: any
  file_size?: number
  created_at: string
}

export interface UserUsage {
  id: string
  user_id: string
  month: string
  jobs_count: number
  total_tokens_processed: number
  total_files_processed: number
  storage_used_bytes: number
  created_at: string
  updated_at: string
}
