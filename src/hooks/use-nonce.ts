'use client';

// Hook to access the CSP nonce from the server
export function useNonce(): string | undefined {
  // Get nonce from the meta tag or from server-side injection
  const metaNonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content');
  if (metaNonce) {
    return metaNonce;
  }

  return;
}