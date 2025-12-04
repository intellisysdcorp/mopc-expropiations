# Sistema de Autenticación - Plataforma MOPC

Este documento describe el sistema de autenticación completo implementado para la Plataforma de Gestión de Casos de Expropiación del Ministerio de Obras Públicas y Comunicaciones (MOPC).

## 🚀 Características Implementadas

### 1. Autenticación con NextAuth.js
- **Provider**: Credentials (email/contraseña)
- **Adapter**: Prisma para persistencia de sesiones
- **Session Strategy**: JWT con almacenamiento en base de datos
- **Session Duration**: 24 horas con refresh cada hora

### 2. Gestión de Contraseñas
- **Hashing**: bcryptjs con 12 rounds de salt
- **Validación**: Requisitos de seguridad robustos
- **Recuperación**: Flujo completo de recuperación por email
- **Restablecimiento**: Formulario seguro con token expirable

### 3. Protección de Rutas
- **Middleware**: Protección a nivel de servidor
- **Componente ProtectedRoute**: Protección a nivel de componente
- **RBAC**: Control de acceso basado en roles y permisos
- **Redirecciones**: Manejo inteligente de redirecciones

### 4. Validación y Seguridad
- **Rate Limiting**: Prevención de ataques de fuerza bruta
- **Validación de Formularios**: Zod + React Hook Form
- **CSRF Protection**: Integrado con NextAuth.js
- **Secure Cookies**: Configuración para producción

## 📁 Estructura de Archivos

```
src/
├── app/
│   ├── api/auth/[...nextauth]/route.ts     # API de NextAuth.js
│   ├── api/auth/forgot-password/route.ts   # API de recuperación
│   ├── api/auth/reset-password/route.ts    # API de restablecimiento
│   ├── login/page.tsx                      # Página de login
│   ├── forgot-password/page.tsx             # Página de recuperación
│   ├── reset-password/page.tsx              # Página de restablecimiento
│   ├── dashboard/page.tsx                   # Dashboard protegido
│   └── layout.tsx                          # Provider de sesión
├── components/
│   ├── auth/
│   │   ├── login-form.tsx                  # Formulario de login
│   │   ├── forgot-password-form.tsx         # Formulario de recuperación
│   │   ├── reset-password-form.tsx          # Formulario de restablecimiento
│   │   └── protected-route.tsx             # Componente de protección
│   └── ui/                                 # Componentes UI básicos
├── hooks/
│   └── use-auth.ts                         # Hook personalizado de autenticación
├── lib/
│   ├── auth.ts                             # Configuración de NextAuth.js
│   └── auth-utils.ts                       # Utilidades de autenticación
├── middleware.ts                           # Middleware de protección
└── types/
    └── next-auth.d.ts                      # Tipos de NextAuth.js extendidos
```

## 🔐 Configuración

### Variables de Entorno

```env
# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="+8xdNjOeWEkO8HTSwtphWzJj5KAS6Y1QN4BKkXkTnak="

# Base de datos
DATABASE_URL="file:./dev.db"
```

### Configuración de NextAuth.js

```typescript
// src/lib/auth.ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      // Configuración del provider de credenciales
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 horas
  },
  callbacks: {
    // Callbacks personalizados para JWT y sesión
  },
  pages: {
    signIn: '/login',
    error: '/login?error=true',
  },
};
```

## 👥 Usuarios de Prueba

La base de datos viene pre-seedada con los siguientes usuarios:

| Email | Rol | Contraseña | Departamento |
|-------|-----|------------|---------------|
| admin@mopc.gob.do | Super Admin | admin123 | MOPC |
| dept.admin@mopc.gob.do | Department Admin | admin123 | Departamento Jurídico |
| analyst@mopc.gob.do | Analyst | admin123 | Departamento Jurídico |

## 🔑 Roles y Permisos

### Jerarquía de Roles
1. **Super Admin**: Acceso completo al sistema
2. **Department Admin**: Gestión de departamento y usuarios
3. **Analyst**: Gestión de casos asignados
4. **Supervisor**: Revisión y aprobación
5. **Observer**: Solo lectura
6. **Technical Meeting Coordinator**: Coordinación de reuniones

### Permisos Disponibles
- `canCreate`: Crear nuevos registros
- `canRead`: Ver información
- `canUpdate`: Modificar registros
- `canDelete`: Eliminar registros
- `canAssign`: Asignar casos
- `canSupervise`: Supervisar casos
- `canExport`: Exportar datos
- `canManageUsers`: Administrar usuarios

## 🛡️ Middleware de Protección

El middleware implementa las siguientes reglas:

