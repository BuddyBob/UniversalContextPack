/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
    R2_ENDPOINT: process.env.R2_ENDPOINT || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  },
  experimental: {
    serverComponentsExternalPackages: ['@aws-sdk/client-s3']
  }
}

module.exports = nextConfig
