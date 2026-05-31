const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Standalone build for Docker */
  output: 'standalone',
  trailingSlash: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
