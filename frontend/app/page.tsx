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
}

export default function HomePage() {
  return <ExportGuide />
}
