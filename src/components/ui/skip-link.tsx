'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface SkipLinkProps {
  className?: string;
}

export function SkipLink({ className }: SkipLinkProps) {
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsFocused(true);
      }
    };

    const handleMouseDown = () => {
      setIsFocused(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  if (!isFocused) return null;

  return (
    <Button
      variant="outline"
      className={className}
      onClick={() => {
        const mainContent = document.getElementById('main-content');
        mainContent?.focus();
        mainContent?.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      Saltar al contenido principal
    </Button>
  );
}