import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
/**
 * Backend host and port for API rewrites — override via env vars.
 * Defaults to localhost:3000 (same-host deployment / local dev).
 * En despliegues donde el backend está en otro host, setear BACKEND_HOST.
 */
const BACKEND_HOST = process.env.BACKEND_HOST || "localhost";
const BACKEND_PORT = process.env.BACKEND_PORT || "3000";

const nextConfig = {
  reactStrictMode: true,
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
    return {
      beforeFiles: [],
      afterFiles: [
      {
        source: '/api/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/api/:path*`,
      },
      {
        source: '/workshop/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/workshop/:path*`,
      },
      {
        source: '/inventory/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/inventory/:path*`,
      },
      {
        source: '/finance/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/finance/:path*`,
      },
      {
        source: '/analytics/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/analytics/:path*`,
      },
      {
        source: '/storage/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/storage/:path*`,
      },
      {
        source: '/health/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/health/:path*`,
      },
      {
        source: '/scheduling/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/scheduling/:path*`,
      },
      {
        source: '/whatsapp/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/whatsapp/:path*`,
      },
      {
        source: '/fleet/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/fleet/:path*`,
      },
      {
        source: '/thinkcar/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/thinkcar/:path*`,
      },
      {
        source: '/intelligence/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/intelligence/:path*`,
      },
      {
        source: '/marketing/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/marketing/:path*`,
      },
      {
        source: '/crm/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/crm/:path*`,
      },
      {
        source: '/billing/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/billing/:path*`,
      },
      {
        source: '/enterprise/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/enterprise/:path*`,
      },
      {
        source: '/import/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/import/:path*`,
      },
      {
        source: '/export/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/export/:path*`,
      },
      {
        source: '/reports/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/reports/:path*`,
      },
      {
        source: '/presets/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/presets/:path*`,
      },
      {
        source: '/audit/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/audit/:path*`,
      },
      {
        source: '/dvi/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/dvi/:path*`,
      },
      {
        source: '/label-printing/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/label-printing/:path*`,
      },
      {
        source: '/backup/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/backup/:path*`,
      },
      {
        source: '/security/:path*',
        destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/security/:path*`,
      },
      ],
      // `fallback` se evalúa DESPUÉS de las rutas dinámicas de la app (a
      // diferencia de `afterFiles`, que las pisa): así los links mágicos del
      // portal (`/portal/auth/magic/:token`) y `/portal/ordenes/:id` siguen
      // siendo páginas de Next y no terminan en un JSON crudo del backend.
      // Todo `/portal/*` que no sea una página sigue yendo al backend.
      fallback: [
        {
          source: '/portal/:path*',
          destination: `http://${BACKEND_HOST}:${BACKEND_PORT}/portal/:path*`,
        },
      ],
    };
  },
};

export default withNextIntl(nextConfig);
