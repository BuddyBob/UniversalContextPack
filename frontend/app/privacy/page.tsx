'use client'

import Link from 'next/link'

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {/* Header */}
                <div className="mb-12">
                    <Link
                        href="/"
                        className="text-sm text-secondary hover:text-primary transition-colors mb-4 inline-block"
                    >
                        ← Back to Home
                    </Link>
                    <h1 className="text-4xl font-bold text-primary mb-4">Privacy Policy</h1>
                    <p className="text-secondary">Last Updated: January 1, 2026</p>
                </div>

                {/* Content */}
                <div className="prose prose-lg max-w-none">
                    <p className="text-lg text-secondary mb-8">
                        This Privacy Policy describes how <strong>Context Labs LLC</strong> ("we," "us") collects, uses, and protects information in connection with <strong>Context Pack</strong>.
                    </p>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">1. Information We Collect</h2>

                        <h3 className="text-xl font-medium text-primary mb-3 mt-6">Information You Provide</h3>
                        <ul className="list-disc pl-6 space-y-2 text-secondary">
                            <li>Account information (email address)</li>
                            <li>Content you upload or create using the Service</li>
                        </ul>

                        <h3 className="text-xl font-medium text-primary mb-3 mt-6">Automatically Collected Information</h3>
                        <ul className="list-disc pl-6 space-y-2 text-secondary">
                            <li>IP address</li>
                            <li>Device and browser information</li>
                            <li>Usage and performance data</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">2. How We Use Information</h2>
                        <p className="text-secondary mb-3">We use information to:</p>
                        <ul className="list-disc pl-6 space-y-2 text-secondary">
                            <li>Provide and operate the Service</li>
                            <li>Maintain security and prevent abuse</li>
                            <li>Improve performance and features</li>
                            <li>Process payments</li>
                            <li>Communicate service-related notices</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">3. Cookies & Analytics</h2>
                        <p className="text-secondary mb-3">The Service uses cookies and similar technologies:</p>
                        <ul className="list-disc pl-6 space-y-2 text-secondary">
                            <li><strong>Essential cookies</strong> – required for authentication and core functionality</li>
                            <li><strong>Analytics cookies</strong> – via Google Analytics to understand service usage</li>
                        </ul>
                        <p className="text-secondary mt-4">
                            You may control cookies through browser settings or opt out of Google Analytics using Google-provided tools.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">4. Data Retention & Deletion</h2>
                        <ul className="list-disc pl-6 space-y-2 text-secondary">
                            <li>Account information is retained while your account is active</li>
                            <li>User Content is retained only as long as necessary to provide the Service</li>
                            <li>Users may delete content at any time using in-product controls</li>
                            <li>Deleted content is removed from active systems within a reasonable period and may persist in backups for a limited time</li>
                            <li>Logs and security data are retained for a limited period</li>
                            <li>Payment records are retained as required by law</li>
                        </ul>
                        <p className="text-secondary mt-4">
                            To request full account deletion, contact <a href="mailto:privacy@context-pack.com" className="text-accent hover:underline">privacy@context-pack.com</a>.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">5. Data Sharing & Subprocessors</h2>
                        <p className="text-secondary mb-3">We share data with trusted service providers only to operate the Service:</p>
                        <ul className="list-disc pl-6 space-y-2 text-secondary">
                            <li><strong>Cloudflare</strong> – content delivery, security</li>
                            <li><strong>Vercel</strong> – hosting and infrastructure</li>
                            <li><strong>Supabase</strong> – database, authentication, storage</li>
                            <li><strong>Google Analytics</strong> – usage analytics</li>
                            <li><strong>Stripe</strong> – payment processing (if applicable)</li>
                        </ul>
                        <p className="text-secondary mt-4">
                            These providers are contractually obligated to protect your data.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">6. AI Data Usage</h2>
                        <p className="text-secondary mb-3">
                            <strong>We do not use User Content to train AI models.</strong> User Content is processed solely to provide the Service.
                        </p>
                        <p className="text-secondary">
                            We may use anonymized, aggregated usage metrics to improve the Service.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">7. Your Privacy Rights</h2>

                        <h3 className="text-xl font-medium text-primary mb-3 mt-6">All Users</h3>
                        <p className="text-secondary">
                            You may request access, correction, or deletion of your personal data by contacting <a href="mailto:privacy@context-pack.com" className="text-accent hover:underline">privacy@context-pack.com</a>.
                        </p>

                        <h3 className="text-xl font-medium text-primary mb-3 mt-6">European Union / United Kingdom (GDPR)</h3>
                        <p className="text-secondary">
                            Users in the EEA, UK, or Switzerland have rights including access, rectification, erasure, restriction, portability, and objection. Data transfers outside the EU are protected using Standard Contractual Clauses.
                        </p>

                        <h3 className="text-xl font-medium text-primary mb-3 mt-6">California Residents (CCPA / CPRA)</h3>
                        <p className="text-secondary">
                            California residents have the right to know, delete, and correct personal information and the right to non-discrimination. <strong>We do not sell personal information.</strong>
                        </p>

                        <p className="text-secondary mt-4">
                            We will respond to verified requests within <strong>30 days</strong>.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">8. Security</h2>
                        <p className="text-secondary mb-3">
                            We implement reasonable administrative and technical safeguards, including encryption in transit and access controls. No system is completely secure.
                        </p>
                        <p className="text-secondary">
                            Security issues may be reported to <a href="mailto:security@context-pack.com" className="text-accent hover:underline">security@context-pack.com</a>.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">9. International Users</h2>
                        <p className="text-secondary">
                            Data is processed in the United States. By using the Service, you consent to the transfer and processing of data in the United States.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">10. Children's Privacy</h2>
                        <p className="text-secondary">
                            The Service is not directed to individuals under 18. We do not knowingly collect data from children.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">11. Changes to This Policy</h2>
                        <p className="text-secondary">
                            We may update this Privacy Policy from time to time. Continued use of the Service constitutes acceptance of the revised policy.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-primary mb-4">12. Contact</h2>
                        <div className="space-y-2 text-secondary">
                            <p><strong>Context Labs LLC</strong></p>
                            <p>Privacy: <a href="mailto:privacy@context-pack.com" className="text-accent hover:underline">privacy@context-pack.com</a></p>
                            <p>Security: <a href="mailto:security@context-pack.com" className="text-accent hover:underline">security@context-pack.com</a></p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
