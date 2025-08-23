import ExportGuide from '@/components/ExportGuide'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Universal Context Pack - Transform Your AI Conversations',
  description: 'Upload your ChatGPT, Claude, or AI assistant conversation exports and create portable context packs. Migrate your AI memory between platforms with advanced conversation analysis.',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'Universal Context Pack - Transform Your AI Conversations',
    description: 'Upload your ChatGPT, Claude, or AI assistant conversation exports and create portable context packs.',
    url: 'https://universal-context-pack.vercel.app/',
  },
}

export default function HomePage() {
  return <ExportGuide />
}
