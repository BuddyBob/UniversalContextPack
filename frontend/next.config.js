/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@aws-sdk/client-s3']
  },
  async redirects() {
    return [
      // Redirect universal-context-pack.vercel.app to www.context-pack.com
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'universal-context-pack.vercel.app',
          },
        ],
        destination: 'https://www.context-pack.com/:path*',
        permanent: true,
      },
      // Redirect context-pack.com (without www) to www.context-pack.com
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'context-pack.com',
          },
        ],
        destination: 'https://www.context-pack.com/:path*',
        permanent: true,
      },
    ];
  },
}

module.exports = nextConfig
