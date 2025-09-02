import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Universal Context Pack - Legal terms and conditions for using our AI conversation analysis service.',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-bg-primary py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-bg-card border border-border-primary rounded-lg p-8">
          <h1 className="text-3xl font-semibold text-text-primary mb-2">Terms of Service</h1>
          <p className="text-text-secondary mb-8">Last updated: September 1, 2025</p>

          <div className="prose prose-lg max-w-none text-text-primary space-y-8">
            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">1. Acceptance of Terms</h2>
              <p className="text-text-secondary leading-relaxed">
                By accessing or using Universal Context Pack (the "Service"), you agree to be bound by these Terms of Service 
                ("Terms"). If you disagree with any part of these terms, you may not access the Service. These Terms apply to 
                all visitors, users, and others who access or use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">2. Description of Service</h2>
              <p className="text-text-secondary leading-relaxed">
                Universal Context Pack is an AI-powered service that analyzes conversation data from various AI assistants 
                (ChatGPT, Claude, etc.) to create portable context packs. The Service processes uploaded conversation files 
                to extract insights, patterns, and contextual information that can be used across different AI platforms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">3. User Accounts</h2>
              <div className="space-y-4">
                <p className="text-text-secondary">
                  To use certain features of the Service, you must create an account. You agree to:
                </p>
                <ul className="list-disc list-inside text-text-secondary space-y-1">
                  <li>Provide accurate, current, and complete information during registration</li>
                  <li>Maintain and update your account information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Accept responsibility for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized use of your account</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">4. Acceptable Use</h2>
              <div className="space-y-4">
                <p className="text-text-secondary">You agree not to use the Service to:</p>
                <ul className="list-disc list-inside text-text-secondary space-y-1">
                  <li>Upload illegal, harmful, or malicious content</li>
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe on intellectual property rights</li>
                  <li>Upload conversations containing personal information of others without consent</li>
                  <li>Attempt to reverse engineer or compromise the Service</li>
                  <li>Use the Service for unauthorized commercial purposes</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">5. Content and Data</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">5.1 Your Content</h3>
                  <p className="text-text-secondary">
                    You retain ownership of the conversation data you upload. By using the Service, you grant us a limited, 
                    non-exclusive license to process your content solely for the purpose of providing the Service.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">5.2 Generated Content</h3>
                  <p className="text-text-secondary">
                    Universal Context Packs and analysis results generated from your data belong to you. We do not claim 
                    ownership of the insights or patterns derived from your conversations.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">5.3 Content Responsibility</h3>
                  <p className="text-text-secondary">
                    You are responsible for ensuring you have the right to upload and process any conversation data. 
                    You must not upload conversations containing sensitive personal information of others without proper consent.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">6. Payment and Billing</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">6.1 Credit System</h3>
                  <p className="text-text-secondary">
                    The Service operates on a credit-based system. Each conversation chunk analyzed consumes one credit. 
                    Credits must be purchased before use and are non-refundable except as required by law.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">6.2 Payment Processing</h3>
                  <p className="text-text-secondary">
                    Payments are processed securely through Stripe. By making a purchase, you agree to Stripe's terms of service. 
                    All fees are non-refundable unless otherwise specified.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">6.3 Price Changes</h3>
                  <p className="text-text-secondary">
                    We reserve the right to modify our pricing at any time. Price changes will not affect credits already purchased.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">7. Service Availability</h2>
              <p className="text-text-secondary">
                While we strive for high availability, we do not guarantee that the Service will be available 100% of the time. 
                We may temporarily suspend the Service for maintenance, updates, or other operational reasons. We are not liable 
                for any downtime or service interruptions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">8. Intellectual Property</h2>
              <p className="text-text-secondary">
                The Service, including its design, functionality, and underlying technology, is owned by Universal Context Pack 
                and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works 
                without our express written permission.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">9. Privacy</h2>
              <p className="text-text-secondary">
                Your privacy is important to us. Please review our Privacy Policy, which explains how we collect, use, and 
                protect your information. By using the Service, you agree to the collection and use of information as described 
                in our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">10. Disclaimers and Limitations</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">10.1 Service Disclaimer</h3>
                  <p className="text-text-secondary">
                    The Service is provided "as is" without warranties of any kind. We do not guarantee the accuracy, 
                    completeness, or usefulness of any analysis results.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-text-primary mb-2">10.2 Limitation of Liability</h3>
                  <p className="text-text-secondary">
                    To the maximum extent permitted by law, Universal Context Pack shall not be liable for any indirect, 
                    incidental, special, or consequential damages arising from your use of the Service.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">11. Termination</h2>
              <p className="text-text-secondary">
                We may terminate or suspend your account at any time for violations of these Terms. Upon termination, 
                your right to use the Service ceases immediately. You may delete your account at any time through your 
                account settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">12. Changes to Terms</h2>
              <p className="text-text-secondary">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by posting 
                the updated Terms on this page and updating the "Last updated" date. Your continued use of the Service 
                after such changes constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">13. Governing Law</h2>
              <p className="text-text-secondary">
                These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], 
                without regard to its conflict of law provisions. Any disputes arising under these Terms shall be subject 
                to the exclusive jurisdiction of the courts in [Your Jurisdiction].
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium text-text-primary mb-4">14. Contact Information</h2>
              <p className="text-text-secondary">
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 mt-4">
                <p className="text-text-primary">
                  <strong>Universal Context Pack</strong><br />
                  Email: legal@universalcontextpack.com<br />
                  For general inquiries: support@universalcontextpack.com
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
