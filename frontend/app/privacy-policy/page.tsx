import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Universal Context Pack - Learn how we collect, use, and protect your data.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-primary py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-card border border-primary rounded-lg p-8">
          <h1 className="text-3xl font-semibold text-primary mb-2">Privacy Policy</h1>
          <p className="text-secondary mb-8">Last updated: September 1, 2025</p>

          <div className="max-w-none text-primary space-y-8">
            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">Data Security & Privacy</h2>
              <p className="text-secondary leading-relaxed mb-6">
                Your conversations are processed securely through encrypted infrastructure. We are committed to 
                protecting your data and maintaining your privacy throughout the entire processing workflow.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-secondary border border-primary rounded-lg p-6">
                  <h3 className="text-lg font-medium text-primary mb-3">Encrypted Storage</h3>
                  <p className="text-secondary text-sm">
                    Files are encrypted during processing and securely stored using industry-standard protocols.
                  </p>
                </div>
                
                <div className="bg-secondary border border-primary rounded-lg p-6">
                  <h3 className="text-lg font-medium text-primary mb-3">Secure Processing</h3>
                  <p className="text-secondary text-sm">
                    All data processing happens through encrypted channels with automatic cleanup protocols.
                  </p>
                </div>
                
                <div className="bg-secondary border border-primary rounded-lg p-6">
                  <h3 className="text-lg font-medium text-primary mb-3">Confidential Processing</h3>
                  <p className="text-secondary text-sm">
                    Your conversations remain confidential - we don't read, analyze, or use your data for any other purpose.
                  </p>
                </div>
              </div>
              
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-8">
                <p className="text-primary text-sm">
                  <strong>Security Standards:</strong> We use AES-256 encryption for data at rest and TLS 1.3 for data in transit. 
                  Your files are processed in isolated environments and automatically purged after Context Pack generation.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">1. Introduction</h2>
              <p className="text-secondary leading-relaxed">
                Universal Context Pack ("we," "our," or "us") respects your privacy and is committed to protecting your personal data. 
                This privacy policy explains how we collect, use, and safeguard your information when you use our AI conversation 
                analysis service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">2. Information We Collect</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-primary mb-2">2.1 Account Information</h3>
                  <ul className="list-disc list-inside text-secondary space-y-1">
                    <li>Email address (for account creation and authentication)</li>
                    <li>Username and profile information</li>
                    <li>Payment information (processed securely through Stripe)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-primary mb-2">2.2 Conversation Data</h3>
                  <ul className="list-disc list-inside text-secondary space-y-1">
                    <li>AI conversation files you upload for processing (processed automatically, not read by humans)</li>
                    <li>Processed conversation chunks and Context Pack results</li>
                    <li>Generated Universal Context Packs for your download</li>
                  </ul>
                  <p className="text-secondary text-sm mt-2 italic">
                    Note: Your conversation content is processed automatically by our systems and is never read, 
                    reviewed, or analyzed by human operators.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-primary mb-2">2.3 Usage Data</h3>
                  <ul className="list-disc list-inside text-secondary space-y-1">
                    <li>Service usage analytics and performance metrics</li>
                    <li>Error logs and debugging information</li>
                    <li>Feature usage patterns</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">3. How We Use Your Information</h2>
              <ul className="list-disc list-inside text-secondary space-y-2">
                <li>Provide automated conversation processing to generate Universal Context Packs</li>
                <li>Process your conversation data through secure, automated systems (no human review)</li>
                <li>Manage your account and process payments</li>
                <li>Send service-related communications</li>
                <li>Monitor system performance and reliability</li>
                <li>Ensure security and prevent fraud</li>
              </ul>
              <p className="text-secondary mt-4 text-sm">
                <strong>Important:</strong> We do not read, analyze, or use your conversation content for any purpose 
                other than generating your requested Context Packs. All processing is automated and confidential.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">4. Data Storage and Security</h2>
              <div className="space-y-4">
                <p className="text-secondary">
                  We implement industry-standard security measures to protect your data:
                </p>
                <ul className="list-disc list-inside text-secondary space-y-1">
                  <li>AES-256 encryption for data at rest</li>
                  <li>TLS 1.3 encryption for data in transit</li>
                  <li>Processing in isolated, secure environments</li>
                  <li>Automatic data purging after Context Pack generation</li>
                  <li>Access controls and authentication systems</li>
                  <li>Regular security monitoring</li>
                </ul>
                <p className="text-secondary">
                  Your conversation data is stored securely with encrypted protection and is only accessible by 
                  you and our automated processing systems. Files are automatically deleted after processing completion.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">5. Data Sharing and Third Parties</h2>
              <div className="space-y-4">
                <p className="text-secondary">
                  We do not sell, trade, or share your personal data with third parties except:
                </p>
                <ul className="list-disc list-inside text-secondary space-y-1">
                  <li><strong>Service Providers:</strong> OpenAI (for AI analysis), Stripe (for payments), Supabase (for authentication)</li>
                  <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                  <li><strong>Business Transfers:</strong> In case of merger, acquisition, or sale of assets</li>
                </ul>
                <p className="text-secondary">
                  All third-party service providers are bound by strict data protection agreements.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">6. Your Rights and Choices</h2>
              <div className="space-y-4">
                <p className="text-secondary">You have the right to:</p>
                <ul className="list-disc list-inside text-secondary space-y-1">
                  <li>Access your personal data</li>
                  <li>Correct inaccurate information</li>
                  <li>Delete your account and associated data</li>
                  <li>Export your data</li>
                  <li>Opt out of marketing communications</li>
                </ul>
                <p className="text-secondary">
                  To exercise these rights, please contact us at the information provided below.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">7. Data Retention</h2>
              <p className="text-secondary">
                We retain your data for as long as necessary to provide our services and comply with legal obligations. 
                Conversation data and analysis results are retained until you delete them or close your account. 
                Account information may be retained for a reasonable period after account closure for legal and business purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">8. International Data Transfers</h2>
              <p className="text-secondary">
                Your data may be transferred to and processed in countries other than your country of residence. 
                We ensure appropriate safeguards are in place to protect your data in accordance with applicable data protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">9. Changes to This Policy</h2>
              <p className="text-secondary">
                We may update this privacy policy from time to time. We will notify you of any material changes by 
                posting the new policy on this page and updating the "Last updated" date. Your continued use of our 
                service after such changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-primary mb-4">10. Contact Us</h2>
              <p className="text-secondary">
                If you have any questions about this privacy policy or our data practices, please contact us at:
              </p>
              <div className="bg-secondary border border-primary rounded-lg p-4 mt-4">
                <p className="text-primary">
                  <strong>Universal Context Pack</strong><br />
                  Email: privacy@universalcontextpack.com<br />
                  For data protection inquiries: dpo@universalcontextpack.com
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
