import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logUserLogin, logFailedLogin } from '@/lib/activity-logger';
import { loggers } from '@/lib/logger';
import { randomBytes } from 'crypto';
import { getServerSession as nextAuthGetServerSession } from 'next-auth/next';

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  loggers.security.configurationIssue('NEXTAUTH_SECRET not set during auth initialization', {
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
  throw new Error('NEXTAUTH_SECRET is not set in environment variables');
}

const credentialsSchema = z.object({
  email: z.email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Correo electrónico', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Validate credentials with Zod
        const validatedCredentials = credentialsSchema.safeParse(credentials);
        if (!validatedCredentials.success) {
          return null;
        }

        const { email, password } = validatedCredentials.data;
        const ipAddress = req.headers?.['x-forwarded-for'] as string || req.headers?.['x-real-ip'] as string || 'unknown';
        const userAgent = req.headers?.['user-agent'];

        // Find user with all necessary relations
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            department: true,
            role: true,
          },
        });

        if (!user) {
          // Log failed login for non-existent user
          await logFailedLogin(email, ipAddress, userAgent);
          loggers.security.loginAttempt(email, ipAddress, false);
          return null;
        }

        // Check if user is active and not suspended
        if (!user.isActive || user.isSuspended) {
          await logFailedLogin(email, ipAddress, userAgent);
          loggers.security.loginAttempt(email, ipAddress, false, user.id);
          loggers.security.suspiciousActivity('login_attempt_on_inactive_account', {
            email,
            userId: user.id,
            isActive: user.isActive,
            isSuspended: user.isSuspended,
            ipAddress,
            userAgent,
            timestamp: new Date().toISOString(),
          });
          return null;
        }

        // Check if account is locked due to failed attempts
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          // Log attempt on locked account
          await logFailedLogin(email, ipAddress, userAgent);
          loggers.security.suspiciousActivity('login_attempt_on_locked_account', {
            email,
            userId: user.id,
            ipAddress,
            userAgent,
            lockedUntil: user.lockedUntil.toISOString(),
            timestamp: new Date().toISOString(),
          });
          return null;
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          // Update failed login attempts with exponential backoff
          const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
          const shouldLockAccount = newFailedAttempts >= 5;
          const lockoutDuration = shouldLockAccount ? Math.pow(2, Math.min(newFailedAttempts - 4, 6)) * 60 * 1000 : 0; // Max 64 minutes

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: newFailedAttempts,
              lockedUntil: shouldLockAccount ? new Date(Date.now() + lockoutDuration) : null
            }
          });

          // Log failed login with security context
          await logFailedLogin(email, ipAddress, userAgent);
          loggers.security.loginAttempt(email, ipAddress, false, user.id);

          if (shouldLockAccount) {
            loggers.security.suspiciousActivity('account_locked_due_to_failed_attempts', {
              email,
              userId: user.id,
              ipAddress,
              userAgent,
              failedAttempts: newFailedAttempts,
              lockoutDurationMinutes: Math.round(lockoutDuration / 60000),
              lockedUntil: new Date(Date.now() + lockoutDuration).toISOString(),
              timestamp: new Date().toISOString(),
            });
          }

          return null;
        }

        // Check if user must change password
        if (user.mustChangePassword) {
          // Return user but with a flag to force password change
          const userData: any = {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            role: user.role.name,
            department: user.department.name,
            departmentId: user.departmentId,
            roleId: user.roleId,
            permissions: user.role.permissions as Record<string, boolean>,
            isActive: user.isActive,
            mustChangePassword: true,
          };

          // Only include optional properties if they have values
          if (user.phone) {
            userData.phone = user.phone;
          }
          if (user.avatar) {
            userData.avatar = user.avatar;
          }

          return userData;
        }

        // Reset failed login attempts on successful login and update user info
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            lastLoginIp: ipAddress,
            lastLoginUserAgent: userAgent,
            loginCount: { increment: 1 }
          }
        });

        await logUserLogin(user.id, ipAddress, userAgent);

        // Log successful login with security context
        loggers.security.loginAttempt(email, ipAddress, true, user.id);

        // Create user session record with cryptographically secure token
        const sessionToken = randomBytes(32).toString('hex');
        await prisma.userSession.create({
          data: {
            userId: user.id,
            sessionToken,
            ipAddress,
            userAgent,
            deviceInfo: JSON.stringify({
              ip: ipAddress,
              userAgent,
              timestamp: new Date().toISOString(),
            }),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });

        // Return user data in the format expected by NextAuth
        const userData: any = {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          role: user.role.name,
          department: user.department.name,
          departmentId: user.departmentId,
          roleId: user.roleId,
          permissions: user.role.permissions as Record<string, boolean>,
          isActive: user.isActive,
          sessionToken,
        };

        // Only include optional properties if they have values
        if (user.phone) {
          userData.phone = user.phone;
        }
        if (user.avatar) {
          userData.avatar = user.avatar;
        }

        return userData;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Update session every hour
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Update token when user signs in
      if (user) {
        token.id = user.id;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.username = user.username;
        token.role = user.role;
        token.department = user.department;
        token.departmentId = user.departmentId;
        token.roleId = user.roleId;
        token.permissions = user.permissions;
        token.isActive = user.isActive;

        // Only assign optional properties if they have values
        if (user.phone) {
          token.phone = user.phone;
        }
        if (user.avatar) {
          token.avatar = user.avatar;
        }
        if (user.mustChangePassword !== undefined) {
          token.mustChangePassword = user.mustChangePassword;
        }
        if (user.sessionToken) {
          token.sessionToken = user.sessionToken;
        }
      }

      // Handle session updates (e.g., when role changes)
      if (trigger === 'update' && session) {
        token = { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.department = token.department as string;
        session.user.departmentId = token.departmentId as string;
        session.user.roleId = token.roleId as string;
        session.user.permissions = token.permissions as Record<string, boolean>;
        session.user.isActive = token.isActive as boolean;
        session.user.phone = token.phone as string;
        session.user.avatar = token.avatar as string;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
        session.user.sessionToken = token.sessionToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login?error=true',
    signOut: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',
};

// Helper functions for server-side auth
export async function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}

export const auth = getServerSession;
export const getSession = getServerSession;