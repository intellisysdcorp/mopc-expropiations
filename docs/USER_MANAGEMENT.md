# Sistema de Gestión de Usuarios

## Overview

El sistema de gestión de usuarios es una solución integral para la administración de cuentas de usuario, roles, permisos y departamentos en la plataforma de expropiación del MOPC. Esta documentación describe todas las funcionalidades, arquitectura y uso del sistema.

## Características Principales

### 1. Gestión de Usuarios Completa
- **CRUD Completo**: Crear, leer, actualizar y eliminar usuarios
- **Validación Avanzada**: Verificación de email, username y fortaleza de contraseña
- **Gestión de Estados**: Activación, suspensión y eliminación suave
- **Seguridad**: Bloqueo de cuentas, historial de contraseñas y 2FA

### 2. Sistema de Roles y Permisos
- **Roles Flexibles**: Creación de roles con permisos personalizados
- **Matriz de Permisos**: Interfaz visual para gestión de permisos
- **Categorías de Permisos**: Organizados por área funcional
- **Herencia de Permisos**: Soporte para roles base y extensiones

### 3. Gestión de Departamentos
- **Estructura Jerárquica**: Departamentos con relaciones padre-hijo
- **Asignación Múltiple**: Usuarios pueden pertenecer a múltiples departamentos
- **Departamento Principal**: Asignación principal con permisos base
- **Permisos Extendidos**: Acceso a departamentos hijos automáticamente

### 4. Session Management
- **Seguimiento de Sesiones**: Monitoreo de sesiones activas
- **Control de Acceso**: Terminación remota de sesiones
- **Información de Dispositivo**: Registro de IP, user agent y metadata
- **Límites de Sesión**: Configuración de sesiones concurrentes

### 5. Historial de Actividad
- **Logging Completo**: Registro de todas las acciones del usuario
- **Búsqueda y Filtrado**: Búsqueda avanzada de actividades
- **Estadísticas**: Análisis de patrones de uso
- **Exportación**: Exportación de datos de actividad

### 6. Gestión de Contraseñas
- **Políticas de Seguridad**: Requisitos mínimos de contraseña
- **Historial de Contraseñas**: Prevención de reutilización
- **Reset Administrativo**: Reset de contraseña por administradores
- **Forzar Cambio**: Obligar cambio de contraseña en próximo login

## Arquitectura del Sistema

### Base de Datos

#### User Model
```prisma
model User {
  // Campos básicos
  id                   String    @id @default(cuid())
  email                String    @unique
  username             String    @unique
  passwordHash         String
  firstName            String
  lastName             String
  phone                String?
  avatar               String?
  isActive             Boolean   @default(true)

  // Estado y suspensión
  isSuspended          Boolean   @default(false)
  suspensionReason     String?
  suspendedAt          DateTime?
  suspendedBy          String?

  // Login tracking
  lastLoginAt          DateTime?
  lastLoginIp          String?
  lastLoginUserAgent   String?
  loginCount           Int       @default(0)
  failedLoginAttempts  Int       @default(0)
  lockedUntil          DateTime?

  // Password management
  passwordResetToken   String?
  passwordResetExpires DateTime?
  passwordChangedAt    DateTime  @default(now())
  mustChangePassword   Boolean   @default(false)

  // Profile information
  jobTitle             String?
  bio                  String?
  officeLocation       String?
  workingHours         String?
  preferredLanguage    String    @default("es")
  timezone             String    @default("America/Santo_Domingo")

  // Security settings
  twoFactorEnabled     Boolean   @default(false)
  twoFactorSecret      String?
  backupCodes          String?

  // Email preferences
  emailNotifications   Boolean   @default(true)
  emailMarketing       Boolean   @default(false)
  emailDigest          Boolean   @default(true)

  // System settings
  theme                String    @default("light")
  dateRange            String?
  dashboardConfig      String?

  // Soft delete
  deletedAt            DateTime?
  deletedBy            String?

  // Timestamps
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  // Relaciones
  departmentId String
  department   Department @relation(fields: [departmentId], references: [id])
  roleId       String
  role         Role       @relation(fields: [roleId], references: [id])
  // ... otras relaciones
}
```

