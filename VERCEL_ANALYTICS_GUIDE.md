# Vercel Analytics Guide

## Built-in Vercel Analytics

### 1. Web Analytics Dashboard
Access at: https://vercel.com/[your-username]/[project-name]/analytics

**Available Metrics:**
- Page views and unique visitors
- Top pages and referrers
- Device and browser data
- Geographic distribution
- Core Web Vitals performance

### 2. Real User Monitoring (RUM)
Vercel automatically tracks:
- Page load times
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- First Input Delay (FID)

### 3. Enable Vercel Analytics

Add to your Next.js app:

```bash
npm install @vercel/analytics
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### 4. Custom Event Tracking

```typescript
// lib/vercel-analytics.ts
import { track } from '@vercel/analytics'

export const vercelAnalytics = {
  // Track custom events
  fileUpload: (fileSize: number) => {
    track('File Upload', { 
      file_size_mb: Math.round(fileSize / 1024 / 1024 * 100) / 100 
    })
  },
  
  extractionComplete: (chunks: number) => {
    track('Extraction Complete', { chunk_count: chunks })
  },
  
  analysisStart: (selectedChunks: number, estimatedCost: number) => {
    track('Analysis Started', { 
      selected_chunks: selectedChunks,
      estimated_cost: estimatedCost 
    })
  },
  
  analysisComplete: (actualCost: number, tokens: number) => {
    track('Analysis Complete', { 
      actual_cost: actualCost,
      total_tokens: tokens 
    })
  },
  
  downloadUCP: () => {
    track('UCP Downloaded')
  },
  
  creditPurchase: (amount: number, credits: number) => {
    track('Credits Purchased', { 
      amount_usd: amount,
      credits_count: credits 
    })
  },
  
  // Conversion events
  userSignup: () => {
    track('User Signup')
  },
  
  firstUpload: () => {
    track('First File Upload')
  },
  
  firstAnalysis: () => {
    track('First Analysis Complete')
  }
}
```

## Combined Analytics Dashboard

Create a unified analytics view using both Supabase and Vercel data:

```typescript
// components/AdminAnalytics.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface AnalyticsData {
  // Supabase data
  totalUsers: number
  activeUsers: number
  totalProcessingJobs: number
  totalRevenue: number
  
  // Vercel data (would need to fetch via API)
  pageViews: number
  uniqueVisitors: number
  conversionRate: number
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      // Fetch Supabase analytics
      const [usersResult, jobsResult, revenueResult] = await Promise.all([
        // Total and active users
        supabase.from('profiles').select('user_id, created_at'),
        
        // Processing jobs
        supabase.from('processing_jobs').select('status, created_at, stats'),
        
        // Revenue from credit purchases
        supabase.from('credit_transactions').select('amount, created_at')
      ])

      const totalUsers = usersResult.data?.length || 0
      const activeUsers = usersResult.data?.filter(user => 
        new Date(user.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length || 0

      const totalJobs = jobsResult.data?.length || 0
      const completedJobs = jobsResult.data?.filter(job => job.status === 'completed').length || 0

      const totalRevenue = revenueResult.data?.reduce((sum, transaction) => 
        sum + (transaction.amount || 0), 0
      ) || 0

      setData({
        totalUsers,
        activeUsers,
        totalProcessingJobs: totalJobs,
        totalRevenue,
        pageViews: 0, // Would fetch from Vercel API
        uniqueVisitors: 0,
        conversionRate: totalUsers > 0 ? (completedJobs / totalUsers * 100) : 0
      })

    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading analytics...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">UCP Analytics Dashboard</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <MetricCard title="Total Users" value={data?.totalUsers || 0} />
        <MetricCard title="Active Users (30d)" value={data?.activeUsers || 0} />
        <MetricCard title="Processing Jobs" value={data?.totalProcessingJobs || 0} />
        <MetricCard title="Revenue" value={`$${(data?.totalRevenue || 0).toFixed(2)}`} />
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Quick Access</h3>
        <div className="space-y-2">
          <a 
            href="https://vercel.com/dashboard/analytics" 
            target="_blank"
            className="block text-blue-600 hover:underline"
          >
            → View Vercel Analytics Dashboard
          </a>
          <a 
            href={`https://supabase.com/dashboard/project/${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}/editor`}
            target="_blank"
            className="block text-blue-600 hover:underline"
          >
            → View Supabase Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value }: { title: string, value: string | number }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
```

## Access Your Analytics

### Supabase Dashboard:
1. Go to https://supabase.com/dashboard
2. Select your UCP project
3. Navigate to "Analytics" or "Logs" sections
4. View API requests, database activity, and auth events

### Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Select your UCP project
3. Click "Analytics" tab
4. View page views, performance metrics, and user behavior

### Custom Queries:
You can run the SQL queries I provided above in the Supabase SQL Editor to get detailed insights about:
- User behavior patterns
- Conversion funnels
- Revenue analytics
- Processing job statistics
- Geographic user distribution

Both platforms provide real-time data, so you can monitor your UCP platform's growth and usage patterns effectively!
