# Guía de Desarrollo

Guía completa para desarrolladores trabajando en la Plataforma de Expropiación MOPC.

## 🚀 Scripts Disponibles

### Desarrollo
```bash
npm run dev              # Iniciar servidor de desarrollo
npm run build           # Compilar para producción
npm run start           # Iniciar servidor de producción
```

### Calidad de Código
```bash
npm run lint            # Ejecutar ESLint
npm run lint:fix        # Corregir problemas de ESLint
npm run format          # Formatear código con Prettier
npm run type-check      # Verificación de tipos TypeScript
```

### Base de Datos
```bash
npm run db:generate     # Generar cliente Prisma
npm run db:push         # Sincronizar esquema con DB
npm run db:migrate      # Ejecutar migraciones
npm run db:studio       # Abrir Prisma Studio
npm run db:seed         # Poblar base de datos con datos iniciales
```

### Testing
```bash
npm run test            # Ejecutar todos los tests
npm run test:watch      # Tests en modo watch
npm run test:coverage   # Tests con cobertura de código
```

## 🏗️ Estructura del Proyecto

```
src/
├── app/                # App Router de Next.js 13+
│   ├── (dashboard)/    # Rutas agrupadas del dashboard
│   ├── api/           # API Routes
│   ├── auth/          # Páginas de autenticación
│   └── globals.css    # Estilos globales
├── components/         # Componentes React
│   ├── ui/            # Componentes base (shadcn/ui)
│   ├── forms/         # Componentes de formularios
│   └── features/      # Componentes por feature
├── lib/               # Utilidades y configuraciones
├── types/             # Definiciones de TypeScript
├── hooks/             # Custom hooks
└── store/             # Gestión de estado
```

## 📝 Convenciones de Código

### TypeScript

**Tipado Estricto:**
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

const getUserById = async (id: string): Promise<User | null> => {
  return await prisma.user.findUnique({ where: { id } });
};
```

### Componentes React

```typescript
interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  onEdit
}) => {
  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
};
```

## 🧪 Testing

### Testing de Componentes

```typescript
import { render, screen } from "@testing-library/react";
import { UserCard } from "@/components/features/user-card";

describe("UserCard", () => {
  it("renders user information correctly", () => {
    render(<UserCard user={mockUser} />);
    
    expect(screen.getByText(mockUser.name)).toBeInTheDocument();
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
  });
});
```

## 🎨 Estilos y UI

### Componentes shadcn/ui

```typescript
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

## 🔐 Validaciones con Zod

```typescript
import { z } from "zod";

export const createCaseSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(100),
  description: z.string().min(10, "Mínimo 10 caracteres"),
  propertyAddress: z.string().min(5, "La dirección es requerida"),
  ownerName: z.string().min(1, "El nombre del propietario es requerido"),
  propertyType: z.enum(["RESIDENTIAL", "COMMERCIAL", "LAND"]),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
```

Para más información sobre desarrollo, consulta la documentación de Next.js y Prisma.
