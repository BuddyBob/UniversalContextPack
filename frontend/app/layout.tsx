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
  metadataBase: new URL('https://www.context-pack.com'),
  title: {
    default: 'One Profile. Your AI. - Save AI Chats Forever',
    template: '%s | Context Pack'
  },
  description: 'Keep your ChatGPT, Claude, and AI conversations safe forever. Download, organize, and move your chat history between AI tools. Never lose important conversations again.',
  keywords: [
    'save ChatGPT chats',
    'backup AI conversations',
    'download ChatGPT history',
    'keep AI chats forever',
    'ChatGPT chat backup',
    'AI conversation storage',
    'move ChatGPT to Claude',
    'AI chat organizer',
    'preserve AI conversations',
    'ChatGPT export tool'
  ],
  authors: [{ name: 'Context Pack Team' }],
  creator: 'Context Pack',
  publisher: 'Context Pack',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.context-pack.com',
    siteName: 'Context Pack',
    title: 'One Profile. Your AI. - Save AI Chats Forever',
    description: 'Keep your ChatGPT, Claude, and AI conversations safe forever. Download, organize, and move your chat history between AI tools.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Context Pack - Save Your AI Chats Forever'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'One Profile. Your AI. - AI Memory Migration Platform',
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
    'google-adsense-account': 'ca-pub-2829668393972313',
    'theme-color': '#6639d0',
    'msapplication-TileColor': '#6639d0',
    'msapplication-TileImage': '/icon.png',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'One Profile. Your AI.',
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
    name: 'One Profile. Your AI. - Universal Context Pack',
    description: 'Transform your ChatGPT, Claude, and AI assistant conversations into portable context packs. Migrate your AI memory between platforms seamlessly.',
    url: 'https://www.context-pack.com',
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
      url: 'https://www.context-pack.com'
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

        {/* Google AdSense */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2829668393972313"
          crossOrigin="anonymous"
        />
        
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
