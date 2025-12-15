import ExportGuide from '@/components/ExportGuide'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Context Pack - Your AI\'s long-term memory',
  description: 'Move AI memory across platforms with Context Pack. Create portable memory packs from ChatGPT, Claude, and Gemini chats. Transfer your AI conversation history and context to any AI model.',
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
        },
        {
          '@type': 'Question',
          name: 'How do I move my AI memory between different AI platforms?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'To move AI memory between platforms: (1) Export your conversations from your current AI platform, (2) Upload the export file to Context Pack to create a portable memory pack, (3) Copy the generated pack and paste it into any new AI chat. This transfers your full conversation history and context across ChatGPT, Claude, Gemini, and other AI platforms.'
          }
        },
        {
          '@type': 'Question',
          name: 'Can I transfer AI memory from ChatGPT to Claude or Gemini?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes! You can easily transfer AI memory from ChatGPT to Claude, Gemini, or any other AI platform. Export your ChatGPT data, upload it to Context Pack, and use the generated memory pack in your new AI conversations. Your preferences, context, and conversation history move seamlessly between platforms.'
          }
        },
        {
          '@type': 'Question',
          name: 'What is the easiest way to move AI conversation history?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The easiest way to move AI conversation history is with Context Pack. Simply export your chat data from any AI platform (ChatGPT, Claude, etc.), upload it to Context Pack, and receive a portable memory file. Paste this file into any new AI chat to instantly restore your full context and conversation history.'
          }
        }
      ]
    })
  }
}

export default function HomePage() {
  return <ExportGuide />
}
