import ExportGuide from '@/components/ExportGuide'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Save Your ChatGPT Chats Forever - Free AI Chat Backup',
  description: 'Never lose your important ChatGPT conversations again. Upload your AI chat history and keep it safe forever. Works with ChatGPT, Claude, and other AI assistants.',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'Save Your ChatGPT Chats Forever - Free AI Chat Backup',
    description: 'Never lose your important ChatGPT conversations again. Upload your AI chat history and keep it safe forever.',
    url: 'https://www.context-pack.com/',
  },
}

export default function HomePage() {
  return <ExportGuide />
}
