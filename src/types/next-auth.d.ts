import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      firstName: string;
      lastName: string;
      username: string;
      role: string;
      department: string;
      departmentId: string;
      roleId: string;
      permissions: Record<string, boolean>;
      isActive: boolean;
      phone?: string;
      avatar?: string;
      mustChangePassword?: boolean;
      sessionToken?: string;
    };
    accessToken?: string;
  }

  interface User {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    username: string;
    role: string;
    department: string;
    departmentId: string;
    roleId: string;
    permissions: Record<string, boolean>;
    isActive: boolean;
    phone?: string;
    avatar?: string;
    mustChangePassword?: boolean;
    sessionToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    role: string;
    department: string;
    departmentId: string;
    roleId: string;
    permissions: Record<string, boolean>;
    isActive: boolean;
    phone?: string;
    avatar?: string;
    mustChangePassword?: boolean;
    sessionToken?: string;
  }
}