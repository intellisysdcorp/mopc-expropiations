# Plataforma de Expropiación MOPC

Plataforma digital integral para la gestión y seguimiento de casos de expropiación en la República Dominicana, desarrollada con tecnologías modernas para garantizar eficiencia, seguridad y trazabilidad.

## 🚀 Características Principales

- **Gestión de Casos**: Seguimiento completo del ciclo de vida con sistema de 17 etapas definidas
- **Usuarios y Roles**: Sistema de autenticación seguro con 6 roles basados en permisos
- **Documentos**: Gestión con control de versiones y búsqueda avanzada
- **Reportes**: Dashboard en tiempo real con exportación a múltiples formatos

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 15 con App Router y TypeScript
- **Estilos**: Tailwind CSS con shadcn/ui
- **Base de Datos**: MySQL con Prisma ORM
- **Autenticación**: NextAuth.js con adaptador Prisma
- **Validación**: Zod y React Hook Form

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [**Setup Guide**](./expropriation-platform/docs/SETUP.md) | Instalación detallada y configuración del entorno |
| [**Database Schema**](./expropriation-platform/docs/DATABASE.md) | Modelos de datos, relaciones y migraciones |
| [**Development Guide**](./expropriation-platform/docs/DEVELOPMENT.md) | Flujo de desarrollo, pruebas y contribución |
| [**Deployment Guide**](./expropriation-platform/docs/DEPLOYMENT.md) | Despliegue en producción y configuración |
| [**Workflow Documentation**](./expropriation-platform/docs/WORKFLOW.md) | Procesos de negocio y flujos de casos |

## 🚀 Quick Start

1. **Clonar e instalar**
   ```bash
   git clone <repository-url>
   cd expropriation-platform
   npm install
   ```

2. **Configurar entorno**
   ```bash
   cp .env.example .env.local
   # Editar .env.local con tus configuraciones
   ```

3. **Iniciar base de datos**
   ```bash
   npm run db:push
   npm run db:seed
   ```

4. **Iniciar desarrollo**
   ```bash
   npm run dev
   ```

   Visita [http://localhost:3000](http://localhost:3000)

## 📁 Estructura del Proyecto

```
expropriation-platform/
├── prisma/          # Esquema y migraciones de la base de datos
├── src/
│   ├── app/         # App Router de Next.js
│   ├── components/  # Componentes React
│   ├── lib/         # Utilidades y configuraciones
│   └── types/       # Definiciones de TypeScript
├── public/          # Archivos estáticos
├── uploads/         # Archivos subidos
└── docs/            # Documentación adicional
```

## 🔐 Roles del Sistema

- **Super Admin**: Acceso completo al sistema
- **Department Admin**: Gestión de usuarios y casos departamentales
- **Analyst**: Gestión de casos asignados
- **Supervisor**: Supervisión y aprobación de casos
- **Observer**: Acceso de solo lectura
- **Technical Meeting Coordinator**: Gestión de reuniones técnicas

## 📊 Etapas del Flujo de Casos

El sistema gestiona 17 etapas desde la revisión inicial hasta el cierre del caso, incluyendo verificación legal, evaluación técnica, avalúo, negociación y ejecución.

[Ver documentación completa del flujo →](./expropriation-platform/docs/WORKFLOW.md)

## 🧪 Scripts Esenciales

```bash
npm run dev              # Servidor de desarrollo
npm run build           # Compilar para producción
npm run db:studio       # Abrir Prisma Studio
npm run test            # Ejecutar tests
npm run lint            # Verificar código
```

## 📞 Soporte

- **Email**: support@mopc.gob.do
- **Issues**: [GitHub Issues](https://github.com/mopc/expropriation-platform/issues)
- **Documentación**: [docs/](./expropriation-platform/docs/)

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT.
