'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthErrorMessage } from '@/lib/auth-client';
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import clientLogger from '@/lib/client-logger';

const loginSchema = z.object({
  email: z.email('Correo electrónico no válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
  remember: z.boolean(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  });

  // Set focus to email field on mount
  useEffect(() => {
    setFocus('email');
  }, [setFocus]);

  // Check for authentication errors from URL
  useEffect(() => {
    const urlError = searchParams?.get('error');
    if (urlError) {
      setError(getAuthErrorMessage(urlError));
    }
  }, [searchParams]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
        callbackUrl: '/dashboard',
      });

      if (result?.error) {
        setError(getAuthErrorMessage(result.error));
        return;
      }

      if (result?.ok) {
        // Successful login - redirect to dashboard or intended URL
        let callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';

        // Validate callbackUrl to prevent redirect loops
        if (callbackUrl && typeof callbackUrl === 'string') {
          try {
            const url = new URL(callbackUrl, window.location.origin);
            // Only allow relative URLs or same-origin URLs
            if (url.origin !== window.location.origin && !callbackUrl.startsWith('/')) {
              callbackUrl = '/dashboard';
            }
            // Prevent redirecting back to auth pages
            if (callbackUrl.startsWith('/login') || callbackUrl.startsWith('/forgot-password')) {
              callbackUrl = '/dashboard';
            }
          } catch {
            // Invalid URL, use default
            callbackUrl = '/dashboard';
          }
        }

        router.push(callbackUrl);
        router.refresh();
      } else {
        setError('Error inesperado al iniciar sesión');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Login error:', error);
      }
      setError('Error de conexión. Por favor, intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Plataforma MOPC
        </CardTitle>
        <CardDescription className="text-center">
          Ingresa tus credenciales para acceder al sistema
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="correo@mopc.gob.do"
              {...register('email')}
              disabled={isLoading}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingresa tu contraseña"
                {...register('password')}
                disabled={isLoading}
                className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="remember"
              type="checkbox"
              {...register('remember')}
              disabled={isLoading}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="remember" className="text-sm font-normal">
              Recordarme en este dispositivo
            </Label>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              'Iniciar sesión'
            )}
          </Button>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-primary hover:underline"
              disabled={isLoading}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}