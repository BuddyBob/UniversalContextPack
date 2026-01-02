'use client'

import Link from 'next/link'

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-6 py-16">
                {/* Header */}
                <Link
                    href="/"
                    className="text-sm text-gray-600 hover:text-black mb-8 inline-block"
                >
                    ← Back
                </Link>

                <h1 className="text-4xl font-bold text-black mb-2">Privacy Policy</h1>
                <p className="text-gray-500 mb-12">Last Updated: January 1, 2026</p>

                {/* Content */}
                <div className="space-y-10 text-gray-800 leading-relaxed">
                    <p>
                        This Privacy Policy describes how <strong>Context Labs LLC</strong> ("we," "us") collects, uses, and protects information in connection with <strong>Context Pack</strong>.
                    </p>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">1. Information We Collect</h2>

                        <h3 className="text-lg font-medium text-black mt-6 mb-2">Information You Provide</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Account information (email address)</li>
                            <li>Content you upload or create using the Service</li>
                        </ul>

                        <h3 className="text-lg font-medium text-black mt-6 mb-2">Automatically Collected Information</h3>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>IP address</li>
                            <li>Device and browser information</li>
                            <li>Usage and performance data</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">2. How We Use Information</h2>
                        <p className="mb-2">We use information to:</p>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Provide and operate the Service</li>
                            <li>Maintain security and prevent abuse</li>
                            <li>Improve performance and features</li>
                            <li>Process payments</li>
                            <li>Communicate service-related notices</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">3. Cookies & Analytics</h2>
                        <p className="mb-2">The Service uses cookies and similar technologies:</p>
                        <ul className="list-disc pl-6 space-y-1">
                            <li><strong>Essential cookies</strong> – required for authentication and core functionality</li>
                            <li><strong>Analytics cookies</strong> – via Google Analytics to understand service usage</li>
                        </ul>
                        <p className="mt-3 text-sm">
                            You may control cookies through browser settings or opt out of Google Analytics using Google-provided tools.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">4. Data Retention & Deletion</h2>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Account information is retained while your account is active</li>
                            <li>User Content is retained only as long as necessary to provide the Service</li>
                            <li>Users may delete content at any time using in-product controls</li>
                            <li>Deleted content is removed from active systems within a reasonable period and may persist in backups for a limited time</li>
                            <li>Logs and security data are retained for a limited period</li>
                            <li>Payment records are retained as required by law</li>
                        </ul>
                        <p className="mt-4">
                            To request full account deletion, contact <a href="mailto:privacy@context-pack.com" className="text-blue-600 hover:underline">privacy@context-pack.com</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">5. Data Sharing & Subprocessors</h2>
                        <p className="mb-2">We share data with trusted service providers only to operate the Service:</p>
                        <ul className="list-disc pl-6 space-y-1">
                            <li><strong>Cloudflare</strong> – content delivery, security</li>
                            <li><strong>Vercel</strong> – hosting and infrastructure</li>
                            <li><strong>Supabase</strong> – database, authentication, storage</li>
                            <li><strong>Google Analytics</strong> – usage analytics</li>
                            <li><strong>Stripe</strong> – payment processing</li>
                        </ul>
                        <p className="mt-3 text-sm">These providers are contractually obligated to protect your data.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">6. AI Data Usage</h2>
                        <p className="mb-2">
                            <strong className="text-blue-600">We do not use User Content to train AI models.</strong> User Content is processed solely to provide the Service.
                        </p>
                        <p className="text-sm">We may use anonymized, aggregated usage metrics to improve the Service.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">7. Your Privacy Rights</h2>

                        <h3 className="text-lg font-medium text-black mt-6 mb-2">All Users</h3>
                        <p>
                            You may request access, correction, or deletion of your personal data by contacting <a href="mailto:privacy@context-pack.com" className="text-blue-600 hover:underline">privacy@context-pack.com</a>.
                        </p>

                        <h3 className="text-lg font-medium text-black mt-6 mb-2">European Union / United Kingdom (GDPR)</h3>
                        <p>
                            Users in the EEA, UK, or Switzerland have rights including access, rectification, erasure, restriction, portability, and objection. Data transfers outside the EU are protected using Standard Contractual Clauses.
                        </p>

                        <h3 className="text-lg font-medium text-black mt-6 mb-2">California Residents (CCPA / CPRA)</h3>
                        <p className="mb-1">
                            California residents have the right to know, delete, and correct personal information and the right to non-discrimination.
                        </p>
                        <p className="text-sm"><strong>We do not sell personal information.</strong></p>

                        <p className="mt-4 text-sm">We will respond to verified requests within <strong>30 days</strong>.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">8. Security</h2>
                        <p className="mb-2">
                            We implement reasonable administrative and technical safeguards, including encryption in transit and access controls. No system is completely secure.
                        </p>
                        <p>
                            Security issues may be reported to <a href="mailto:security@context-pack.com" className="text-blue-600 hover:underline">security@context-pack.com</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">9. International Users</h2>
                        <p>
                            Data is processed in the United States. By using the Service, you consent to the transfer and processing of data in the United States.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">10. Children's Privacy</h2>
                        <p>
                            The Service is not directed to individuals under 18. We do not knowingly collect data from children.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">11. Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy from time to time. Continued use of the Service constitutes acceptance of the revised policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">12. Contact</h2>
                        <p><strong>Context Labs LLC</strong></p>
                        <p className="mt-2">
                            Privacy: <a href="mailto:privacy@context-pack.com" className="text-blue-600 hover:underline">privacy@context-pack.com</a>
                        </p>
                        <p>
                            Security: <a href="mailto:security@context-pack.com" className="text-blue-600 hover:underline">security@context-pack.com</a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}
