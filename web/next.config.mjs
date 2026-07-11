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
      {
        source: '/scheduling/:path*',
        destination: 'http://localhost:4000/scheduling/:path*',
      },
      {
        source: '/whatsapp/:path*',
        destination: 'http://localhost:4000/whatsapp/:path*',
      },
      {
        source: '/fleet/:path*',
        destination: 'http://localhost:4000/fleet/:path*',
      },
      {
        source: '/thinkcar/:path*',
        destination: 'http://localhost:4000/thinkcar/:path*',
      },
      {
        source: '/intelligence/:path*',
        destination: 'http://localhost:4000/intelligence/:path*',
      },
      {
        source: '/marketing/:path*',
        destination: 'http://localhost:4000/marketing/:path*',
      },
      {
        source: '/crm/:path*',
        destination: 'http://localhost:4000/crm/:path*',
      },
      {
        source: '/portal/:path*',
        destination: 'http://localhost:4000/portal/:path*',
      },
      {
        source: '/import/:path*',
        destination: 'http://localhost:4000/import/:path*',
      },
      {
        source: '/export/:path*',
        destination: 'http://localhost:4000/export/:path*',
      },
      {
        source: '/reports/:path*',
        destination: 'http://localhost:4000/reports/:path*',
      },
      {
        source: '/presets/:path*',
        destination: 'http://localhost:4000/presets/:path*',
      },
      {
        source: '/audit/:path*',
        destination: 'http://localhost:4000/audit/:path*',
      },
    ];
  },
};

export default nextConfig;
