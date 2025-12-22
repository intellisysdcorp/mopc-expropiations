# Setup Guide

Guía completa de instalación y configuración para la Plataforma de Expropiación MOPC.

## 📋 Requisitos del Sistema

- **Node.js**: 22.2 o superior
- **npm** o **yarn**
- **MySQL 8.0+** o **MariaDB 10.5+**
- **Git**

## 🗄️ Requisitos de Base de Datos

### Opción 1: MySQL 8.0+ (Recomendado)
- MySQL Server 8.0 o superior
- MySQL Command Line Client
- MySQL Workbench (opcional, para administración gráfica)

### Opción 2: MariaDB 10.5+
- MariaDB Server 10.5 o superior
- MySQL/MariaDB Command Line Client
- DBeaver o phpMyAdmin (opcional, para administración gráfica)

## 🔧 Instalación Detallada

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd expropriation-platform
```

### 2. Instalar Dependencias

```bash
# Usando npm
npm install

# O usando yarn
yarn install
```

### 3. Instalar y Configurar MySQL/MariaDB

#### Opción A: Instalar MySQL 8.0+

**macOS (usando Homebrew):**
```bash
# Instalar Homebrew si no lo tienes
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar MySQL
brew install mysql

# Iniciar MySQL
brew services start mysql

# Asegurar instalación
mysql_secure_installation
```

**Ubuntu/Debian:**
```bash
# Actualizar paquetes
sudo apt update

# Instalar MySQL
sudo apt install mysql-server

# Iniciar MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Asegurar instalación
sudo mysql_secure_installation
```

**Windows:**
1. Descargar MySQL Community Server desde [mysql.com](https://dev.mysql.com/downloads/mysql/)
2. Ejecutar el instalador
3. Configurar contraseña para root user
4. Instalar MySQL Workbench (opcional)

#### Opción B: Instalar MariaDB 10.5+

**macOS (usando Homebrew):**
```bash
# Instalar MariaDB
brew install mariadb

# Iniciar MariaDB
brew services start mariadb

# Asegurar instalación
mysql_secure_installation
```

**Ubuntu/Debian:**
```bash
# Actualizar paquetes
sudo apt update

# Instalar MariaDB
sudo apt install mariadb-server mariadb-client

# Iniciar MariaDB
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Asegurar instalación
sudo mysql_secure_installation
```

### 4. Crear Base de Datos y Usuario

Una vez que MySQL/MariaDB esté instalado y en ejecución, crea la base de datos y el usuario:

```sql
-- Conectar a MySQL/MariaDB como root
mysql -u root -p

-- Crear base de datos
CREATE DATABASE expropriation_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear usuario para la aplicación
CREATE USER 'expropriation_user'@'localhost' IDENTIFIED BY 'expropriation_password';

-- Dar permisos al usuario sobre la base de datos
GRANT ALL PRIVILEGES ON expropriation_platform.* TO 'expropriation_user'@'localhost';

-- Aplicar cambios y salir
FLUSH PRIVILEGES;
EXIT;
```

### 5. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Edita el archivo `.env` con las siguientes configuraciones:

#### Variables Obligatorias

```env
# Base de Datos (MySQL/MariaDB)
DATABASE_HOST="localhost"
DATABASE_PORT="3306"
DATABASE_USER="expropriation_user"
DATABASE_PASSWORD="expropriation_password"
DATABASE_NAME="expropriation_platform"
DATABASE_CONNECTION_LIMIT="5"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-min-32-chars"

# Aplicación
NODE_ENV="development"
APP_NAME="Plataforma de Expropiación"
APP_URL="http://localhost:3000"
```

#### Variables Opcionales

```env
# Upload de Archivos
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="10485760"  # 10MB en bytes

# Seguridad
BCRYPT_ROUNDS="12"
SESSION_MAX_AGE="86400"    # 24 horas en segundos

# Email (opcional, para notificaciones)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM_NAME="Sistema MOPC"
SMTP_FROM_EMAIL="noreply@mopc.gov.do"

# Monitoreo (opcional)
LOG_LEVEL="debug"
ENABLE_LOGGING="true"
ENABLE_DEBUG="true"
```

**Importante**: `NEXTAUTH_SECRET` debe ser una cadena de al menos 32 caracteres. Puedes generar una con:
```bash
openssl rand -base64 32
```

### 6. Configurar Base de Datos

```bash
# Generar cliente Prisma
npm run db:generate

# Sincronizar esquema con la base de datos
npm run db:push

# Poblar base de datos con datos iniciales
npm run db:seed
```

### 7. Verificar Instalación

```bash
# Iniciar servidor de desarrollo
npm run dev
```

La aplicación debería estar disponible en [http://localhost:3000](http://localhost:3000).

## 🔍 Verificación Post-Instalación

### 1. Verificar Base de Datos

```bash
# Abrir Prisma Studio para visualizar datos
npm run db:studio
```

Deberías ver las siguientes tablas con datos iniciales:
- `Department` (al menos 1 departamento)
- `Role` (6 roles predefinidos)
- `User` (usuario admin por defecto)

### 2. Usuarios por Defecto

| Email | Password | Rol |
|-------|----------|-----|
| admin@mopc.gob.do | admin123 | Super Admin |
| dept.admin@mopc.gob.do | admin123 | Department Admin |
| analyst@mopc.gob.do | admin123 | Analyst |

### 3. Verificar Archivos Creados

Asegúrate de que existen estos archivos y directorios:
- `uploads/` (directorio para archivos)
- `.next/` (directorio de build de Next.js)
- Las tablas deben estar creadas en tu base de datos MySQL/MariaDB

### 4. Test de Autenticación

1. Visita `http://localhost:3000/auth/signin`
2. Inicia sesión con las credenciales del usuario seed
3. Verifica que puedas acceder al dashboard

