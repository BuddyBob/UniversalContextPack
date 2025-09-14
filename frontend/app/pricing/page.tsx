import { Metadata } from 'next'
import PricingPageClient from './pricing-client'

export const metadata: Metadata = {
  title: 'Pricing - Universal Context Pack',
  description: 'Affordable AI conversation analysis pricing. Pay-per-use credits with volume discounts. Transform your ChatGPT and Claude conversations starting at $0.50 per credit.',
  alternates: {
    canonical: '/pricing'
  },
  openGraph: {
    title: 'Pricing - Universal Context Pack',
    description: 'Affordable AI conversation analysis pricing. Pay-per-use credits with volume discounts.',
    url: 'https://universal-context-pack.vercel.app/pricing',
  },
  keywords: [
    'AI conversation analysis pricing',
    'ChatGPT analysis cost',
    'Claude conversation pricing',
    'AI memory migration cost',
    'conversation processing credits'
  ]
}

export default function PricingPage() {
  return <PricingPageClient />
}