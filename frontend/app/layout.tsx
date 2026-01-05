import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import FeedbackBanner from '@/components/FeedbackBanner'
import HolidayBanner from '@/components/HolidayBanner'
import Script from 'next/script'
import { GA_TRACKING_ID } from '@/lib/analytics'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://www.context-pack.com'),
  title: {
    default: 'Context Pack – Your AI’s Long-Term Memory',
    template: '%s | Context Pack'
  },
  description:
    'Create portable, long-term memory packs from your ChatGPT, Claude, and Gemini chats. Upload your history, generate a Context Pack, and use it across any AI model.',
  keywords: [
    'context pack',
    'AI memory',
    'AI long-term memory',
    'save ChatGPT chats',
    'backup AI conversations',
    'ChatGPT export tool',
    'Claude chat backup',
    'AI chat migration',
    'move ChatGPT to Claude',
    'AI context portability'
  ],
  authors: [{ name: 'Context Pack Team' }],
  creator: 'Context Pack',
  publisher: 'Context Pack',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.context-pack.com',
    siteName: 'Context Pack',
    title: 'Context Pack – Your AI’s Long-Term Memory',
    description:
      'Turn your AI chat history into a single portable Context Pack. Keep your data, move it anywhere, and make every model remember you.',
    images: [
      {
        url: '/og-image.jpeg',
        width: 1200,
        height: 630,
        alt: 'Context Pack – AI Long-Term Memory'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Context Pack – AI Memory Migration Platform',
    description:
      'Transform your ChatGPT, Claude, and Gemini conversations into portable Context Packs. Migrate your AI memory across platforms.',
    images: ['/og-image.jpeg'],
    creator: '@UCPlatform'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  verification: {
    google: 'y0ov938-bNbHn9KUyi_jwRuUdcwDbUrbKu5ZD7Y1lzQ'
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon.png', type: 'image/png', sizes: '16x16' },
      { url: '/icon.png', type: 'image/png', sizes: '48x48' }
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
    shortcut: '/favicon.ico',
    other: [
      {
        rel: 'mask-icon',
        url: '/icon.png',
        color: '#6639d0'
      }
    ]
  },
  other: {
    'google-adsense-account': 'ca-pub-2829668393972313',
    'theme-color': '#6639d0',
    'msapplication-TileColor': '#6639d0',
    'msapplication-TileImage': '/icon.png',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Context Pack',
    'format-detection': 'telephone=no'
  },
  manifest: '/manifest.json'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Context Pack – AI Memory Migration Platform',
    description:
      'Transform your ChatGPT, Claude, and Gemini conversations into portable Context Packs. Carry your AI memory across models instantly.',
    url: 'https://www.context-pack.com',
    applicationCategory: 'Utility',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: '0.08',
      description:
        'Pay-per-use AI conversation processing starting at $0.08 per credit.'
    },
    creator: {
      '@type': 'Organization',
      name: 'Context Pack',
      url: 'https://www.context-pack.com'
    }
  }

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-900 min-h-screen`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {/* Google tag (gtag.js) */}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-6B3CZGLXHB"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-6B3CZGLXHB');
            `,
          }}
        />

        {/* Google AdSense */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2829668393972313"
          crossOrigin="anonymous"
        />

        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            {/* <HolidayBanner /> */}
            {/* <FeedbackBanner /> */}
            {/* <MaintenanceBanner /> */}
            <Navigation />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
