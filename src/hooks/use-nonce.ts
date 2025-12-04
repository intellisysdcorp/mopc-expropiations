'use client';

import { useState, useEffect } from 'react';

// Hook to access the CSP nonce from the server
export function useNonce(): string | undefined {
  const [nonce, setNonce] = useState<string | undefined>();

  useEffect(() => {
    // Get nonce from the meta tag or from server-side injection
    const metaNonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content');
    if (metaNonce) {
      setNonce(metaNonce);
    }
  }, []);

  return nonce;
}