#### Modelos Relacionados
- **PasswordHistory**: Historial de cambios de contraseña
- **UserSession**: Control de sesiones activas
- **UserDepartmentAssignment**: Asignaciones múltiples de departamentos
- **Activity**: Logging de actividades del usuario

### API Endpoints

#### Users Management
```
GET    /api/users                    # Listar usuarios con filtros y paginación
POST   /api/users                    # Crear nuevo usuario
GET    /api/users/[id]               # Obtener detalles de usuario
PUT    /api/users/[id]               # Actualizar usuario
DELETE /api/users/[id]               # Eliminar usuario (soft delete)

POST   /api/users/bulk               # Operaciones masivas
GET    /api/users/export             # Exportar usuarios (CSV, JSON, Excel)
```

#### Password Management
```
PUT    /api/users/[id]/password      # Cambiar/resetear contraseña
```

#### Session Management
```
GET    /api/users/[id]/sessions      # Listar sesiones del usuario
DELETE /api/users/[id]/sessions      # Terminar sesiones
```

#### Activity History
```
GET    /api/users/[id]/activity      # Historial de actividad
```

#### Department Assignments
```
GET    /api/users/[id]/departments   # Listar asignaciones de departamento
POST   /api/users/[id]/departments   # Asignar departamento
DELETE /api/users/[id]/departments/[assignmentId]  # Remover asignación
PUT    /api/users/[id]/departments/[assignmentId]/primary  # Cambiar principal
```

### Componentes Frontend

#### User Management Page (`/users`)
- **DataTable**: Componente reutilizable con búsqueda, filtros y paginación
- **UserForm**: Formulario completo con validación en tiempo real
- **UserActivityHistory**: Historial detallado de actividades
- **UserSessions**: Gestión de sesiones activas
- **UserPasswordManagement**: Herramientas de gestión de contraseñas
- **RolePermissionMatrix**: Interfaz visual para roles y permisos
- **DepartmentAssignment**: Asignación jerárquica de departamentos

## Guía de Uso

### 1. Creación de Usuarios

1. Navegar a `/users`
2. Hacer clic en "Nuevo Usuario"
3. Completar la información en las pestañas:
   - **Información Básica**: Nombre, email, username, contraseña
   - **Información Laboral**: Cargo, oficina, biografía
   - **Seguridad**: 2FA, forzar cambio de contraseña
   - **Preferencias**: Idioma, tema, notificaciones
4. Asignar departamento y rol
5. Hacer clic en "Crear Usuario"

### 2. Gestión de Roles y Permisos

1. En la página de usuarios, hacer clic en "Gestionar Roles"
2. **Matriz de Permisos**: Vista visual para editar permisos
3. **Lista de Roles**: Gestión básica de roles
4. **Comparación**: Comparar permisos entre roles

### 3. Asignación de Departamentos

1. Seleccionar un usuario
2. Ir a la sección de asignaciones
3. **Departamento Principal**: Asignación base del usuario
4. **Asignaciones Adicionales**: Acceso extendido a otros departamentos

### 4. Gestión de Sesiones

1. Ver sesiones activas del usuario
2. **Terminar Sesión**: Cerrar sesión específica
3. **Terminar Todas**: Cerrar todas las sesiones excepto la actual
4. **Información de Dispositivo**: Ver detalles de conexión

### 5. Monitoreo de Actividad

1. Acceder al historial de actividad
2. **Filtros**: Por tipo, entidad, rango de fechas
3. **Estadísticas**: Análisis de patrones de uso
4. **Exportación**: Descargar datos de actividad

## Políticas de Seguridad

### Contraseñas
- Mínimo 8 caracteres
- Al menos una letra mayúscula
- Al menos una letra minúscula
- Al menos un número
- Al menos un carácter especial (@$!%*?&)
- Historial de últimas 5 contraseñas
- Expiración configurable

