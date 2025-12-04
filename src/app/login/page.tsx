'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { Building2 } from 'lucide-react';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.isActive) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render if already authenticated
  if (status === 'authenticated') {
    if (session?.user?.isActive) {
      router.push('/dashboard');
      return null;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-primary rounded-full">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-foreground">
            Plataforma MOPC
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sistema de Gestión de Casos de Expropiación
          </p>
        </div>

        {/* Login Form */}
        <LoginForm />

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Ministerio de Obras Públicas y Comunicaciones
          </p>
          <p className="mt-1">
            República Dominicana
          </p>
        </div>
      </div>
    </div>
  );
}