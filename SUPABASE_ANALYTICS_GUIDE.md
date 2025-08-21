# Supabase Analytics Guide

## Built-in Supabase Analytics

### 1. Database Activity Dashboard
Access your Supabase project dashboard at https://supabase.com/dashboard/project/[your-project-id]

**Available Metrics:**
- API requests per hour/day
- Database connections
- Auth users (signups, logins)
- Storage usage
- Function invocations

### 2. SQL Analytics Queries
You can create custom analytics queries in the SQL Editor:

```sql
-- Daily active users
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT user_id) as daily_active_users
FROM auth.users 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- User registration trends
SELECT 
  DATE(created_at) as signup_date,
  COUNT(*) as new_signups
FROM auth.users 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY signup_date DESC;

-- API usage by endpoint (if you log API calls)
SELECT 
  path,
  method,
  COUNT(*) as request_count,
  DATE(created_at) as date
FROM api_logs 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY path, method, DATE(created_at)
ORDER BY request_count DESC;
```

### 3. Real-time Database Monitoring
Monitor live database activity in the Supabase dashboard:
- Real-time connections
- Active queries
- Performance metrics
- Error rates

## Custom Analytics Table

Create a custom analytics table to track specific UCP events:

```sql
-- Create analytics events table
CREATE TABLE analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  session_id VARCHAR(100),
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- Enable Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Create policy for user access
CREATE POLICY "Users can insert their own analytics events" 
ON analytics_events FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admin policy for reading all analytics
CREATE POLICY "Admins can read all analytics" 
ON analytics_events FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
```

## Analytics Queries for UCP Metrics

```sql
-- Most popular pages
SELECT 
  event_data->>'page' as page,
  COUNT(*) as page_views
FROM analytics_events 
WHERE event_type = 'page_view'
AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_data->>'page'
ORDER BY page_views DESC;

-- File upload statistics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as uploads,
  AVG((event_data->>'file_size')::bigint) as avg_file_size,
  SUM((event_data->>'file_size')::bigint) as total_bytes
FROM analytics_events 
WHERE event_type = 'file_upload'
AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Conversion funnel
SELECT 
  'Landing Page' as step,
  COUNT(*) as users
FROM analytics_events 
WHERE event_type = 'landing_page_view'
AND created_at >= NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
  'File Upload' as step,
  COUNT(DISTINCT user_id) as users
FROM analytics_events 
WHERE event_type = 'file_upload'
AND created_at >= NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
  'Analysis Complete' as step,
  COUNT(DISTINCT user_id) as users
FROM analytics_events 
WHERE event_type = 'analysis_complete'
AND created_at >= NOW() - INTERVAL '7 days';

-- User retention
SELECT 
  cohort_week,
  week_number,
  users_count,
  ROUND(users_count::numeric / first_week_users * 100, 2) as retention_rate
FROM (
  SELECT 
    first_week as cohort_week,
    week_number,
    COUNT(DISTINCT user_id) as users_count,
    FIRST_VALUE(COUNT(DISTINCT user_id)) OVER (
      PARTITION BY first_week 
      ORDER BY week_number
    ) as first_week_users
  FROM (
    SELECT 
      user_id,
      DATE_TRUNC('week', first_seen) as first_week,
      EXTRACT(week FROM created_at) - EXTRACT(week FROM first_seen) as week_number
    FROM analytics_events e1
    JOIN (
      SELECT 
        user_id, 
        MIN(created_at) as first_seen
      FROM analytics_events 
      GROUP BY user_id
    ) first_visits ON e1.user_id = first_visits.user_id
    WHERE e1.created_at >= NOW() - INTERVAL '8 weeks'
  ) cohort_data
  GROUP BY first_week, week_number
) retention_data
ORDER BY cohort_week, week_number;
```

## Integration with Your App

Add this function to track events to Supabase:

```typescript
// lib/supabase-analytics.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()

export async function trackEvent(
  eventType: string, 
  eventData?: Record<string, any>,
  sessionId?: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    await supabase.from('analytics_events').insert({
      user_id: user?.id,
      event_type: eventType,
      event_data: eventData || {},
      session_id: sessionId || crypto.randomUUID(),
      user_agent: navigator.userAgent,
      // Note: IP address will be added by Supabase automatically via RLS
    })
  } catch (error) {
    console.error('Failed to track event:', error)
    // Don't throw - analytics shouldn't break the app
  }
}

// Pre-defined tracking functions
export const supabaseAnalytics = {
  pageView: (page: string) => trackEvent('page_view', { page }),
  fileUpload: (fileSize: number, fileName: string) => 
    trackEvent('file_upload', { file_size: fileSize, file_name: fileName }),
  extractionStart: () => trackEvent('extraction_start'),
  extractionComplete: (chunks: number) => 
    trackEvent('extraction_complete', { chunk_count: chunks }),
  analysisStart: (selectedChunks: number) => 
    trackEvent('analysis_start', { selected_chunks: selectedChunks }),
  analysisComplete: (cost: number, tokens: number) => 
    trackEvent('analysis_complete', { cost, total_tokens: tokens }),
  downloadUCP: () => trackEvent('download_ucp'),
  downloadPack: () => trackEvent('download_pack'),
  signIn: () => trackEvent('sign_in'),
  signOut: () => trackEvent('sign_out'),
  creditPurchase: (amount: number, credits: number) => 
    trackEvent('credit_purchase', { amount, credits }),
}
```