### Sesiones
- Tiempo de expiración: 24 horas por defecto
- Límite de sesiones concurrentes: configurable
- Tracking de IP y user agent
- Cierre de sesión remoto

### Bloqueo de Cuentas
- 5 intentos fallidos consecutivos
- Bloqueo temporal de 30 minutos
- Logging de intentos fallidos
- Reset por administrador

### Auditoría
- Logging completo de todas las acciones
- Metadata detallada (IP, user agent, timestamp)
- Exportación de logs
- Análisis de patrones sospechosos

## Configuración

### Variables de Entorno
```env
# Database
DATABASE_URL="file:./dev.db"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Security
SESSION_TIMEOUT=86400  # 24 hours
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION=1800  # 30 minutes

# Email (para notificaciones)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

### Configuración de Roles

#### Super Admin
- Todos los permisos
- Gestión del sistema
- Acceso ilimitado

#### Department Admin
- Gestión de usuarios del departamento
- Configuración de departamentos hijos
- Reportes del departamento

#### Analyst
- Gestión de casos asignados
- Acceso a documentos
- Creación de reportes

#### Supervisor
- Revisión y aprobación
- Asignación de casos
- Supervisión de equipos

#### Observer
- Acceso de solo lectura
- Visualización de reportes
- Sin permisos de modificación

#### Technical Meeting Coordinator
- Gestión de reuniones técnicas
- Coordinación de participantes
- Generación de actas

## Mejores Prácticas

### Para Administradores
1. **Revisión Regular**: Revisar accesos y permisos mensualmente
2. **Principio de Menor Privilegio**: Asignar solo permisos necesarios
3. **Monitoreo**: Revisar logs de actividades sospechosas
4. **Capacitación**: Mantener usuarios entrenados en seguridad

### Para Usuarios
1. **Contraseñas Fuertes**: Usar contraseñas únicas y complejas
2. **Seguridad de Sesión**: Cerrar sesión en dispositivos compartidos
3. **Reporte de Incidentes**: Reportar actividades sospechosas
4. **Actualización**: Mantener información de contacto actualizada

## Troubleshooting

### Problemas Comunes

#### Usuario no puede iniciar sesión
1. Verificar que la cuenta esté activa
2. Revisar si está suspendida o bloqueada
3. Chequear contraseña correcta
4. Considerar reset de contraseña

#### Permisos no funcionan
1. Verificar asignación de rol correcta
2. Revisar permisos del rol
3. Chequear asignaciones de departamento
4. Limpiar caché del navegador

#### Problemas con sesiones
1. Verificar configuración de tiempo de expiración
2. Revisar configuración de cookies
3. Chequear configuración del servidor
4. Limpiar cookies del navegador

### Soporte Técnico
- **Logs**: Revisar logs del servidor y del cliente
- **Base de Datos**: Verificar integridad de datos
- **Red**: Chequear conectividad y firewall
- **Performance**: Monitorear rendimiento del sistema

## Desarrollo y Extensión

### Agregar Nuevos Permisos
1. Agregar permiso al schema de Prisma
2. Actualizar matriz de permisos
3. Actualizar validaciones del frontend
4. Documentar nuevo permiso

### Personalizar Formularios
1. Modificar componentes del formulario
2. Actualizar validaciones Zod
3. Agregar nuevos campos al schema
4. Actualizar API endpoints

### Integración Externa
1. Crear servicios de integración
2. Configurar webhooks
3. Implementar manejo de errores
4. Documentar integración

## Conclusiones

El sistema de gestión de usuarios proporciona una solución robusta y completa para la administración de identidades en la plataforma de expropiación. Con características avanzadas de seguridad, auditoría completa y una interfaz intuitiva, el sistema asegura que los usuarios tengan el acceso adecuado a los recursos necesarios mientras se mantiene la seguridad y el cumplimiento normativo.

La arquitectura modular permite fácil extensión y personalización, mientras que las herramientas de monitoreo y reporting proporcionan visibilidad completa sobre las actividades del sistema.