import {
  BarChart3,
  Building2,
  Database,
  FileImage,
  FileText,
  Home,
  Settings,
  Users,
} from 'lucide-react';
import { ComponentType } from 'react';

export const navigationItems: NavItem[] = [
  {
    title: 'Inicio',
    href: '/dashboard',
    icon: Home,
    description: 'Panel principal del sistema',
  },
  {
    title: 'Expropiaciones',
    href: '/cases',
    icon: FileText,
    description: 'Gestión de casos de expropiación',
  },
  {
    title: 'Informes',
    href: '/reports',
    icon: BarChart3,
    description: 'Reportes y estadísticas',
    children: [
      {
        title: 'Panel de Informes',
        href: '/reports',
        icon: BarChart3,
        description: 'Ver todos los informes disponibles',
      },
      {
        title: 'Exportar Datos',
        href: '/reports/export',
        icon: Database,
        description: 'Exportar información del sistema',
        roles: ['super_admin', 'department_admin'],
      },
    ],
  },
  {
    title: 'Usuarios',
    href: '/users',
    icon: Users,
    description: 'Administración de usuarios y roles',
    roles: ['super_admin', 'department_admin'],
  },
  {
    title: 'Departamentos',
    href: '/departments',
    icon: Building2,
    description: 'Gestión de departamentos',
    roles: ['super_admin'],
  },
  {
    title: 'Documentos',
    href: '/documents',
    icon: FileImage,
    description: 'Gestión de documentos digitales',
  },
  {
    title: 'Administración',
    href: '/admin',
    icon: Settings,
    description: 'Configuración avanzada del sistema',
    roles: ['super_admin'],
    badge: 'Admin',
  },
];

export interface NavItem {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  description?: string;
  children?: NavItem[];
  roles?: string[];
};