```typescript
// src/middleware.ts
export default withAuth(function middleware(req) {
  const token = req.nextauth.token;
  const { pathname } = req.nextUrl;

  // Protección de rutas por rol
  if (pathname.startsWith('/admin') && userRole !== 'super_admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Permitir acceso solo a páginas permitidas para observers
  if (userRole === 'observer') {
    const allowedPatterns = ['/dashboard', '/cases', '/reports', '/profile'];
    // Validación de acceso...
  }
});
```

## 🔧 Componentes de Autenticación

### useAuth Hook

Hook personalizado para manejo de autenticación:

```typescript
const {
  // Estado
  isAuthenticated,
  isLoading,
  user,

  // Permisos
  hasPermission,
  hasRole,
  isSuperAdmin,
  canCreateCases,

  // Acciones
  signOut,
  redirectToLogin,
} = useAuth();
```

### ProtectedRoute Component

Componente para proteger rutas a nivel de componente:

```typescript
<ProtectedRoute roles="super_admin">
  <AdminOnlyContent />
</ProtectedRoute>

<ProtectedRoute permissions="canManageUsers">
  <UserManagement />
</ProtectedRoute>
```

## 🔄 Flujo de Autenticación

### 1. Login
1. Usuario ingresa email y contraseña
2. Validación con Zod en el cliente
3. Envío a API de NextAuth.js
4. Verificación en base de datos con bcrypt
5. Creación de sesión JWT
6. Redirección a dashboard

### 2. Recuperación de Contraseña
1. Usuario ingresa email
2. Verificación de existencia de usuario
3. Generación de token único (1 hora de validez)
4. Envío de email con enlace de recuperación
5. Usuario hace clic en enlace
6. Validación de token
7. Restablecimiento de contraseña

### 3. Protección de Rutas
1. Middleware intercepta request
2. Verificación de token de sesión
3. Validación de permisos según ruta
4. Redirección si no autorizado

## 🚨 Características de Seguridad

### Rate Limiting
- Login: 5 intentos por 15 minutos
- Recuperación: 3 intentos por 15 minutos

### Validación de Contraseñas
- Mínimo 8 caracteres
- Al menos una mayúscula
- Al menos una minúscula
- Al menos un número
- Al menos un carácter especial

### Protección CSRF
- Integrado con NextAuth.js
- Tokens de sesión seguros

### Secure Cookies
- httpOnly: true
- secure: true (producción)
- sameSite: strict

## 🧪 Testing

### Para probar el sistema:

1. **Iniciar servidor**:
   ```bash
   npm run dev
   ```

2. **Acceder a login**:
   ```
   http://localhost:3000/login
   ```

3. **Probar diferentes roles**:
   - Super Admin: admin@mopc.gob.do / admin123
   - Department Admin: dept.admin@mopc.gob.do / admin123
   - Analyst: analyst@mopc.gob.do / admin123

4. **Probar recuperación de contraseña**:
   ```
   http://localhost:3000/forgot-password
   ```

## 🔄 Flujo de Trabajo Futuro

### Mejoras Planeadas
1. **Email Service**: Integración con servicio de email real
2. **2FA**: Autenticación de dos factores
3. **OAuth**: Integración con Google/Microsoft
4. **Audit Trail**: Logging detallado de acciones
5. **Session Management**: Verificación de sesiones activas

### Integración con Sistema de Casos
1. **Asignación automática** basada en departamento y rol
2. **Notificaciones** de cambios en casos asignados
3. **Permisos granulares** por tipo de caso
4. **Workflows** basados en roles

## 📝 Notas Importantes

- **Tokens de recuperación** se almacenan en la base de datos con expiración
- **Sesiones inactivas** se eliminan automáticamente
- **Rate limiting** se implementa en memoria (considerar Redis para producción)
- **Email templates** deben configurarse para el proveedor de email seleccionado
- **Environment variables** deben ser actualizadas para producción

## 🐛 Troubleshooting

### Problemas Comunes

1. **Error "Token inválido o expirado"**:
   - Verificar NEXTAUTH_SECRET
   - Confirmar URL correcta en NEXTAUTH_URL

2. **Redirecciones infinitas**:
   - Verificar configuración de middleware
   - Confirmar que las páginas no estén en ambas listas (protegidas y públicas)

3. **Error de autenticación**:
   - Verificar que la base de datos esté seeded
   - Confirmar configuración de Prisma

4. **Email de recuperación no llega**:
   - Revisar configuración de servicio de email
   - Verificar logs del servidor para el token generado

## 📞 Soporte

Para problemas técnicos o preguntas sobre el sistema de autenticación, contactar al equipo de desarrollo del MOPC.