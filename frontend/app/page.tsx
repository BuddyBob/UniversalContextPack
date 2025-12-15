import ExportGuide from '@/components/ExportGuide'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Context Pack - Your AI\'s long-term memory',
  description: 'Create portable, long-term memory packs from your ChatGPT, Claude, and Gemini chats. Upload your history, generate a Context Pack, and use it across any AI model.',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'Context Pack – Your AI’s Long-Term Memory',
    description:
      'Turn your AI chat history into a single portable Context Pack. Keep your data, move it anywhere, and make every model remember you.',
    url: 'https://www.context-pack.com/',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Context Pack?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Context Pack turns your ChatGPT, Claude, and Gemini chat history into portable memory files you can use across any AI platform. It extracts, analyzes, and formats your conversations so every new AI chat starts with your context.'
          }
        },
        {
          '@type': 'Question',
          name: 'How much does Context Pack cost?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Context Pack uses pay-per-use pricing at $0.08 per credit. Start free with 500 credits (enough for ~10-15 conversations). No subscriptions, no recurring fees - pay only for what you use.'
          }
        },
        {
          '@type': 'Question',
          name: 'Can I migrate my ChatGPT conversations to Claude?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes! Export your ChatGPT data, upload it to Context Pack, download your memory pack, and paste it into any new Claude conversation. Your context transfers seamlessly across all AI platforms.'
          }
        },
        {
          '@type': 'Question',
          name: 'Is my AI conversation data secure?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Absolutely. Context Pack uses AES-256 encryption for data at rest and TLS 1.3 for data in transit. We are SOC 2 certified and GDPR compliant. Your conversations are encrypted and securely stored on enterprise infrastructure.'
          }
        }
      ]
    })
  }
}

export default function HomePage() {
  return <ExportGuide />
}
