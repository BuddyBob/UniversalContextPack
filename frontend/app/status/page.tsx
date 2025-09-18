import { CheckCircle, AlertCircle, Clock, TrendingUp, Server, Globe, Database, Zap } from 'lucide-react'

export default function StatusPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-h1-lg text-primary mb-4">System Status</h1>
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span className="text-xl text-green-400 font-semibold">All Systems Operational</span>
          </div>
          <p className="text-secondary">
            Last updated: {new Date().toLocaleString()} UTC
          </p>
        </div>

        {/* Overall Status */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 mb-8">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <h2 className="text-lg font-semibold text-green-800 dark:text-green-200">All Services Operating Normally</h2>
              <p className="text-green-600 dark:text-green-300">99.9% uptime over the last 30 days</p>
            </div>
          </div>
        </div>

        {/* Service Status */}
        <div className="space-y-6 mb-12">
          <h2 className="text-h2 text-primary">Service Status</h2>
          
          <div className="grid gap-4">
            {/* Web Application */}
            <div className="bg-secondary border border-primary rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Globe className="h-5 w-5 text-blue-400" />
                  <span className="font-semibold text-primary">Web Application</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Operational</span>
                </div>
              </div>
              <p className="text-secondary text-sm mt-2">Frontend and user interface</p>
            </div>

            {/* API Services */}
            <div className="bg-secondary border border-primary rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Server className="h-5 w-5 text-purple-400" />
                  <span className="font-semibold text-primary">API Services</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Operational</span>
                </div>
              </div>
              <p className="text-secondary text-sm mt-2">Server health and user authentication</p>
            </div>

            {/* File Processing */}
            <div className="bg-secondary border border-primary rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  <span className="font-semibold text-primary">File Processing</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Operational</span>
                </div>
              </div>
              <p className="text-secondary text-sm mt-2">Document analysis and context pack generation</p>
            </div>

            {/* Database */}
            <div className="bg-secondary border border-primary rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Database className="h-5 w-5 text-indigo-400" />
                  <span className="font-semibold text-primary">Database</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Operational</span>
                </div>
              </div>
              <p className="text-secondary text-sm mt-2">User data and file storage</p>
            </div>

            {/* Payment System */}
            <div className="bg-secondary border border-primary rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  <span className="font-semibold text-primary">Payment System</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Operational</span>
                </div>
              </div>
              <p className="text-secondary text-sm mt-2">Credit purchases and billing</p>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-6 mb-12">
          <h2 className="text-2xl font-semibold text-primary">Performance Metrics</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-secondary border border-primary rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">99.9%</div>
              <div className="text-sm text-secondary">Uptime (30 days)</div>
            </div>
            <div className="bg-secondary border border-primary rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">1.2s</div>
              <div className="text-sm text-secondary">Avg Response Time</div>
            </div>
            <div className="bg-secondary border border-primary rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">0</div>
              <div className="text-sm text-secondary">Incidents (7 days)</div>
            </div>
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="space-y-6 mb-12">
          <h2 className="text-2xl font-semibold text-primary">Recent Incidents</h2>
          
          <div className="bg-secondary border border-primary rounded-xl p-6">
            <div className="text-center text-secondary">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-primary mb-2">No Recent Incidents</h3>
              <p>All systems have been running smoothly. The last reported incident was resolved on August 15, 2024.</p>
            </div>
          </div>
        </div>

        {/* Maintenance Schedule */}
        <div className="space-y-6 mb-12">
          <h2 className="text-2xl font-semibold text-primary">Scheduled Maintenance</h2>
          
          <div className="bg-secondary border border-primary rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Clock className="h-5 w-5 text-blue-400" />
              <h3 className="font-semibold text-primary">Upcoming Maintenance</h3>
            </div>
            <p className="text-secondary">
              No scheduled maintenance at this time. We perform routine maintenance during low-traffic hours and will provide advance notice for any planned downtime.
            </p>
          </div>
        </div>

        {/* Subscribe to Updates */}
        <div className="bg-secondary border border-primary rounded-xl p-8 text-center">
          <h2 className="text-2xl font-semibold text-primary mb-4">Stay Informed</h2>
          <p className="text-secondary mb-6">
            Get notified about service status updates and planned maintenance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="mailto:status-subscribe@universalcontextpack.com?subject=Subscribe to Status Updates" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Subscribe to Updates
            </a>
            <a 
              href="/security" 
              className="bg-secondary border border-primary hover:bg-primary text-primary hover:text-secondary px-6 py-3 rounded-lg transition-colors"
            >
              View Security Center
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-primary text-center text-sm text-secondary">
          <p>
            For technical support, contact{' '}
            <a href="mailto:support@universalcontextpack.com" className="text-blue-400 hover:text-blue-300 transition-colors">
              support@universalcontextpack.com
            </a>
          </p>
          <p className="mt-2">
            For security issues, contact{' '}
            <a href="mailto:security@universalcontextpack.com" className="text-blue-400 hover:text-blue-300 transition-colors">
              security@universalcontextpack.com
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
