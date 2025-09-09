import { Lock, Shield, Eye, Server, FileKey, Users, AlertTriangle, Zap, CheckCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
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

        <div className="space-y-8">
          {/* Data Protection */}
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <Shield className="h-6 w-6 text-green-400" />
              <h2 className="text-h2 text-primary">Data Protection</h2>
            </div>
            <div className="grid-12">
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Encryption Standards</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>AES-256 encryption for data at rest</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>TLS 1.3 for data in transit</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>End-to-end encryption for sensitive data</span>
                  </li>
                </ul>
              </div>
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Data Handling</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>GDPR & CCPA compliant processing</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Automatic data retention policies</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Secure data disposal procedures</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Infrastructure Security */}
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <Server className="h-6 w-6 text-blue-400" />
              <h2 className="text-h2 text-primary">Infrastructure Security</h2>
            </div>
            <div className="grid-12">
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Cloud Security</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Multi-region deployment</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>DDoS protection & WAF</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Network isolation & VPC</span>
                  </li>
                </ul>
              </div>
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Application Security</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Regular security audits</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Penetration testing</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>OWASP compliance</span>
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
                <h3 className="font-semibold text-primary mb-3">Security Monitoring</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>24/7 security monitoring</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Automated threat detection</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Real-time alerting</span>
                  </li>
                </ul>
              </div>
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Compliance Standards</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>SOC 2 Type II certified</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>ISO 27001 aligned</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>GDPR & CCPA compliant</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Vulnerability Management */}
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <AlertTriangle className="h-6 w-6 text-yellow-400" />
              <h2 className="text-h2 text-primary">Vulnerability Management</h2>
            </div>
            <div className="grid-12">
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Proactive Security</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Automated dependency scanning</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Regular security assessments</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Zero-day response procedures</span>
                  </li>
                </ul>
              </div>
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">Incident Response</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>24-hour response SLA</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Documented incident procedures</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Post-incident analysis & improvement</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Business Continuity */}
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <Zap className="h-6 w-6 text-orange-400" />
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
                    <span>Cross-region data replication</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Point-in-time recovery</span>
                  </li>
                </ul>
              </div>
              <div className="col-span-12 md:col-span-6">
                <h3 className="font-semibold text-primary mb-3">High Availability</h3>
                <ul className="space-y-2 text-secondary">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>99.9% uptime SLA</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Load balancing & failover</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span>Real-time health monitoring</span>
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
                <div className="col-span-12 md:col-span-6">
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
          <section className="card-enterprise">
            <div className="flex items-center space-x-3 mb-6">
              <FileKey className="h-6 w-6 text-blue-400" />
              <h2 className="text-h2 text-primary">Legal & Compliance Documents</h2>
            </div>
            <div className="grid-12">
              <div className="col-span-12 md:col-span-6 space-y-4">
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
                  <span>Data Processing Agreement</span>
                </Link>
              </div>
              <div className="col-span-12 md:col-span-6 space-y-4">
                <div className="p-4 border border-primary/30 rounded-lg">
                  <h3 className="font-semibold text-primary mb-2">Security Certifications</h3>
                  <p className="text-sm text-secondary">
                    View our current security certifications and compliance reports
                  </p>
                </div>
                <div className="p-4 border border-primary/30 rounded-lg">
                  <h3 className="font-semibold text-primary mb-2">Contact Security Team</h3>
                  <p className="text-sm text-secondary">
                    security@universalchatprompt.com
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
