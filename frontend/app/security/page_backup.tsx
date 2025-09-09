import { Lock, Shield, Eye, Server, FileKey, Users, AlertTriangle, Zap, CheckCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 p                <div className="col-span-12 md:col-span-6">
                  <h3 className="font-semibold text-primary mb-3">Infrastructure Partners</h3>
                  <ul className="space-y-2 text-secondary">
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>Google Cloud Platform (hosting)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>Supabase (database)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>Vercel (frontend hosting)</span>
                    </li>
                  </ul>
                </div>
                <div className="col-span-12 md:col-span-6"> Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-h1-lg text-primary mb-4">Security Center</h1>
          <p className="text-body-lg text-secondary max-w-2xl mx-auto">
            Enterprise-grade security measures protecting your data with transparency and trust
          </p>
        </div>

        {/* Security Overview Cards */}
        <div className="grid-12 mb-12">
          <div className="col-span-12 md:col-span-4 card-enterprise text-center">
            <Lock className="h-8 w-8 text-green-400 mx-auto mb-3" />
            <h3 className="font-semibold text-primary mb-2">256-bit Encryption</h3>
            <p className="text-sm text-secondary">Data encrypted in transit and at rest</p>
          </div>
          <div className="col-span-12 md:col-span-4 card-enterprise text-center">
            <Server className="h-8 w-8 text-blue-400 mx-auto mb-3" />
            <h3 className="font-semibold text-primary mb-2">Enterprise Infrastructure</h3>
            <p className="text-sm text-secondary">SOC 2 compliant cloud services</p>
          </div>
          <div className="col-span-12 md:col-span-4 card-enterprise text-center">
            <Eye className="h-8 w-8 text-purple-400 mx-auto mb-3" />
            <h3 className="font-semibold text-primary mb-2">Audit Logs</h3>
            <p className="text-sm text-secondary">Complete access & activity tracking</p>
          </div>
        </div>

        {/* Detailed Security Measures */}
        <div className="space-y-8">
          {/* Data Protection */}
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <FileKey className="h-6 w-6 text-blue-400" />
              <h2 className="text-h2 text-primary">Data Protection</h2>
            </div>
            <div className="grid-12">
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Encryption Standards</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>TLS 1.3 for data in transit</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>AES-256 encryption at rest</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Cloud KMS key management</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Automatic key rotation (quarterly)</span>
                  </li>
                </ul>
              </div>
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Data Retention</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>User-controlled deletion</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>24-48h hard delete SLA</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Automatic purge of processed files</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Zero retention by default</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Infrastructure Security */}
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <Server className="h-6 w-6 text-green-400" />
              <h2 className="text-h2 text-primary">Infrastructure Security</h2>
            </div>
            <div className="grid-12">
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Network Security</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>HSTS enabled</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Strict Content Security Policy</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Subresource Integrity on scripts</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>IP allowlist for admin access</span>
                  </li>
                </ul>
              </div>
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Access Control</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Role-based access control</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Least-privilege service accounts</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Multi-factor authentication</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Session management</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Monitoring & Compliance */}
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <Eye className="h-6 w-6 text-purple-400" />
              <h2 className="text-h2 text-primary">Monitoring & Compliance</h2>
            </div>
            <div className="grid-12">
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Audit & Monitoring</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Comprehensive audit logs</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Real-time security monitoring</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Upload & access tracking</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Anomaly detection</span>
                  </li>
                </ul>
              </div>
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Compliance Roadmap</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>SOC 2 Type I (Q1 2025)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                    <span>SOC 2 Type II (Q3 2025)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>GDPR compliance ready</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>CCPA compliance ready</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Vulnerability Management */}
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <AlertTriangle className="h-6 w-6 text-orange-400" />
              <h2 className="text-h2 text-primary">Vulnerability Management</h2>
            </div>
            <div className="grid-12">
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Security Testing</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Weekly automated vulnerability scans</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Quarterly penetration testing</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Dependency scanning</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Code security analysis</span>
                  </li>
                </ul>
              </div>
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Incident Response</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>24/7 security monitoring</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Incident response playbook</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Automated alerting system</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Emergency contact: security@universalcontextpack.com</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Business Continuity */}
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <Zap className="h-6 w-6 text-yellow-400" />
              <h2 className="text-h2 text-primary">Business Continuity</h2>
            </div>
            <div className="grid-12">
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Backup & Recovery</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Automated daily backups</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Multi-region redundancy</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>RPO: 1 hour</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>RTO: 4 hours</span>
                  </li>
                </ul>
              </div>
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Service Availability</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>99.9% uptime SLA</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Load balancing & auto-scaling</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Health monitoring</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>
                      <Link href="/status" className="text-blue-400 hover:text-blue-300 transition-colors">
                        Status page available
                      </Link>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Sub-processors */}
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <Users className="h-6 w-6 text-indigo-400" />
              <h2 className="text-h2 text-primary">Sub-processors & Partners</h2>
            </div>
            <div className="space-y-4">
              <p className="text-secondary">
                We work with trusted sub-processors who meet our security standards and have Data Processing Agreements (DPAs) in place:
              </p>
              <div className="grid-12">
                <div className="col-span-12 md:col-span-6">
                  <h3 className="font-semibold text-primary mb-3">Infrastructure Partners</h3>
                  <ul className="space-y-2 text-secondary">
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>Google Cloud Platform (hosting)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>Supabase (database)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>Vercel (frontend hosting)</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-primary mb-3">Service Partners</h3>
                  <ul className="space-y-2 text-secondary">
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>Stripe (payment processing)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>Sentry (error monitoring)</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <span>OpenAI (AI processing)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Legal & Compliance Documents */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <div className="flex items-center space-x-3 mb-6">
              <FileKey className="h-6 w-6 text-blue-400" />
              <h2 className="text-2xl font-semibold text-primary">Legal & Compliance Documents</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Link href="/privacy-policy" className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors">
                  <ExternalLink className="h-4 w-4" />
                  <span>Privacy Policy</span>
                </Link>
                <Link href="/terms-of-service" className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors">
                  <ExternalLink className="h-4 w-4" />
                  <span>Terms of Service</span>
                </Link>
                <Link href="/dpa" className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors">
                  <ExternalLink className="h-4 w-4" />
                  <span>Data Processing Agreement (DPA)</span>
                </Link>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-secondary">
                  <strong>Plain-English Summaries:</strong> All our legal documents include clear, accessible summaries at the top to explain what they mean in simple terms.
                </p>
                <p className="text-sm text-secondary">
                  <strong>DPIA Template:</strong> Available for enterprise customers requiring Data Protection Impact Assessments.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Contact */}
        <div className="mt-12 text-center bg-secondary border border-primary rounded-xl p-8">
          <h2 className="text-2xl font-semibold text-primary mb-4">Security Questions?</h2>
          <p className="text-secondary mb-6">
            Have questions about our security practices or need additional documentation for your security review?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="mailto:security@universalcontextpack.com" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Contact Security Team
            </a>
            <Link 
              href="/status" 
              className="bg-secondary border border-primary hover:bg-primary text-primary hover:text-secondary px-6 py-3 rounded-lg transition-colors"
            >
              Check System Status
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
