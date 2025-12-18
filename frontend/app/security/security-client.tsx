import Link from 'next/link'

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#080a09] text-white">
      <div className="max-w-5xl mx-auto px-6 py-32">
        {/* Header */}
        <div className="mb-20">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-4 font-mono">Security</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Security Whitepaper
          </h1>
          <p className="text-lg text-gray-500">
            Enterprise-grade protection for your AI conversation data
          </p>
        </div>

        {/* Security Specifications - Table Format */}
        <div className="space-y-32">

          {/* Data Protection */}
          <section>
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-2">Data Protection</h2>
              <p className="text-sm text-gray-500">Encryption and data handling procedures</p>
            </div>

            <div className="space-y-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Encryption at Rest</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400"><span className="text-purple-400">AES-256</span> encryption for all stored data</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Encryption in Transit</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400"><span className="text-purple-400">TLS 1.3</span> for all data transmission</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Data Privacy</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Your data is <span className="text-purple-400">never used</span> to train AI models</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Data Retention</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Automated policies, user-controlled deletion</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Data Sovereignty</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">You own your data. Export or delete anytime</p>
                </div>
              </div>
            </div>
          </section>

          {/* Infrastructure Security */}
          <section>
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-2">Infrastructure Security</h2>
              <p className="text-sm text-gray-500">Cloud and application security measures</p>
            </div>

            <div className="space-y-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Hosting</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Multi-region deployment on enterprise cloud infrastructure</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">DDoS Protection</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Web Application Firewall (WAF) and DDoS mitigation</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Network Isolation</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Virtual Private Cloud (VPC) with network segmentation</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Security Audits</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Regular security assessments and penetration testing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">OWASP Compliance</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Following OWASP Top 10 security best practices</p>
                </div>
              </div>
            </div>
          </section>

          {/* Compliance & Monitoring */}
          <section>
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-2">Compliance & Monitoring</h2>
              <p className="text-sm text-gray-500">Standards certification and security monitoring</p>
            </div>

            <div className="space-y-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">SOC 2 Type II</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Independently audited security controls</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">ISO 27001</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Information security management system aligned</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">GDPR & CCPA</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Compliant data processing and privacy controls</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">24/7 Monitoring</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Automated threat detection and real-time alerting</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Incident Response</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">24-hour response SLA with documented procedures</p>
                </div>
              </div>
            </div>
          </section>

          {/* Business Continuity */}
          <section>
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-2">Business Continuity</h2>
              <p className="text-sm text-gray-500">Backup, recovery, and high availability</p>
            </div>

            <div className="space-y-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Automated Backups</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Daily backups with cross-region replication</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Point-in-Time Recovery</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Restore data to any point within retention period</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Uptime SLA</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">99.9% uptime guarantee with load balancing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Health Monitoring</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Real-time system health checks and failover</p>
                </div>
              </div>
            </div>
          </section>

          {/* Sub-processors */}
          <section>
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-2">Sub-processors & Partners</h2>
              <p className="text-sm text-gray-500">Trusted third-party service providers with DPAs</p>
            </div>

            <div className="space-y-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Cloud Infrastructure</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Google Cloud Platform, Vercel</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Database</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Supabase (PostgreSQL)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Payment Processing</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Stripe (PCI DSS compliant)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">AI Processing</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">OpenAI API (SOC 2 certified)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Error Monitoring</h3>
                </div>
                <div className="md:col-span-8">
                  <p className="text-sm text-gray-400">Sentry</p>
                </div>
              </div>
            </div>
          </section>

          {/* Legal Documents */}
          <section>
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-2">Legal & Compliance Documents</h2>
              <p className="text-sm text-gray-500">Policies and agreements</p>
            </div>

            <div className="space-y-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Privacy Policy</h3>
                </div>
                <div className="md:col-span-8">
                  <Link href="/privacy-policy" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                    View Privacy Policy →
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Terms of Service</h3>
                </div>
                <div className="md:col-span-8">
                  <Link href="/terms-of-service" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                    View Terms of Service →
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-white/10">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Data Processing Agreement</h3>
                </div>
                <div className="md:col-span-8">
                  <Link href="/dpa" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                    View DPA →
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6">
                <div className="md:col-span-4">
                  <h3 className="text-sm font-semibold text-white">Security Contact</h3>
                </div>
                <div className="md:col-span-8">
                  <a href="mailto:security@universalchatprompt.com" className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-mono">
                    security@universalchatprompt.com
                  </a>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  )
}
