'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Users, Activity, TrendingUp } from 'lucide-react'

interface AnalyticsData {
  totalPageviews: number
  uniqueVisitors: number
  conversionRate: number
  topPages: { page: string; views: number }[]
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // This would connect to your analytics API
    // For now, showing placeholder data
    setTimeout(() => {
      setData({
        totalPageviews: 1250,
        uniqueVisitors: 892,
        conversionRate: 12.5,
        topPages: [
          { page: '/', views: 650 },
          { page: '/process', views: 420 },
          { page: '/pricing', views: 180 },
        ]
      })
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
            <div className="grid grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics Dashboard</h1>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Pageviews"
            value={data?.totalPageviews.toLocaleString() || '0'}
            icon={<Activity className="w-6 h-6" />}
            trend="+12%"
          />
          <MetricCard
            title="Unique Visitors"
            value={data?.uniqueVisitors.toLocaleString() || '0'}
            icon={<Users className="w-6 h-6" />}
            trend="+8%"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${data?.conversionRate || 0}%`}
            icon={<TrendingUp className="w-6 h-6" />}
            trend="+2.1%"
          />
          <MetricCard
            title="Active Users"
            value="248"
            icon={<BarChart3 className="w-6 h-6" />}
            trend="+15%"
          />
        </div>

        {/* Top Pages */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Pages</h2>
          <div className="space-y-4">
            {data?.topPages.map((page, index) => (
              <div key={page.page} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-500">#{index + 1}</span>
                  <span className="font-medium">{page.page}</span>
                </div>
                <span className="text-gray-600">{page.views} views</span>
              </div>
            ))}
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Analytics Setup</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>1. Get your Google Analytics 4 tracking ID from the GA4 dashboard</p>
            <p>2. Add it to your environment variables as <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_GA_ID</code></p>
            <p>3. Deploy your changes to start tracking real user data</p>
            <p>4. Data will appear in your GA4 dashboard within 24-48 hours</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ 
  title, 
  value, 
  icon, 
  trend 
}: { 
  title: string
  value: string
  icon: React.ReactNode
  trend: string
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-gray-600">{icon}</div>
        <span className="text-sm text-green-600 font-medium">{trend}</span>
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
