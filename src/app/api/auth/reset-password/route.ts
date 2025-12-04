import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resetPassword, verifyPasswordResetToken } from '@/utils/auth-server';
import { logger } from '@/lib/logger';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token es requerido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .refine((password) => /[A-Z]/.test(password), 'Debe contener una letra mayúscula')
    .refine((password) => /[a-z]/.test(password), 'Debe contener una letra minúscula')
    .refine((password) => /\d/.test(password), 'Debe contener un número')
    .refine((password) => /[!@#$%^&*(),.?":{}|<>]/.test(password), 'Debe contener un carácter especial'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    // Verify token before proceeding
    const isTokenValid = await verifyPasswordResetToken(token);
    if (!isTokenValid) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 400 }
      );
    }

    // Reset password
    await resetPassword(token, password);

    return NextResponse.json({
      message: 'Contraseña restablecida exitosamente',
      success: true,
    });

  } catch (error) {
    logger.error('Reset password error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    // Handle specific auth errors
    if (error instanceof Error && error.message.includes('Token')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al restablecer la contraseña' },
      { status: 500 }
    );
  }
}