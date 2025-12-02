// Generate a secure nonce for CSP using Web Crypto API (compatible with Edge Runtime)
export function generateNonce(): string {
  // Generate 16 random bytes and encode as base64
  const randomValues = new Uint8Array(16);
  crypto.getRandomValues(randomValues);

  // Convert to base64
  return btoa(String.fromCharCode(...randomValues));
}

// Generate CSP header with nonce
export function generateCSPHeader(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const cspDirectives = [
    "default-src 'self'",
    // Script sources: Use nonce for inline scripts, allow unsafe-eval in dev for Next.js HMR
    // Note: We avoid 'unsafe-inline' when using nonce to prevent browser warnings
    isDevelopment
      ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
      : `script-src 'self' 'nonce-${nonce}'`,
    // Style sources: Use nonce but allow unsafe-inline for development tools
    // This is necessary for Tailwind and some development tools
    `style-src 'self' 'nonce-${nonce}' ${isDevelopment ? "'unsafe-inline'" : ''}`,
    "img-src 'self' data: https:",
    "font-src 'self'",
    // Allow WebSocket connections in development for HMR
    isDevelopment
      ? "connect-src 'self' ws: wss:"
      : "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Only upgrade in production
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];

  return cspDirectives.join('; ');
}

// Security headers configuration
export const SECURITY_HEADERS = {
  'Content-Security-Policy': '', // Will be set dynamically with nonce
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Only add HSTS in production
  ...(process.env.NODE_ENV === 'production' && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  }),
};