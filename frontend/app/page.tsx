import ExportGuide from '@/components/ExportGuide'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'One Profile. Your AI. - Save ChatGPT Chats Forever',
  description: 'Never lose your important ChatGPT conversations again. Upload your AI chat history and keep it safe forever. Works with ChatGPT, Claude, and other AI assistants.',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'One Profile. Your AI. - Save ChatGPT Chats Forever',
    description: 'Never lose your important ChatGPT conversations again. Upload your AI chat history and keep it safe forever.',
    url: 'https://www.context-pack.com/',
  },
}

export default function HomePage() {
  return <ExportGuide />
}
