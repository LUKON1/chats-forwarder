/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Standalone build for Docker */
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://bot-engine:4000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
