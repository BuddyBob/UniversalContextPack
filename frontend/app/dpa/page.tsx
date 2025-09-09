import { FileText, Download, Shield, Users, Lock } from 'lucide-react'
import Link from 'next/link'

export default function DPAPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-h1-lg text-primary mb-4">Data Processing Agreement</h1>
          <p className="text-body-lg text-secondary max-w-2xl mx-auto">
            GDPR-compliant data processing terms for enterprise customers and privacy-conscious users
          </p>
        </div>

        {/* Quick Summary */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3">Plain-English Summary</h2>
          <p className="text-blue-700 dark:text-blue-300 mb-4">
            This Data Processing Agreement (DPA) explains how we handle your personal data when providing our Universal Context Pack services. Here's what it means:
          </p>
          <ul className="space-y-2 text-blue-700 dark:text-blue-300">
            <li>• We only process your data to provide the services you requested</li>
            <li>• We don't sell, share, or use your data for any other purposes</li>
            <li>• You control your data and can delete it anytime</li>
            <li>• We use industry-standard security measures to protect your data</li>
            <li>• This agreement meets GDPR and other privacy law requirements</li>
          </ul>
        </div>

        {/* DPA Content */}
        <div className="space-y-8">
          {/* Article 1: Definitions */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <h2 className="text-h2 text-primary mb-6">1. Definitions</h2>
            <div className="space-y-4 text-secondary">
              <p><strong>"Controller"</strong> means the entity that determines the purposes and means of processing personal data (typically, you as our customer).</p>
              <p><strong>"Processor"</strong> means Universal Context Pack, LLC, which processes personal data on behalf of the Controller.</p>
              <p><strong>"Personal Data"</strong> means any information relating to an identified or identifiable natural person contained in files you upload to our service.</p>
              <p><strong>"Processing"</strong> means any operation performed on personal data, including analysis, transformation, and context pack generation.</p>
              <p><strong>"Data Subject"</strong> means the natural person to whom personal data relates.</p>
            </div>
          </section>

          {/* Article 2: Scope and Application */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <h2 className="text-h2 text-primary mb-6">2. Scope and Application</h2>
            <div className="space-y-4 text-secondary">
              <p>This DPA applies to the processing of personal data by Universal Context Pack on behalf of the Controller in connection with the Universal Context Pack services.</p>
              <p>This DPA forms part of and supplements our Terms of Service. In case of conflict between this DPA and the Terms of Service regarding data protection matters, this DPA shall prevail.</p>
            </div>
          </section>

          {/* Article 3: Purpose and Duration */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <h2 className="text-h2 text-primary mb-6">3. Purpose and Duration of Processing</h2>
            <div className="space-y-4 text-secondary">
              <p><strong>Purpose:</strong> We process personal data solely to provide the Universal Context Pack services, including:</p>
              <ul className="ml-6 space-y-2">
                <li>• Analyzing and transforming conversation files</li>
                <li>• Generating context packs from uploaded content</li>
                <li>• Providing file download and export capabilities</li>
                <li>• User authentication and account management</li>
              </ul>
              <p><strong>Duration:</strong> Processing continues for the duration of the service relationship. Personal data is deleted within 24-48 hours of user-initiated deletion or account termination.</p>
            </div>
          </section>

          {/* Article 4: Controller Instructions */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <h2 className="text-h2 text-primary mb-6">4. Processing Instructions</h2>
            <div className="space-y-4 text-secondary">
              <p>Universal Context Pack will process personal data only on documented instructions from the Controller, including:</p>
              <ul className="ml-6 space-y-2">
                <li>• File upload and processing requests</li>
                <li>• Context pack generation instructions</li>
                <li>• Data deletion requests</li>
                <li>• Account management actions</li>
              </ul>
              <p>If we believe an instruction infringes applicable data protection laws, we will immediately inform the Controller.</p>
            </div>
          </section>

          {/* Article 5: Security Measures */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <div className="flex items-center space-x-3 mb-6">
              <Lock className="h-6 w-6 text-green-400" />
              <h2 className="text-h2 text-primary">5. Security Measures</h2>
            </div>
            <div className="space-y-4 text-secondary">
              <p>We implement appropriate technical and organizational measures to ensure data security:</p>
              <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div>
                  <h3 className="font-semibold text-primary mb-2">Technical Measures:</h3>
                  <ul className="space-y-1">
                    <li>• AES-256 encryption at rest</li>
                    <li>• TLS 1.3 encryption in transit</li>
                    <li>• Secure key management (Cloud KMS)</li>
                    <li>• Regular security updates</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-primary mb-2">Organizational Measures:</h3>
                  <ul className="space-y-1">
                    <li>• Role-based access controls</li>
                    <li>• Security awareness training</li>
                    <li>• Incident response procedures</li>
                    <li>• Regular security assessments</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Article 6: Sub-processors */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <div className="flex items-center space-x-3 mb-6">
              <Users className="h-6 w-6 text-blue-400" />
              <h2 className="text-h2 text-primary">6. Sub-processors</h2>
            </div>
            <div className="space-y-4 text-secondary">
              <p>The Controller provides general authorization for the engagement of sub-processors. Current authorized sub-processors include:</p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700 mt-4">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Company</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">Google Cloud Platform</td>
                      <td className="px-6 py-4 whitespace-nowrap">Infrastructure & Hosting</td>
                      <td className="px-6 py-4 whitespace-nowrap">Global (Data in US)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">Supabase</td>
                      <td className="px-6 py-4 whitespace-nowrap">Database Services</td>
                      <td className="px-6 py-4 whitespace-nowrap">US</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">Stripe</td>
                      <td className="px-6 py-4 whitespace-nowrap">Payment Processing</td>
                      <td className="px-6 py-4 whitespace-nowrap">US</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">OpenAI</td>
                      <td className="px-6 py-4 whitespace-nowrap">AI Processing</td>
                      <td className="px-6 py-4 whitespace-nowrap">US</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>We will provide 30 days' notice before adding new sub-processors.</p>
            </div>
          </section>

          {/* Article 7: Data Subject Rights */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <h2 className="text-h2 text-primary mb-6">7. Data Subject Rights</h2>
            <div className="space-y-4 text-secondary">
              <p>We assist the Controller in fulfilling data subject rights requests:</p>
              <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div>
                  <ul className="space-y-2">
                    <li>• <strong>Access:</strong> View processed data</li>
                    <li>• <strong>Rectification:</strong> Correct inaccurate data</li>
                    <li>• <strong>Erasure:</strong> Delete personal data</li>
                    <li>• <strong>Portability:</strong> Export data in structured format</li>
                  </ul>
                </div>
                <div>
                  <ul className="space-y-2">
                    <li>• <strong>Restriction:</strong> Limit processing activities</li>
                    <li>• <strong>Objection:</strong> Object to certain processing</li>
                    <li>• <strong>Automated decisions:</strong> Human review available</li>
                  </ul>
                </div>
              </div>
              <p className="mt-4">Data subject requests should be directed to: <a href="mailto:privacy@universalcontextpack.com" className="text-blue-400 hover:text-blue-300">privacy@universalcontextpack.com</a></p>
            </div>
          </section>

          {/* Article 8: Data Breach Notification */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <h2 className="text-h2 text-primary mb-6">8. Data Breach Notification</h2>
            <div className="space-y-4 text-secondary">
              <p>In case of a personal data breach, we will:</p>
              <ul className="ml-6 space-y-2">
                <li>• Notify the Controller without undue delay (within 72 hours when possible)</li>
                <li>• Provide all relevant information about the breach</li>
                <li>• Assist with breach notification to supervisory authorities and data subjects</li>
                <li>• Implement immediate containment and remediation measures</li>
              </ul>
              <p>Security incidents should be reported to: <a href="mailto:security@universalcontextpack.com" className="text-blue-400 hover:text-blue-300">security@universalcontextpack.com</a></p>
            </div>
          </section>

          {/* Article 9: Audits and Compliance */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <h2 className="text-h2 text-primary mb-6">9. Audits and Compliance</h2>
            <div className="space-y-4 text-secondary">
              <p>We make available to the Controller:</p>
              <ul className="ml-6 space-y-2">
                <li>• Information necessary to demonstrate compliance with this DPA</li>
                <li>• Security certifications and audit reports</li>
                <li>• Reasonable assistance with Controller audits</li>
                <li>• Regular compliance assessments</li>
              </ul>
              <p>Audit requests should be submitted to: <a href="mailto:compliance@universalcontextpack.com" className="text-blue-400 hover:text-blue-300">compliance@universalcontextpack.com</a></p>
            </div>
          </section>

          {/* Article 10: International Transfers */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <h2 className="text-h2 text-primary mb-6">10. International Data Transfers</h2>
            <div className="space-y-4 text-secondary">
              <p>Personal data is primarily processed within the United States. Where transfers occur to countries without adequacy decisions, we ensure protection through:</p>
              <ul className="ml-6 space-y-2">
                <li>• Standard Contractual Clauses (SCCs) approved by the European Commission</li>
                <li>• Additional safeguards where required</li>
                <li>• Regular adequacy assessments of transfer destinations</li>
              </ul>
            </div>
          </section>

          {/* Article 11: Term and Termination */}
          <section className="bg-secondary border border-primary rounded-xl p-8">
            <h2 className="text-h2 text-primary mb-6">11. Term and Termination</h2>
            <div className="space-y-4 text-secondary">
              <p>This DPA remains in effect for the duration of the service relationship. Upon termination:</p>
              <ul className="ml-6 space-y-2">
                <li>• All personal data will be deleted within 24-48 hours</li>
                <li>• Data may be retained longer only if required by law</li>
                <li>• Controller may request return of data before deletion</li>
                <li>• Deletion will be certified upon request</li>
              </ul>
            </div>
          </section>
        </div>

        {/* Actions */}
        <div className="mt-12 bg-secondary border border-primary rounded-xl p-8 text-center">
          <h2 className="text-h2 text-primary mb-4">Questions or Concerns?</h2>
          <p className="text-secondary mb-6">
            Need clarification on our data processing practices or have questions about this DPA?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="mailto:privacy@universalcontextpack.com" 
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Contact Privacy Team
            </a>
            <Link 
              href="/security" 
              className="bg-secondary border border-primary hover:bg-primary text-primary hover:text-secondary px-6 py-3 rounded-lg transition-colors"
            >
              View Security Center
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-secondary">
          <p>Last updated: September 8, 2025</p>
          <p className="mt-2">
            <Link href="/privacy-policy" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</Link>
            {' • '}
            <Link href="/terms-of-service" className="text-blue-400 hover:text-blue-300 transition-colors">Terms of Service</Link>
            {' • '}
            <Link href="/security" className="text-blue-400 hover:text-blue-300 transition-colors">Security Center</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
