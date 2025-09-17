import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')
  
  // Domain redirects - handle first before other middleware
  if (hostname === 'universal-context-pack.vercel.app') {
    const url = request.nextUrl.clone()
    url.hostname = 'www.context-pack.com'
    url.protocol = 'https'
    return NextResponse.redirect(url, 301)
  }
  
  if (hostname === 'context-pack.com') {
    const url = request.nextUrl.clone()
    url.hostname = 'www.context-pack.com'
    url.protocol = 'https'
    return NextResponse.redirect(url, 301)
  }
  
  const response = NextResponse.next();
  
  // Add noindex to preview deployments to prevent indexing of development versions
  if (process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
