/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = withBundleAnalyzer({
  // Use webpack instead of Turbopack for compatibility with custom config
  turbopack: {
    // Leave empty to use webpack with custom config
  },
  // Move @prisma/client to serverExternalPackages for Next.js 15
  serverExternalPackages: [
    '@prisma/client',
    'sharp',
    'archiver',
    'xlsx',
    'jspdf',
    'html2canvas',
    'bull',
    'nodemailer',
    'bcrypt',
    'argon2'
  ],
  // Enable React strict mode for better error handling
  reactStrictMode: true,
  // Experimental optimizations for tree-shaking
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'react-day-picker',
      'date-fns',
      'lodash-es',
      '@radix-ui/react-icons'
    ],
  },
  // Handle proper module resolution with bundle splitting
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      // Exclude server-only modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };

      // Add bundle splitting for production
      if (!dev) {
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              // Split vendor libraries
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
                priority: 10,
              },
              // Split React ecosystem
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom|react-query|@tanstack)[\\/]/,
                name: 'react',
                chunks: 'all',
                priority: 20,
              },
              // Split UI libraries
              ui: {
                test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|class-variance-authority|clsx|tailwind-merge)[\\/]/,
                name: 'ui',
                chunks: 'all',
                priority: 15,
              },
              // Split chart libraries
              charts: {
                test: /[\\/]node_modules[\\/](recharts|d3|chart\.js)[\\/]/,
                name: 'charts',
                chunks: 'all',
                priority: 15,
              },
              // Split date/time libraries
              date: {
                test: /[\\/]node_modules[\\/](date-fns|dayjs|moment|react-day-picker)[\\/]/,
                name: 'date',
                chunks: 'all',
                priority: 15,
              },
              // Split utility libraries
              utils: {
                test: /[\\/]node_modules[\\/](lodash-es|ramda|underscore)[\\/]/,
                name: 'utils',
                chunks: 'all',
                priority: 15,
              },
              // Common chunks for shared code
              common: {
                name: 'common',
                minChunks: 2,
                chunks: 'all',
                priority: 5,
                reuseExistingChunk: true,
              },
            },
          },
        };
      }
    }
    return config;
  },

  // Configure headers for security
  async headers() {
    const headers = [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];

    // Add CORS headers for API routes only in production
    if (process.env.NODE_ENV === 'production') {
      headers.push({
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGIN || process.env.NEXTAUTH_URL || process.env.APP_URL,
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, x-csrf-token, x-requested-with',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // 24 hours
          },
        ],
      });
    }

    return headers;
  },
});

module.exports = nextConfig;