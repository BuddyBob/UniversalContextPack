import type { Metadata } from 'next'
import SecurityClient from './security-client'

export const metadata: Metadata = {
    title: 'Security & Privacy - Enterprise-Grade Protection',
    description: 'Learn how Context Pack protects your AI conversations with enterprise-grade security. AES-256 encryption, SOC 2 compliance, GDPR compliant data processing.',
    alternates: {
        canonical: '/security'
    },
    openGraph: {
        title: 'Context Pack Security - Enterprise Data Protection',
        description: 'Enterprise-grade security for your AI memory. Military-grade encryption, SOC 2 certified infrastructure, complete data privacy.',
        url: 'https://www.context-pack.com/security',
    },
    keywords: [
        'ai conversation security',
        'chatgpt data privacy',
        'ai memory encryption',
        'soc 2 ai platform',
        'gdpr compliant ai tool',
        'secure ai chat storage',
        'enterprise ai security'
    ]
}

export default function SecurityPage() {
    return <SecurityClient />
}
