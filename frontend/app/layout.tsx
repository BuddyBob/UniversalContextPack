import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import Script from 'next/script'
import { GA_TRACKING_ID } from '@/lib/analytics'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://universal-context-pack.vercel.app'),
  title: {
    default: 'Universal Context Pack - AI Memory Migration Platform',
    template: '%s | Universal Context Pack'
  },
  description: 'Transform your ChatGPT, Claude, and AI assistant conversations into portable context packs. Migrate your AI memory between platforms seamlessly with advanced conversation analysis.',
  keywords: [
    'AI context migration',
    'ChatGPT export',
    'Claude conversation analysis', 
    'AI assistant memory',
    'conversation data processing',
    'AI personalization',
    'context pack',
    'AI tool switching',
    'OpenAI conversation export',
    'AI conversation backup'
  ],
  authors: [{ name: 'Universal Context Pack Team' }],
  creator: 'Universal Context Pack',
  publisher: 'Universal Context Pack',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://universal-context-pack.vercel.app',
    siteName: 'Universal Context Pack',
    title: 'Universal Context Pack - AI Memory Migration Platform',
    description: 'Transform your AI conversations into portable context packs. Migrate your memory between ChatGPT, Claude, and other AI assistants seamlessly.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Universal Context Pack - AI Memory Migration'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Universal Context Pack - AI Memory Migration Platform',
    description: 'Transform your AI conversations into portable context packs. Migrate your memory between ChatGPT, Claude, and other AI assistants.',
    images: ['/og-image.png'],
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
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code-here', // Add your Google Search Console verification code
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon.png', type: 'image/png', sizes: '16x16' },
      { url: '/icon.png', type: 'image/png', sizes: '48x48' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180' }
    ],
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
    'theme-color': '#6639d0',
    'msapplication-TileColor': '#6639d0',
    'msapplication-TileImage': '/icon.png',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Universal Context Pack',
    'format-detection': 'telephone=no',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Universal Context Pack',
    description: 'Transform your ChatGPT, Claude, and AI assistant conversations into portable context packs. Migrate your AI memory between platforms seamlessly.',
    url: 'https://universal-context-pack.vercel.app',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: '0.08',
      description: 'Pay-per-use AI conversation analysis starting at $0.08 per credit'
    },
    creator: {
      '@type': 'Organization',
      name: 'Universal Context Pack',
      url: 'https://universal-context-pack.vercel.app'
    }
  }

  return (
    <html lang="en">
      <body className={`${inter.className} bg-white dark:bg-gray-900 min-h-screen transition-colors duration-300`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {/* Google Analytics */}
        {GA_TRACKING_ID && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_TRACKING_ID}', {
                    page_location: window.location.href,
                    page_title: document.title,
                  });
                `,
              }}
            />
          </>
        )}
        
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
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