### 5. Verificar Conexión a Base de Datos

```bash
# Conectar directamente a MySQL/MariaDB para verificar
mysql -u expropriation_user -p expropriation_platform

# Listar tablas
SHOW TABLES;

# Verificar usuarios creados
SELECT email, firstName, lastName FROM users LIMIT 5;

EXIT;
```

## 🛠️ Comandos de Base de Datos

```bash
# Generar cliente Prisma
npm run db:generate

# Sincronizar esquema (sin migraciones)
npm run db:push

# Crear y ejecutar migraciones
npm run db:migrate

# Resetear base de datos (¡cuidado en producción!)
npm run db:reset

# Ver datos en interfaz gráfica
npm run db:studio

# Sembrar datos iniciales
npm run db:seed
```

## 🔧 Solución de Problemas

### Problemas Comunes

#### 1. Error: "Database connection failed"
```bash
# Verificar variables de base de datos en .env
cat .env | grep DATABASE_

# Verificar que MySQL/MariaDB está corriendo
brew services list | grep mysql  # macOS
sudo systemctl status mysql      # Linux
Get-Service mysql                 # Windows

# Verificar conexión a base de datos
mysql -u expropriation_user -p expropriation_platform

# Si todo falla, recrear base de datos
mysql -u root -p
DROP DATABASE IF EXISTS expropriation_platform;
CREATE DATABASE expropriation_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
npm run db:push
npm run db:seed
```

#### 2. Error: "Access denied for user"
```bash
# Verificar credenciales y recrear usuario
mysql -u root -p

DROP USER IF EXISTS 'expropriation_user'@'localhost';
CREATE USER 'expropriation_user'@'localhost' IDENTIFIED BY 'expropriation_password';
GRANT ALL PRIVILEGES ON expropriation_platform.* TO 'expropriation_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 3. Error: "NEXTAUTH_SECRET is required"
```bash
# Generar nuevo secreto
openssl rand -base64 32

# Agregar a .env
echo "NEXTAUTH_SECRET=tu-nuevo-secreto" >> .env
```

#### 4. Error: "Module not found" después de instalar
```bash
# Limpiar caché de npm
npm cache clean --force

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

#### 5. Error de permisos en uploads
```bash
# Asegurar permisos correctos
chmod 755 uploads/
chmod 644 uploads/*  # si hay archivos
```

#### 6. Puerto 3000 en uso
```bash
# Ver qué proceso usa el puerto
lsof -ti:3000

# Matar proceso
kill -9 $(lsof -ti:3000)

# O usar otro puerto
npm run dev -- -p 3001
```

### Verificación de Dependencias

```bash
# Verificar versión de Node
node --version  # debe ser >= 18.0

# Verificar versión de npm
npm --version

# Verificar instalación de Prisma
npx prisma --version

# Verificar instalación de Next.js
npx next --version
```

## 🌐 Configuración de Entorno

### Desarrollo
```env
NODE_ENV="development"
NEXTAUTH_URL="http://localhost:3000"
DATABASE_HOST="localhost"
DATABASE_PORT="3306"
DATABASE_USER="expropriation_user"
DATABASE_PASSWORD="expropriation_password"
DATABASE_NAME="expropriation_platform"
DATABASE_CONNECTION_LIMIT="5"
```

### Producción
```env
NODE_ENV="production"
NEXTAUTH_URL="https://tu-dominio.com"
DATABASE_HOST="tu-db-host.com"
DATABASE_PORT="3306"
DATABASE_USER="tu_usuario"
DATABASE_PASSWORD="tu_password_seguro"
DATABASE_NAME="expropriation_platform"
DATABASE_CONNECTION_LIMIT="10"
```

### Docker
Si usas Docker, ajusta las variables:
```env
DATABASE_HOST="database"  # nombre del servicio Docker
DATABASE_PORT="3306"
DATABASE_USER="expropriation_user"
DATABASE_PASSWORD="expropriation_password"
DATABASE_NAME="expropriation_platform"
NEXTAUTH_URL="http://localhost:3000"
```

## 📝 Notas Adicionales

- **MySQL/MariaDB**: La base de datos es un servidor separado. Asegúrate de hacer backups regulares usando `mysqldump` o herramientas de administración.
- **Conexión Pool**: El valor `DATABASE_CONNECTION_LIMIT` controla cuántas conexiones simultáneas a la base de datos puede mantener la aplicación.
- **UTF-8**: La base de datos está configurada con `utf8mb4` para soportar caracteres Unicode completos (incluyendo emojis).
- **Archivos**: Los archivos subidos se guardan en `uploads/`. Este directorio debe estar en tu backup.
- **Sesiones**: Las sesiones expiran después de 24 horas por defecto.
- **Email**: La configuración de email es opcional pero recomendada para notificaciones.

## 🆘 Ayuda Adicional

Si encuentras problemas no cubiertos en esta guía:

1. Revisa los [logs del servidor](../logs/)
2. Consulta la [documentación de desarrollo](./DEVELOPMENT.md)
3. Crea un issue en el repositorio del proyecto

---

**Siguiente paso**: Una vez configurado, consulta la [Guía de Desarrollo](./DEVELOPMENT.md) para empezar a trabajar con el proyecto.