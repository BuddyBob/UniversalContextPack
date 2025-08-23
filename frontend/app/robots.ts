import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://universal-context-pack.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/profile/', '/process/']  // Protect user-specific areas
      }
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
