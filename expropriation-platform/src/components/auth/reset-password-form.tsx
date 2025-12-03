'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { validatePassword } from '@/lib/auth-client';
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import clientLogger from '@/lib/client-logger';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .refine(
        (password) => /[A-Z]/.test(password),
        'La contraseña debe contener al menos una letra mayúscula'
      )
      .refine(
        (password) => /[a-z]/.test(password),
        'La contraseña debe contener al menos una letra minúscula'
      )
      .refine(
        (password) => /\d/.test(password),
        'La contraseña debe contener al menos un número'
      )
      .refine(
        (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
        'La contraseña debe contener al menos un carácter especial'
      ),
    confirmPassword: z.string().min(1, 'Por favor, confirme su contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setFocus,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');

  // Get token from URL on mount
  useEffect(() => {
    const urlToken = searchParams?.get('token');
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError('Token de recuperación inválido o faltante');
    }
    setFocus('password');
  }, [searchParams, setFocus]);

  const getPasswordStrength = (password: string) => {
    if (!password) {return { score: 0, text: '' };}

    const validation = validatePassword(password);
    if (validation.isValid) {
      return { score: 4, text: 'Fuerte', color: 'text-green-600' };
    }

    const passedChecks = 5 - validation.errors.length;
    if (passedChecks <= 1) {
      return { score: 1, text: 'Muy débil', color: 'text-red-600' };
    } else if (passedChecks <= 2) {
      return { score: 2, text: 'Débil', color: 'text-orange-600' };
    } else {
      return { score: 3, text: 'Regular', color: 'text-yellow-600' };
    }
  };

  const passwordStrength = getPasswordStrength(password);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError('Token de recuperación inválido');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al restablecer la contraseña');
      }

      setIsSuccess(true);
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Reset password error:', error);
        setError(error.message)
      } else {
        setError('Error al restablecer la contraseña');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Contraseña restablecida
          </CardTitle>
          <CardDescription className="text-center">
            Su contraseña ha sido restablecida exitosamente. Ahora puede iniciar sesión con su nueva contraseña.
          </CardDescription>
        </CardHeader>

        <CardFooter>
          <Button
            onClick={handleBackToLogin}
            className="w-full"
          >
            Iniciar sesión
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Restablecer contraseña
        </CardTitle>
        <CardDescription className="text-center">
          Ingrese su nueva contraseña
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
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingrese su nueva contraseña"
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

            {/* Password strength indicator */}
            {password && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Fortaleza:</span>
                  <span className={`text-xs font-medium ${passwordStrength.color}`}>
                    {passwordStrength.text}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      passwordStrength.score <= 1
                        ? 'bg-red-600'
                        : passwordStrength.score <= 2
                        ? 'bg-orange-600'
                        : passwordStrength.score <= 3
                        ? 'bg-yellow-600'
                        : 'bg-green-600'
                    }`}
                    style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirme su nueva contraseña"
                {...register('confirmPassword')}
                disabled={isLoading}
                className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>La contraseña debe contener:</p>
            <ul className="list-disc list-inside space-y-1">
              <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>Al menos una letra mayúscula</li>
              <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>Al menos una letra minúscula</li>
              <li className={/\d/.test(password) ? 'text-green-600' : ''}>Al menos un número</li>
              <li className={/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-green-600' : ''}>Al menos un carácter especial</li>
              <li className={password.length >= 8 ? 'text-green-600' : ''}>Mínimo 8 caracteres</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !token}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restableciendo...
              </>
            ) : (
              'Restablecer contraseña'
            )}
          </Button>

          <Button
            type="button"
            onClick={handleBackToLogin}
            variant="ghost"
            className="w-full"
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio de sesión
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}