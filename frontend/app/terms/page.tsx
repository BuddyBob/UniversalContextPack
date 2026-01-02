'use client'

import Link from 'next/link'

export default function TermsPage() {
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
                    <h1 className="text-5xl font-bold text-primary mb-4">Terms of Service</h1>
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
                                <li><a href="#service-description" className="text-secondary hover:text-accent transition-colors">Service Description</a></li>
                                <li><a href="#eligibility" className="text-secondary hover:text-accent transition-colors">Eligibility</a></li>
                                <li><a href="#accounts" className="text-secondary hover:text-accent transition-colors">User Accounts</a></li>
                                <li><a href="#acceptable-use" className="text-secondary hover:text-accent transition-colors">Acceptable Use</a></li>
                                <li><a href="#user-content" className="text-secondary hover:text-accent transition-colors">User Content</a></li>
                                <li><a href="#sensitive-data" className="text-secondary hover:text-accent transition-colors">No Sensitive Data</a></li>
                                <li><a href="#ai-limitations" className="text-secondary hover:text-accent transition-colors">AI Limitations</a></li>
                                <li><a href="#payments" className="text-secondary hover:text-accent transition-colors">Payments</a></li>
                                <li><a href="#ip" className="text-secondary hover:text-accent transition-colors">Intellectual Property</a></li>
                                <li><a href="#availability" className="text-secondary hover:text-accent transition-colors">Service Availability</a></li>
                                <li><a href="#warranties" className="text-secondary hover:text-accent transition-colors">Disclaimer</a></li>
                                <li><a href="#liability" className="text-secondary hover:text-accent transition-colors">Limitation of Liability</a></li>
                                <li><a href="#dmca" className="text-secondary hover:text-accent transition-colors">DMCA</a></li>
                                <li><a href="#governing-law" className="text-secondary hover:text-accent transition-colors">Governing Law</a></li>
                                <li><a href="#contact" className="text-secondary hover:text-accent transition-colors">Contact</a></li>
                            </ul>
                        </div>
                    </nav>

                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-12">
                        {/* Introduction */}
                        <section className="prose prose-lg max-w-none">
                            <p className="text-lg text-secondary leading-relaxed mb-4">
                                These Terms of Service ("Terms") govern your access to and use of <strong className="text-primary">Context Pack</strong>, a service operated by <strong className="text-primary">Context Labs LLC</strong>, a California limited liability company ("Context Labs," "we," "us," or "our"). Context Labs LLC operates the Service under the product name Context Pack.
                            </p>
                            <div className="bg-accent/10 border-l-4 border-accent p-4 rounded-r-lg">
                                <p className="text-secondary font-semibold text-sm">
                                    By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
                                </p>
                            </div>
                        </section>

                        {/* Section 1 */}
                        <section id="service-description" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">1. Description of the Service</h2>
                                <p className="text-secondary mb-3">
                                    Context Pack is a software service that enables users to analyze, extract, summarize, transform, and reuse conversational or contextual data from AI systems in the form of portable context packs.
                                </p>
                                <p className="text-secondary text-sm">
                                    The Service processes user-provided data solely to provide its functionality. The Service is provided on an "as-is" basis and may change over time.
                                </p>
                            </div>
                        </section>

                        {/* Section 2 */}
                        <section id="eligibility" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">2. Eligibility</h2>
                                <div className="bg-accent/10 border border-accent rounded-lg p-4">
                                    <p className="text-primary font-semibold">
                                        You must be <strong>at least 18 years old</strong> to use the Service.
                                    </p>
                                    <p className="text-secondary text-sm mt-2">
                                        By using the Service, you represent and warrant that you meet this requirement.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Section 3 */}
                        <section id="accounts" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">3. User Accounts</h2>
                                <p className="text-secondary mb-4">To access certain features, you may be required to create an account. You agree to:</p>
                                <ul className="space-y-2 text-secondary">
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Provide accurate and current registration information</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Maintain the security of your credentials</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Accept responsibility for all activity under your account</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-accent mt-1">•</span>
                                        <span>Notify us promptly of any unauthorized access or use</span>
                                    </li>
                                </ul>
                            </div>
                        </section>

                        {/* Section 4 */}
                        <section id="acceptable-use" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">4. Acceptable Use</h2>
                                <p className="text-secondary mb-4">You agree <strong>not to use</strong> the Service to:</p>
                                <div className="grid gap-2">
                                    <div className="flex items-start gap-3 text-secondary text-sm">
                                        <span className="text-red-400 mt-1">✕</span>
                                        <span>Upload unlawful, harmful, or malicious content</span>
                                    </div>
                                    <div className="flex items-start gap-3 text-secondary text-sm">
                                        <span className="text-red-400 mt-1">✕</span>
                                        <span>Upload content that violates intellectual property, privacy, or confidentiality rights</span>
                                    </div>
                                    <div className="flex items-start gap-3 text-secondary text-sm">
                                        <span className="text-red-400 mt-1">✕</span>
                                        <span>Upload personal data of others without proper consent</span>
                                    </div>
                                    <div className="flex items-start gap-3 text-secondary text-sm">
                                        <span className="text-red-400 mt-1">✕</span>
                                        <span>Upload authentication credentials, passwords, or API keys</span>
                                    </div>
                                    <div className="flex items-start gap-3 text-secondary text-sm">
                                        <span className="text-red-400 mt-1">✕</span>
                                        <span>Upload malware, viruses, or malicious code</span>
                                    </div>
                                    <div className="flex items-start gap-3 text-secondary text-sm">
                                        <span className="text-red-400 mt-1">✕</span>
                                        <span>Attempt to reverse engineer, decompile, or compromise the Service</span>
                                    </div>
                                    <div className="flex items-start gap-3 text-secondary text-sm">
                                        <span className="text-red-400 mt-1">✕</span>
                                        <span>Use automated means to abuse, scrape, or overload the Service</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 5 */}
                        <section id="user-content" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">5. User Content</h2>
                                <div className="space-y-4">
                                    <div className="bg-secondary/30 rounded-lg p-5 border border-primary">
                                        <h3 className="text-lg font-semibold text-primary mb-2">5.1 Ownership</h3>
                                        <p className="text-secondary text-sm">You retain ownership of all data and content you upload to the Service ("User Content").</p>
                                    </div>
                                    <div className="bg-secondary/30 rounded-lg p-5 border border-primary">
                                        <h3 className="text-lg font-semibold text-primary mb-2">5.2 License to Process</h3>
                                        <p className="text-secondary text-sm">You grant Context Labs LLC a limited, non-exclusive license to process User Content solely to provide the Service.</p>
                                    </div>
                                    <div className="bg-secondary/30 rounded-lg p-5 border border-primary">
                                        <h3 className="text-lg font-semibold text-primary mb-2">5.3 Responsibility</h3>
                                        <p className="text-secondary text-sm">You are solely responsible for User Content and represent that you have all necessary rights to upload and process it.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 6 */}
                        <section id="sensitive-data" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">6. No Sensitive Data</h2>
                                <div className="bg-red-500/10 border border-red-500 rounded-lg p-5">
                                    <p className="text-secondary mb-3">
                                        The Service is <strong className="text-primary">not designed</strong> to store or process sensitive personal data. Do not upload:
                                    </p>
                                    <div className="grid gap-2">
                                        <div className="flex items-start gap-3 text-secondary text-sm">
                                            <span className="text-red-400">⚠</span>
                                            <span>Financial or payment information</span>
                                        </div>
                                        <div className="flex items-start gap-3 text-secondary text-sm">
                                            <span className="text-red-400">⚠</span>
                                            <span>Medical or health data</span>
                                        </div>
                                        <div className="flex items-start gap-3 text-secondary text-sm">
                                            <span className="text-red-400">⚠</span>
                                            <span>Government-issued identification numbers</span>
                                        </div>
                                        <div className="flex items-start gap-3 text-secondary text-sm">
                                            <span className="text-red-400">⚠</span>
                                            <span>Passwords, private keys, or secrets</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 7 - AI Highlight */}
                        <section id="ai-limitations" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">7. AI Limitations and Use of Content</h2>
                                <div className="bg-accent/10 border-2 border-accent rounded-lg p-6 mb-4">
                                    <p className="text-primary font-bold text-lg mb-3">
                                        ✓ Context Labs LLC does not use User Content to train AI models
                                    </p>
                                    <p className="text-secondary text-sm">
                                        User Content is processed solely to provide the Service. We may use anonymized, aggregated usage metrics (not User Content) to improve the Service.
                                    </p>
                                </div>
                                <p className="text-secondary text-sm">
                                    AI-generated outputs may be inaccurate or incomplete. You are responsible for verifying outputs before relying on them.
                                </p>
                            </div>
                        </section>

                        {/* Section 8 */}
                        <section id="payments" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">8. Payments</h2>
                                <p className="text-secondary mb-3">
                                    Certain features require payment. Payments are processed through third-party providers such as Stripe.
                                </p>
                                <div className="bg-secondary/30 rounded-lg p-4 border border-primary">
                                    <p className="text-primary font-semibold text-sm">
                                        ⚠ All fees are non-refundable unless required by law
                                    </p>
                                    <p className="text-secondary text-xs mt-2">
                                        We are not responsible for actions or limitations imposed by payment processors.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Remaining sections */}
                        <section id="ip" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">9. Intellectual Property</h2>
                                <p className="text-secondary">
                                    All software, technology, and materials provided by Context Labs LLC are owned by Context Labs LLC and protected by law.
                                </p>
                            </div>
                        </section>

                        <section id="availability" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">10. Service Availability</h2>
                                <p className="text-secondary">
                                    We do not guarantee uninterrupted access. The Service may be modified, suspended, or discontinued at any time.
                                </p>
                            </div>
                        </section>

                        <section id="warranties" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">11. Disclaimer of Warranties</h2>
                                <div className="bg-secondary/30 rounded-lg p-4 border border-primary">
                                    <p className="text-secondary text-sm uppercase tracking-wide">
                                        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." CONTEXT LABS LLC DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section id="liability" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">12. Limitation of Liability</h2>
                                <div className="bg-secondary/30 rounded-lg p-4 border border-primary space-y-3">
                                    <p className="text-secondary text-sm uppercase tracking-wide">
                                        TO THE MAXIMUM EXTENT PERMITTED BY LAW, CONTEXT LABS LLC SHALL NOT BE LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES.
                                    </p>
                                    <p className="text-secondary text-sm uppercase tracking-wide">
                                        TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO CONTEXT LABS LLC IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section id="dmca" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">15. Copyright / DMCA</h2>
                                <p className="text-secondary mb-4">
                                    If you believe copyrighted material has been uploaded without authorization, contact:
                                </p>
                                <div className="bg-secondary/30 rounded-lg p-5 border border-primary">
                                    <p className="text-primary font-bold mb-3">DMCA Agent</p>
                                    <p className="text-secondary">
                                        Email: <a href="mailto:dmca@context-pack.com" className="text-accent hover:underline">dmca@context-pack.com</a>
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section id="governing-law" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-4">16. Governing Law</h2>
                                <p className="text-secondary">
                                    These Terms are governed by the laws of the <strong className="text-primary">State of California</strong>.
                                </p>
                            </div>
                        </section>

                        <section id="contact" className="scroll-mt-8">
                            <div className="border-l-4 border-accent pl-6">
                                <h2 className="text-3xl font-bold text-primary mb-6">17. Contact</h2>
                                <div className="bg-secondary/30 rounded-lg p-6 border border-primary">
                                    <p className="text-primary font-bold mb-4">Context Labs LLC</p>
                                    <div className="space-y-2">
                                        <p className="text-secondary">
                                            <span className="text-primary font-semibold">Support:</span>{' '}
                                            <a href="mailto:support@context-pack.com" className="text-accent hover:underline">support@context-pack.com</a>
                                        </p>
                                        <p className="text-secondary">
                                            <span className="text-primary font-semibold">Legal:</span>{' '}
                                            <a href="mailto:legal@context-pack.com" className="text-accent hover:underline">legal@context-pack.com</a>
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
