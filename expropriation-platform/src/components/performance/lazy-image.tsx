'use client';

import { useState, useRef, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';

interface LazyImageProps extends Omit<ImageProps, 'onLoad'> {
  fallback?: string;
  wrapperClassName?: string;
}

export function LazyImage({
  src,
  alt,
  fallback = '/images/placeholder.png',
  wrapperClassName,
  className,
  priority = false,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before coming into view
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div ref={imgRef} className={wrapperClassName}>
      {!isLoaded && (
        <Skeleton
          className={`${className} absolute inset-0`}
          style={{ aspectRatio: props.width && props.height ? `${props.width}/${props.height}` : undefined }}
        />
      )}

      {isInView && (
        <Image
          src={hasError ? fallback : src}
          alt={alt}
          className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          onLoad={handleLoad}
          onError={handleError}
          priority={priority}
          {...props}
        />
      )}
    </div>
  );
}