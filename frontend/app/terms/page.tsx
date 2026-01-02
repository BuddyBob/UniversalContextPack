'use client'

import Link from 'next/link'

export default function TermsPage() {
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

                <h1 className="text-4xl font-bold text-black mb-2">Terms of Service</h1>
                <p className="text-gray-500 mb-12">Last Updated: January 1, 2026</p>

                {/* Content */}
                <div className="space-y-10 text-gray-800 leading-relaxed">
                    <p>
                        These Terms of Service ("Terms") govern your access to and use of <strong>Context Pack</strong>, a service operated by <strong>Context Labs LLC</strong>, a California limited liability company. Context Labs LLC operates the Service under the product name Context Pack.
                    </p>
                    <p className="text-sm">
                        By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
                    </p>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">1. Description of the Service</h2>
                        <p>
                            Context Pack is a software service that enables users to analyze, extract, summarize, transform, and reuse conversational or contextual data from AI systems in the form of portable context packs.
                        </p>
                        <p className="text-sm mt-2">
                            The Service processes user-provided data solely to provide its functionality. The Service is provided on an "as-is" basis and may change over time.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">2. Eligibility</h2>
                        <p>
                            You must be <strong>at least 18 years old</strong> to use the Service. By using the Service, you represent and warrant that you meet this requirement.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">3. User Accounts</h2>
                        <p className="mb-2">To access certain features, you may be required to create an account. You agree to:</p>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>Provide accurate and current registration information</li>
                            <li>Maintain the security of your credentials</li>
                            <li>Accept responsibility for all activity under your account</li>
                            <li>Notify us promptly of any unauthorized access or use</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">4. Acceptable Use</h2>
                        <p className="mb-2">You agree not to use the Service to:</p>
                        <ul className="list-disc pl-6 space-y-1 text-sm">
                            <li>Upload unlawful, harmful, or malicious content</li>
                            <li>Upload content that violates intellectual property, privacy, or confidentiality rights</li>
                            <li>Upload personal data of others without proper consent</li>
                            <li>Upload authentication credentials, passwords, or API keys</li>
                            <li>Upload malware, viruses, or malicious code</li>
                            <li>Attempt to reverse engineer, decompile, or compromise the Service</li>
                            <li>Use automated means to abuse, scrape, or overload the Service</li>
                            <li>Violate export control or sanctions laws</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">5. User Content</h2>

                        <h3 className="text-lg font-medium text-black mt-6 mb-2">5.1 Ownership</h3>
                        <p>You retain ownership of all data and content you upload to the Service ("User Content").</p>

                        <h3 className="text-lg font-medium text-black mt-6 mb-2">5.2 License to Process</h3>
                        <p>You grant Context Labs LLC a limited, non-exclusive license to process User Content solely to provide the Service.</p>

                        <h3 className="text-lg font-medium text-black mt-6 mb-2">5.3 Responsibility</h3>
                        <p>You are solely responsible for User Content and represent that you have all necessary rights to upload and process it.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">6. No Sensitive Data</h2>
                        <p className="mb-2">
                            The Service is <strong>not designed</strong> to store or process sensitive personal data. Do not upload:
                        </p>
                        <ul className="list-disc pl-6 space-y-1 text-sm">
                            <li>Financial or payment information</li>
                            <li>Medical or health data</li>
                            <li>Government-issued identification numbers</li>
                            <li>Passwords, private keys, or secrets</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">7. AI Limitations and Use of Content</h2>
                        <p className="mb-2">
                            <strong className="text-blue-600">Context Labs LLC does not use User Content to train AI models.</strong> User Content is processed solely to provide the Service.
                        </p>
                        <p className="text-sm mb-2">
                            We may use anonymized, aggregated usage metrics (not User Content) to improve the Service.
                        </p>
                        <p className="text-sm">
                            AI-generated outputs may be inaccurate or incomplete. You are responsible for verifying outputs before relying on them.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">8. Payments</h2>
                        <p className="mb-2">
                            Certain features require payment. Payments are processed through third-party providers such as Stripe.
                        </p>
                        <p className="text-sm">
                            <strong>All fees are non-refundable</strong> unless required by law. We are not responsible for actions or limitations imposed by payment processors.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">9. Intellectual Property</h2>
                        <p>
                            All software, technology, and materials provided by Context Labs LLC are owned by Context Labs LLC and protected by law.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">10. Service Availability</h2>
                        <p>
                            We do not guarantee uninterrupted access. The Service may be modified, suspended, or discontinued at any time.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">11. Disclaimer of Warranties</h2>
                        <p className="text-sm uppercase">
                            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." CONTEXT LABS LLC DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">12. Limitation of Liability</h2>
                        <p className="text-sm uppercase mb-2">
                            TO THE MAXIMUM EXTENT PERMITTED BY LAW, CONTEXT LABS LLC SHALL NOT BE LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES.
                        </p>
                        <p className="text-sm uppercase">
                            TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO CONTEXT LABS LLC IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">13. Indemnification</h2>
                        <p>
                            You agree to indemnify and hold harmless Context Labs LLC from claims arising out of your use of the Service or User Content.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">14. Security Incidents</h2>
                        <p>
                            In the event of a security incident affecting personal data, we will notify affected users without unreasonable delay and in accordance with applicable law.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">15. Copyright / DMCA</h2>
                        <p className="mb-3">
                            If you believe copyrighted material has been uploaded without authorization, contact:
                        </p>
                        <p><strong>DMCA Agent</strong></p>
                        <p>Email: <a href="mailto:dmca@context-pack.com" className="text-blue-600 hover:underline">dmca@context-pack.com</a></p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">16. Governing Law</h2>
                        <p>
                            These Terms are governed by the laws of the <strong>State of California</strong>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-black mb-4">17. Contact</h2>
                        <p><strong>Context Labs LLC</strong></p>
                        <p className="mt-2">
                            Support: <a href="mailto:support@context-pack.com" className="text-blue-600 hover:underline">support@context-pack.com</a>
                        </p>
                        <p>
                            Legal: <a href="mailto:legal@context-pack.com" className="text-blue-600 hover:underline">legal@context-pack.com</a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}
