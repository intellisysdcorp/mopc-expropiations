import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createPasswordResetToken, checkRateLimit } from '@/utils/auth-server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const forgotPasswordSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Rate limiting
    if (!checkRateLimit(email, 3, 15 * 60 * 1000)) { // 3 attempts per 15 minutes
      return NextResponse.json(
        { error: 'Demasiados intentos. Por favor, espere 15 minutos antes de intentar nuevamente.' },
        { status: 429 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        department: true,
        role: true,
      },
    });

    // Always return success to prevent email enumeration attacks
    if (!user || !user.isActive) {
      return NextResponse.json({
        message: 'Si el correo electrónico está registrado, recibirás instrucciones para restablecer tu contraseña.',
        success: true,
      });
    }

    // Generate reset token
    const resetToken = await createPasswordResetToken(email);

    // In a real implementation, you would send an email here
    // For now, we'll log the token (remove this in production)
    logger.info(`Password reset token for ${email}: ${resetToken}`);
    logger.info(`Reset link: ${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`);

    // TODO: Send email with reset link
    // Example using nodemailer or another email service:
    /*
    await sendEmail({
      to: email,
      subject: 'Restablecer contraseña - Plataforma MOPC',
      template: 'password-reset',
      data: {
        userName: `${user.firstName} ${user.lastName}`,
        resetLink: `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`,
        departmentName: user.department.name,
      },
    });
    */

    return NextResponse.json({
      message: 'Si el correo electrónico está registrado, recibirás instrucciones para restablecer tu contraseña.',
      success: true,
    });

  } catch (error) {
    logger.error('Forgot password error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}