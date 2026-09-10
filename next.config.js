/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PDF.js worker configuration
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
}

module.exports = nextConfig

