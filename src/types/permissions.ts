// Role and Permission Types for the Expropriation Platform

export interface RolePermissions {
  // User Management
  READ_USERS: boolean;
  CREATE_USERS: boolean;
  UPDATE_USERS: boolean;
  DELETE_USERS: boolean;
  MANAGE_PERMISSIONS: boolean;

  // Case Management
  READ_CASES: boolean;
  CREATE_CASES: boolean;
  UPDATE_CASES: boolean;
  DELETE_CASES: boolean;
  ASSIGN_CASES: boolean;
  APPROVE_CASES: boolean;

  // Department Management
  READ_DEPARTMENTS: boolean;
  CREATE_DEPARTMENTS: boolean;
  UPDATE_DEPARTMENTS: boolean;
  DELETE_DEPARTMENTS: boolean;
  MANAGE_DEPARTMENT_USERS: boolean;

  // System Management
  VIEW_REPORTS: boolean;
  EXPORT_DATA: boolean;
  IMPORT_DATA: boolean;
  SYSTEM_CONFIG: boolean;
  VIEW_LOGS: boolean;
  MANAGE_BACKUPS: boolean;
}

export interface PermissionCategory {
  id: string;
  name: string;
  icon?: any;
  permissions: Array<{
    key: keyof RolePermissions;
    name: string;
    description: string;
  }>;
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'user_management',
    name: 'Gestión de Usuarios',
    permissions: [
      { key: 'READ_USERS', name: 'Ver Usuarios', description: 'Puede ver la lista de usuarios' },
      { key: 'CREATE_USERS', name: 'Crear Usuarios', description: 'Puede crear nuevos usuarios' },
      { key: 'UPDATE_USERS', name: 'Actualizar Usuarios', description: 'Puede modificar usuarios existentes' },
      { key: 'DELETE_USERS', name: 'Eliminar Usuarios', description: 'Puede eliminar usuarios' },
      { key: 'MANAGE_PERMISSIONS', name: 'Gestionar Permisos', description: 'Puede asignar y modificar permisos' },
    ],
  },
  {
    id: 'case_management',
    name: 'Gestión de Casos',
    permissions: [
      { key: 'READ_CASES', name: 'Ver Casos', description: 'Puede ver los casos del sistema' },
      { key: 'CREATE_CASES', name: 'Crear Casos', description: 'Puede crear nuevos casos' },
      { key: 'UPDATE_CASES', name: 'Actualizar Casos', description: 'Puede modificar casos existentes' },
      { key: 'DELETE_CASES', name: 'Eliminar Casos', description: 'Puede eliminar casos' },
      { key: 'ASSIGN_CASES', name: 'Asignar Casos', description: 'Puede asignar casos a usuarios' },
      { key: 'APPROVE_CASES', name: 'Aprobar Casos', description: 'Puede aprobar casos' },
    ],
  },
  {
    id: 'department_management',
    name: 'Gestión de Departamentos',
    permissions: [
      { key: 'READ_DEPARTMENTS', name: 'Ver Departamentos', description: 'Puede ver la lista de departamentos' },
      { key: 'CREATE_DEPARTMENTS', name: 'Crear Departamentos', description: 'Puede crear nuevos departamentos' },
      { key: 'UPDATE_DEPARTMENTS', name: 'Actualizar Departamentos', description: 'Puede modificar departamentos' },
      { key: 'DELETE_DEPARTMENTS', name: 'Eliminar Departamentos', description: 'Puede eliminar departamentos' },
      { key: 'MANAGE_DEPARTMENT_USERS', name: 'Gestionar Usuarios de Departamento', description: 'Puede asignar usuarios a departamentos' },
    ],
  },
  {
    id: 'system_management',
    name: 'Gestión del Sistema',
    permissions: [
      { key: 'VIEW_REPORTS', name: 'Ver Reportes', description: 'Puede acceder a reportes del sistema' },
      { key: 'EXPORT_DATA', name: 'Exportar Datos', description: 'Puede exportar datos del sistema' },
      { key: 'IMPORT_DATA', name: 'Importar Datos', description: 'Puede importar datos al sistema' },
      { key: 'SYSTEM_CONFIG', name: 'Configuración del Sistema', description: 'Puede modificar configuraciones del sistema' },
      { key: 'VIEW_LOGS', name: 'Ver Logs', description: 'Puede ver logs del sistema' },
      { key: 'MANAGE_BACKUPS', name: 'Gestionar Respaldos', description: 'Puede gestionar respaldos del sistema' },
    ],
  },
];

export const DEFAULT_PERMISSIONS: RolePermissions = {
  READ_USERS: false,
  CREATE_USERS: false,
  UPDATE_USERS: false,
  DELETE_USERS: false,
  MANAGE_PERMISSIONS: false,
  READ_CASES: false,
  CREATE_CASES: false,
  UPDATE_CASES: false,
  DELETE_CASES: false,
  ASSIGN_CASES: false,
  APPROVE_CASES: false,
  READ_DEPARTMENTS: false,
  CREATE_DEPARTMENTS: false,
  UPDATE_DEPARTMENTS: false,
  DELETE_DEPARTMENTS: false,
  MANAGE_DEPARTMENT_USERS: false,
  VIEW_REPORTS: false,
  EXPORT_DATA: false,
  IMPORT_DATA: false,
  SYSTEM_CONFIG: false,
  VIEW_LOGS: false,
  MANAGE_BACKUPS: false,
};

// Helper function to ensure all permission keys exist
export function normalizePermissions(permissions: Partial<RolePermissions> = {}): RolePermissions {
  const result: RolePermissions = { ...DEFAULT_PERMISSIONS };

  Object.entries(permissions).forEach(([key, value]) => {
    if (key in DEFAULT_PERMISSIONS) {
      result[key as keyof RolePermissions] = Boolean(value);
    }
  });

  return result;
}