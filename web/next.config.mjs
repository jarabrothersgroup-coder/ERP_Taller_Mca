/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  optimizeFonts: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
      {
        source: '/workshop/:path*',
        destination: 'http://localhost:4000/workshop/:path*',
      },
      {
        source: '/inventory/:path*',
        destination: 'http://localhost:4000/inventory/:path*',
      },
      {
        source: '/finance/:path*',
        destination: 'http://localhost:4000/finance/:path*',
      },
      {
        source: '/health/:path*',
        destination: 'http://localhost:4000/health/:path*',
      },
    ];
  },
};

export default nextConfig;
