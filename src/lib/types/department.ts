// Department types shared across the application

export interface Department {
  id: string;
  name: string;
  code: string;
  parentId?: string | null;
  description?: string | null;
  headUserId?: string | null;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  caseCount?: number;
  childCount?: number;
  isSuspended?: boolean;
  parent?: {
    id: string;
    name: string;
    code: string;
  } | null;
  headUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  children?: Department[];
  contactInfo?: any;
  location?: any;
  type?: string | null;
  userCapacity?: number | null;
  budget?: number | null;
  operatingHours?: any;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  departmentId: string;
  role: {
    id: string;
    name: string;
  };
  isActive: boolean;
  isSuspended: boolean;
  createdAt: string;
}