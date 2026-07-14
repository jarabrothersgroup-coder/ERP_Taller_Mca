import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
/** Backend port for API rewrites — override via BACKEND_PORT env var */
const BACKEND_PORT = process.env.BACKEND_PORT || "3000";

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
        destination: `http://localhost:${BACKEND_PORT}/api/:path*`,
      },
      {
        source: '/workshop/:path*',
        destination: `http://localhost:${BACKEND_PORT}/workshop/:path*`,
      },
      {
        source: '/inventory/:path*',
        destination: `http://localhost:${BACKEND_PORT}/inventory/:path*`,
      },
      {
        source: '/finance/:path*',
        destination: `http://localhost:${BACKEND_PORT}/finance/:path*`,
      },
      {
        source: '/health/:path*',
        destination: `http://localhost:${BACKEND_PORT}/health/:path*`,
      },
      {
        source: '/scheduling/:path*',
        destination: `http://localhost:${BACKEND_PORT}/scheduling/:path*`,
      },
      {
        source: '/whatsapp/:path*',
        destination: `http://localhost:${BACKEND_PORT}/whatsapp/:path*`,
      },
      {
        source: '/fleet/:path*',
        destination: `http://localhost:${BACKEND_PORT}/fleet/:path*`,
      },
      {
        source: '/thinkcar/:path*',
        destination: `http://localhost:${BACKEND_PORT}/thinkcar/:path*`,
      },
      {
        source: '/intelligence/:path*',
        destination: `http://localhost:${BACKEND_PORT}/intelligence/:path*`,
      },
      {
        source: '/marketing/:path*',
        destination: `http://localhost:${BACKEND_PORT}/marketing/:path*`,
      },
      {
        source: '/crm/:path*',
        destination: `http://localhost:${BACKEND_PORT}/crm/:path*`,
      },
      {
        source: '/billing/:path*',
        destination: `http://localhost:${BACKEND_PORT}/billing/:path*`,
      },
      {
        source: '/enterprise/:path*',
        destination: `http://localhost:${BACKEND_PORT}/enterprise/:path*`,
      },
      {
        source: '/portal/:path*',
        destination: `http://localhost:${BACKEND_PORT}/portal/:path*`,
      },
      {
        source: '/import/:path*',
        destination: `http://localhost:${BACKEND_PORT}/import/:path*`,
      },
      {
        source: '/export/:path*',
        destination: `http://localhost:${BACKEND_PORT}/export/:path*`,
      },
      {
        source: '/reports/:path*',
        destination: `http://localhost:${BACKEND_PORT}/reports/:path*`,
      },
      {
        source: '/presets/:path*',
        destination: `http://localhost:${BACKEND_PORT}/presets/:path*`,
      },
      {
        source: '/audit/:path*',
        destination: `http://localhost:${BACKEND_PORT}/audit/:path*`,
      },
      {
        source: '/dvi/:path*',
        destination: `http://localhost:${BACKEND_PORT}/dvi/:path*`,
      },
      {
        source: '/label-printing/:path*',
        destination: `http://localhost:${BACKEND_PORT}/label-printing/:path*`,
      },
      {
        source: '/backup/:path*',
        destination: `http://localhost:${BACKEND_PORT}/backup/:path*`,
      },
      {
        source: '/security/:path*',
        destination: `http://localhost:${BACKEND_PORT}/security/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
