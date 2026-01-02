'use client'

import Link from 'next/link'

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background">
            {/* Hero Section */}
            <div className="bg-secondary border-b border-primary">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <Link
                        href="/"
                        className="text-sm text-secondary hover:text-accent transition-colors mb-6 inline-flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Home
                    </Link>
                    <h1 className="text-5xl font-bold text-primary mb-4">Privacy Policy</h1>
                    <p className="text-lg text-secondary">Effective Date: January 1, 2026</p>
                </div>
            </div>

            {/* Content Container */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                    {/* Table of Contents - Sticky Sidebar */}
                    <nav className="lg:col-span-1">
                        <div className="lg:sticky lg:top-8">
                            <h2 className="text-sm font-semibold text-primary mb-4 uppercase tracking-wider">Contents</h2>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#information-collection" className="text-secondary hover:text-accent transition-colors">Information We Collect</a></li>
                                <li><a href="#how-we-use" className="text-secondary hover:text-accent transition-colors">How We Use Information</a></li>
                                <li><a href="#cookies" className="text-secondary hover:text-accent transition-colors">Cookies & Analytics</a></li>
                                <li><a href="#retention" className="text-secondary hover:text-accent transition-colors">Data Retention & Deletion</a></li>
                                <li><a href="#sharing" className="text-secondary hover:text-accent transition-colors">Data Sharing</a></li>
                                <li><a href="#ai-usage" className="text-secondary hover:text-accent transition-colors">AI Data Usage</a></li>
                                <li><a href="#privacy-rights" className="text-secondary hover:text-accent transition-colors">Your Privacy Rights</a></li>
                                <li><a href="#security" className="text-secondary hover:text-accent transition-colors">Security</a></li>
                                <li><a href="#international" className="text-secondary hover:text-accent transition-colors">International Users</a></li>
                                <li><a href="#children" className="text-secondary hover:text-accent transition-colors">Children's Privacy</a></li>
                                <li><a href="#changes" className="text-secondary hover:text-accent transition-colors">Policy Changes</a></li>
                                <li><a href="#contact" className="text-secondary hover:text-accent transition-colors">Contact</a></li>
                            </ul>
                        </div>
                    </nav>

                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-12">
                        {/* Introduction */}
                        <section className="prose prose-lg max-w-none">
                            <p className="text-lg text-secondary leading-relaxed">
                                This Privacy Policy describes how <strong className="text-primary">Context Labs LLC</strong> ("we," "us") collects, uses, and protects information in connection with <strong className="text-primary">Context Pack</strong>.
                            </p>
                        </section>

                        {/* Section 1 */}
                        <section id="information-collection" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">1. Information We Collect</h2>

                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xl font-semibold text-primary mb-3">Information You Provide</h3>
                                        <ul className="space-y-2 text-secondary">
                                            <li className="flex items-start gap-3">
                                                <span className="text-accent mt-1">•</span>
                                                <span>Account information (email address)</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <span className="text-accent mt-1">•</span>
                                                <span>Content you upload or create using the Service</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-semibold text-primary mb-3">Automatically Collected Information</h3>
                                        <ul className="space-y-2 text-secondary">
                                            <li className="flex items-start gap-3">
                                                <span className="text-accent mt-1">•</span>
                                                <span>IP address</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <span className="text-accent mt-1">•</span>
                                                <span>Device and browser information</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <span className="text-accent mt-1">•</span>
                                                <span>Usage and performance data</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 2 */}
                        <section id="how-we-use" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">2. How We Use Information</h2>
                                <p className="text-secondary mb-4">We use information to:</p>
                                <ul className="space-y-2 text-secondary">
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Provide and operate the Service</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Maintain security and prevent abuse</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Improve performance and features</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Process payments</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Communicate service-related notices</span>
                                    </li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 3 */}
                        <section id="cookies" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">3. Cookies & Analytics</h2>
                                <p className="text-secondary mb-4">The Service uses cookies and similar technologies:</p>
                                <div className="space-y-3">
                                    <div className="bg-secondary/30 rounded-lg p-4 border border-primary">
                                        <p className="text-primary font-semibold mb-1">Essential Cookies</p>
                                        <p className="text-secondary text-sm">Required for authentication and core functionality</p>
                                    </div>
                                    <div className="bg-secondary/30 rounded-lg p-4 border border-primary">
                                        <p className="text-primary font-semibold mb-1">Analytics Cookies</p>
                                        <p className="text-secondary text-sm">Via Google Analytics to understand service usage</p>
                                    </div>
                                </div>
                                <p className="text-secondary mt-4 text-sm">
                                    You may control cookies through browser settings or opt out of Google Analytics using Google-provided tools.
                                </p>
                            </div>
                        </section>

                        {/* Section 4 */}
                        <section id="retention" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">4. Data Retention & Deletion</h2>
                                <ul className="space-y-2 text-secondary">
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Account information is retained while your account is active</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>User Content is retained only as long as necessary to provide the Service</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Users may delete content at any time using in-product controls</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Deleted content is removed from active systems within a reasonable period and may persist in backups for a limited time</span>
                                    </li>
                                </ul>
                                <div className="mt-6 bg-accent/10 border border-accent rounded-lg p-4">
                                    <p className="text-secondary">
                                        To request full account deletion, contact <a href="mailto:privacy@context-pack.com" className="text-accent hover:underline font-semibold">privacy@context-pack.com</a>
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 5 */}
                        <section id="sharing" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">5. Data Sharing & Subprocessors</h2>
                                <p className="text-secondary mb-4">We share data with trusted service providers only to operate the Service:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-secondary/30 rounded-lg p-3 border border-primary">
                                        <p className="text-primary font-semibold text-sm">Cloudflare</p>
                                        <p className="text-secondary text-xs">Content delivery, security</p>
                                    </div>
                                    <div className="bg-secondary/30 rounded-lg p-3 border border-primary">
                                        <p className="text-primary font-semibold text-sm">Vercel</p>
                                        <p className="text-secondary text-xs">Hosting and infrastructure</p>
                                    </div>
                                    <div className="bg-secondary/30 rounded-lg p-3 border border-primary">
                                        <p className="text-primary font-semibold text-sm">Supabase</p>
                                        <p className="text-secondary text-xs">Database, authentication, storage</p>
                                    </div>
                                    <div className="bg-secondary/30 rounded-lg p-3 border border-primary">
                                        <p className="text-primary font-semibold text-sm">Google Analytics</p>
                                        <p className="text-secondary text-xs">Usage analytics</p>
                                    </div>
                                    <div className="bg-secondary/30 rounded-lg p-3 border border-primary">
                                        <p className="text-primary font-semibold text-sm">Stripe</p>
                                        <p className="text-secondary text-xs">Payment processing</p>
                                    </div>
                                </div>
                                <p className="text-secondary mt-4 text-sm">These providers are contractually obligated to protect your data.</p>
                            </div>
                        </section>

                        {/* Section 6 - AI Usage Highlight */}
                        <section id="ai-usage" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">6. AI Data Usage</h2>
                                <div className="bg-accent/10 border-2 border-accent rounded-lg p-6">
                                    <p className="text-primary font-bold text-lg mb-3">
                                        ✓ We do not use User Content to train AI models
                                    </p>
                                    <p className="text-secondary">
                                        User Content is processed solely to provide the Service. We may use anonymized, aggregated usage metrics to improve the Service.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 7 */}
                        <section id="privacy-rights" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">7. Your Privacy Rights</h2>

                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xl font-semibold text-primary mb-3">All Users</h3>
                                        <p className="text-secondary">
                                            You may request access, correction, or deletion of your personal data by contacting <a href="mailto:privacy@context-pack.com" className="text-accent hover:underline">privacy@context-pack.com</a>.
                                        </p>
                                    </div>

                                    <div className="bg-secondary/30 rounded-lg p-5 border border-primary">
                                        <h3 className="text-lg font-semibold text-primary mb-2">European Union / United Kingdom (GDPR)</h3>
                                        <p className="text-secondary text-sm">
                                            Users in the EEA, UK, or Switzerland have rights including access, rectification, erasure, restriction, portability, and objection. Data transfers outside the EU are protected using Standard Contractual Clauses.
                                        </p>
                                    </div>

                                    <div className="bg-secondary/30 rounded-lg p-5 border border-primary">
                                        <h3 className="text-lg font-semibold text-primary mb-2">California Residents (CCPA / CPRA)</h3>
                                        <p className="text-secondary text-sm mb-2">
                                            California residents have the right to know, delete, and correct personal information and the right to non-discrimination.
                                        </p>
                                        <p className="text-accent font-semibold text-sm">We do not sell personal information.</p>
                                    </div>

                                    <p className="text-secondary text-sm">
                                        We will respond to verified requests within <strong className="text-primary">30 days</strong>.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Remaining sections with consistent styling */}
                        <section id="security" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">8. Security</h2>
                                <p className="text-secondary mb-3">
                                    We implement reasonable administrative and technical safeguards, including encryption in transit and access controls. No system is completely secure.
                                </p>
                                <p className="text-secondary">
                                    Security issues may be reported to <a href="mailto:security@context-pack.com" className="text-accent hover:underline font-semibold">security@context-pack.com</a>.
                                </p>
                            </div>
                        </section>

                        <section id="international" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">9. International Users</h2>
                                <p className="text-secondary">
                                    Data is processed in the United States. By using the Service, you consent to the transfer and processing of data in the United States.
                                </p>
                            </div>
                        </section>

                        <section id="children" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">10. Children's Privacy</h2>
                                <p className="text-secondary">
                                    The Service is not directed to individuals under 18. We do not knowingly collect data from children.
                                </p>
                            </div>
                        </section>

                        <section id="changes" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">11. Changes to This Policy</h2>
                                <p className="text-secondary">
                                    We may update this Privacy Policy from time to time. Continued use of the Service constitutes acceptance of the revised policy.
                                </p>
                            </div>
                        </section>

                        <section id="contact" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">12. Contact</h2>
                                <div className="bg-secondary/30 rounded-lg p-6 border border-primary">
                                    <p className="text-primary font-bold mb-4">Context Labs LLC</p>
                                    <div className="space-y-2">
                                        <p className="text-secondary">
                                            <span className="text-primary font-semibold">Privacy:</span>{' '}
                                            <a href="mailto:privacy@context-pack.com" className="text-accent hover:underline">privacy@context-pack.com</a>
                                        </p>
                                        <p className="text-secondary">
                                            <span className="text-primary font-semibold">Security:</span>{' '}
                                            <a href="mailto:security@context-pack.com" className="text-accent hover:underline">security@context-pack.com</a>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
