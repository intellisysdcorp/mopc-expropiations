'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ChevronDown,
  ChevronRight,
  Building,
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Department } from '@/lib/types/department';


interface DepartmentTreeProps {
  departments: Department[];
  onSelectDepartment?: (department: Department) => void;
  onCreateDepartment?: (parentId?: string) => void;
  onEditDepartment?: (department: Department) => void;
  onDeleteDepartment?: (department: Department) => void;
  onMoveDepartment?: (department: Department, newParentId: string | null) => void;
  selectedDepartmentId?: string;
  loading?: boolean;
  showStats?: boolean;
  searchable?: boolean;
  expandable?: boolean;
  actions?: boolean;
}

interface TreeNodeProps {
  department: Department;
  level: number;
  onSelectDepartment: ((department: Department) => void) | undefined;
  onCreateDepartment: ((parentId?: string) => void) | undefined;
  onEditDepartment: ((department: Department) => void) | undefined;
  onDeleteDepartment: ((department: Department) => void) | undefined;
  onMoveDepartment: ((department: Department, newParentId: string | null) => void) | undefined;
  selectedDepartmentId: string | undefined;
  showStats?: boolean;
  actions?: boolean;
  expandedNodes: Set<string>;
  onToggleExpand: (id: string) => void;
  searchTerm: string | undefined;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  department,
  level,
  onSelectDepartment,
  onCreateDepartment,
  onEditDepartment,
  onDeleteDepartment,
  onMoveDepartment,
  selectedDepartmentId,
  showStats = true,
  actions = true,
  expandedNodes,
  onToggleExpand,
  searchTerm,
}) => {
  const hasChildren = department.children && department.children.length > 0;
  const isExpanded = expandedNodes.has(department.id);
  const isSelected = selectedDepartmentId === department.id;

  const handleToggleExpand = useCallback(() => {
    if (hasChildren) {
      onToggleExpand(department.id);
    }
  }, [hasChildren, onToggleExpand, department.id]);

  const handleSelect = useCallback(() => {
    onSelectDepartment?.(department);
  }, [department, onSelectDepartment]);

  const isMatchingSearch = searchTerm && (
    department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    department.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    department.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="select-none">
      <div
        className={`
          group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors
          hover:bg-muted/50
          ${isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''}
          ${!department.isActive ? 'opacity-60' : ''}
        `}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={handleSelect}
      >
        {/* Expand/Collapse Button */}
        <div
          className={`
            flex items-center justify-center w-5 h-5 rounded transition-colors
            ${hasChildren ? 'hover:bg-muted' : ''}
          `}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleExpand();
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
          )}
        </div>

        {/* Department Icon */}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <Building className="h-4 w-4 text-primary" />
        </div>

        {/* Department Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{department.name}</span>
            <Badge variant="outline" className="text-xs">
              {department.code}
            </Badge>
            {!department.isActive && (
              <Badge variant="secondary" className="text-xs">
                Inactivo
              </Badge>
            )}
            {department.isSuspended && (
              <Badge variant="destructive" className="text-xs">
                Suspendido
              </Badge>
            )}
            {isMatchingSearch && (
              <Badge variant="secondary" className="text-xs">
                Coincidencia
              </Badge>
            )}
          </div>

          {showStats && (
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {department.userCount || 0} usuarios
              </div>
              <div className="flex items-center gap-1">
                <Building className="h-3 w-3" />
                {department.caseCount || 0} casos
              </div>
              {department.headUser && (
                <div className="flex items-center gap-1">
                  <span>Jefe: {department.headUser.firstName} {department.headUser.lastName}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onEditDepartment?.(department)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateDepartment?.(department.id)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Subdepartamento
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDeleteDepartment?.(department)}
                  className="text-destructive"
                  disabled={(department.userCount || 0) > 0 || (department.caseCount || 0) > 0 || (department.childCount || 0) > 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {department.children?.map((child) => (
            <TreeNode
              key={child.id}
              department={child}
              level={level + 1}
              onSelectDepartment={onSelectDepartment}
              onCreateDepartment={onCreateDepartment}
              onEditDepartment={onEditDepartment}
              onDeleteDepartment={onDeleteDepartment}
              onMoveDepartment={onMoveDepartment}
              selectedDepartmentId={selectedDepartmentId}
              showStats={showStats}
              actions={actions}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DepartmentTree: React.FC<DepartmentTreeProps> = ({
  departments,
  onSelectDepartment,
  onCreateDepartment,
  onEditDepartment,
  onDeleteDepartment,
  onMoveDepartment,
  selectedDepartmentId,
  loading = false,
  showStats = true,
  searchable = true,
  actions = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);

  // Build tree structure from flat list
  const treeData = useMemo(() => {
    const deptMap = new Map<string, Department>();
    const rootDepartments: Department[] = [];

    // Create map
    departments.forEach(dept => {
      deptMap.set(dept.id, { ...dept, children: [] });
    });

    // Build tree
    departments.forEach(dept => {
      const deptWithChildren = deptMap.get(dept.id)!;
      if (dept.parentId && deptMap.has(dept.parentId)) {
        const parent = deptMap.get(dept.parentId)!;
        parent.children = parent.children || [];
        parent.children.push(deptWithChildren);
      } else {
        rootDepartments.push(deptWithChildren);
      }
    });

    // Sort departments by name
    const sortDepartments = (depts: Department[]): Department[] => {
      return depts.sort((a, b) => a.name.localeCompare(b.name))
        .map(dept => ({
          ...dept,
          children: dept.children ? sortDepartments(dept.children) : [],
        }));
    };

    return sortDepartments(rootDepartments);
  }, [departments]);

  // Filter departments based on search and status
  const filteredTree = useMemo(() => {
    if (!searchTerm && showInactive) {
      return treeData;
    }

    const filterDepartment = (dept: Department): Department | null => {
      const matchesSearch = !searchTerm ||
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = showInactive || dept.isActive;

      if (matchesSearch && matchesStatus) {
        const filteredChildren = dept.children
          ?.map(filterDepartment)
          .filter(Boolean) as Department[] || [];

        return {
          ...dept,
          children: filteredChildren,
        };
      }

      // If current department doesn't match, check if any children match
      if (dept.children) {
        const matchingChildren = dept.children
          .map(filterDepartment)
          .filter(Boolean) as Department[];

        if (matchingChildren.length > 0) {
          return {
            ...dept,
            children: matchingChildren,
          };
        }
      }

      return null;
    };

    return treeData.map(filterDepartment).filter(Boolean) as Department[];
  }, [treeData, searchTerm, showInactive]);

  useEffect(() => {
    handleExpandAll();
  }, []);

  const handleToggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const getAllNodeIds = (depts: Department[]): string[] => {
      return depts.reduce((acc, dept) => {
        acc.push(dept.id);
        if (dept.children) {
          acc.push(...getAllNodeIds(dept.children));
        }
        return acc;
      }, [] as string[]);
    };

    setExpandedNodes(new Set(getAllNodeIds(filteredTree)));
  }, [filteredTree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  const stats = useMemo(() => {
    const totalDepts = departments.length;
    const activeDepts = departments.filter(d => d.isActive).length;
    const inactiveDepts = totalDepts - activeDepts;
    const suspendedDepts = departments.filter(d => d.isSuspended).length;
    const totalUsers = departments.reduce((sum, d) => sum + (d.userCount || 0), 0);
    const totalCases = departments.reduce((sum, d) => sum + (d.caseCount || 0), 0);

    return {
      totalDepts,
      activeDepts,
      inactiveDepts,
      suspendedDepts,
      totalUsers,
      totalCases,
    };
  }, [departments]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Departamentos
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {stats.totalDepts} total
            </Badge>
            {onCreateDepartment && (
              <Button
                size="sm"
                onClick={() => onCreateDepartment()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="font-medium">{stats.activeDepts}</div>
            <div className="text-muted-foreground">Activos</div>
          </div>
          <div>
            <div className="font-medium">{stats.inactiveDepts}</div>
            <div className="text-muted-foreground">Inactivos</div>
          </div>
          <div>
            <div className="font-medium">{stats.totalUsers}</div>
            <div className="text-muted-foreground">Usuarios</div>
          </div>
          <div>
            <div className="font-medium">{stats.totalCases}</div>
            <div className="text-muted-foreground">Casos</div>
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="p-0">
        {/* Search and Controls */}
        {searchable && (
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar departamentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExpandAll}
                  disabled={filteredTree.length === 0}
                >
                  Expandir todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCollapseAll}
                  disabled={expandedNodes.size === 0}
                >
                  Contraer todos
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showInactive"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="showInactive" className="text-sm">
                  Mostrar inactivos
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tree */}
        <div className="max-h-[600px] overflow-y-auto">
          {filteredTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? 'No se encontraron departamentos' : 'No hay departamentos'}
              </h3>
              <p className="text-muted-foreground text-sm max-w-md">
                {searchTerm
                  ? 'Intente ajustar los términos de búsqueda o los filtros.'
                  : 'Cree el primer departamento para comenzar a organizar la estructura.'
                }
              </p>
              {!searchTerm && onCreateDepartment && (
                <Button
                  className="mt-4"
                  onClick={() => onCreateDepartment()}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Departamento
                </Button>
              )}
            </div>
          ) : (
            <div className="py-2">
              {filteredTree.map((dept) => (
                <TreeNode
                  key={dept.id}
                  department={dept}
                  level={0}
                  onSelectDepartment={onSelectDepartment}
                  onCreateDepartment={onCreateDepartment}
                  onEditDepartment={onEditDepartment}
                  onDeleteDepartment={onDeleteDepartment}
                  onMoveDepartment={onMoveDepartment}
                  selectedDepartmentId={selectedDepartmentId}
                  showStats={showStats}
                  actions={actions}
                  expandedNodes={expandedNodes}
                  onToggleExpand={handleToggleExpand}
                  searchTerm={searchTerm}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};