'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Search,
  Download,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onSort?: (columnId: string, direction: 'asc' | 'desc') => void;
  onFilter?: (filters: Record<string, any>) => void;
  onSearch?: (search: string) => void;
  onRowSelect?: (selectedRows: T[]) => void;
  onExport?: (format: 'csv' | 'json' | 'excel') => void;
  onRefresh?: () => void;
  selectedRows?: T[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  actions?: {
    label: string;
    icon: React.ReactNode;
    onClick: (item: T) => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    disabled?: boolean | ((user: T) => boolean);
  }[];
  bulkActions?: {
    label: string;
    icon: React.ReactNode;
    onClick: (selectedItems: T[]) => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    disabled?: boolean;
  }[];
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  pagination,
  onPageChange,
  onLimitChange,
  onSort,
  onFilter,
  onSearch,
  onRowSelect,
  onExport,
  onRefresh,
  selectedRows = [],
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'No hay datos disponibles',
  className,
  actions = [],
  bulkActions = [],
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<T[]>(selectedRows);

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onSearch?.(value);
  };

  // Handle sorting
  const handleSort = (columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (!column?.sortable) {return;}

    const newDirection = sortColumn === columnId && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(columnId);
    setSortDirection(newDirection);
    onSort?.(columnId, newDirection);
  };

  // Handle filtering
  const handleFilter = (columnId: string, value: any) => {
    const newFilters = { ...filters, [columnId]: value };
    if (!value || value === 'ALL') {delete newFilters[columnId];}
    setFilters(newFilters);
    onFilter?.(newFilters);
  };

  // Handle row selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(data);
      onRowSelect?.(data);
    } else {
      setSelected([]);
      onRowSelect?.([]);
    }
  };

  const handleSelectRow = (item: T, checked: boolean) => {
    const newSelected = checked
      ? [...selected, item]
      : selected.filter(row => row.id !== item.id);
    setSelected(newSelected);
    onRowSelect?.(newSelected);
  };

  // Filter and sort data for display
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchTerm) {
      result = result.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item => {
          const itemValue = item[key];
          if (typeof itemValue === 'string') {
            return itemValue.toLowerCase().includes(String(value).toLowerCase());
          }
          if (typeof itemValue === 'boolean') {
            return itemValue === value;
          }
          return String(itemValue) === String(value);
        });
      }
    });

    // Apply sorting
    if (sortColumn) {
      result.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (aValue === null || aValue === undefined) {return 1;}
        if (bValue === null || bValue === undefined) {return -1;}

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else {
          comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchTerm, filters, sortColumn, sortDirection]);

  // Render cell content
  const renderCell = (column: Column<T>, row: T) => {
    if (column.cell) {
      return column.cell(row);
    }

    const value = row[column.accessorKey as keyof T];

    // Handle different data types
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">—</span>;
    }

    if (typeof value === 'boolean') {
      return (
        <Badge variant={value ? 'default' : 'secondary'}>
          {value ? 'Sí' : 'No'}
        </Badge>
      );
    }

    if (typeof value === 'object') {
      return <span className="text-muted-foreground">Objeto</span>;
    }

    return <span>{String(value)}</span>;
  };

  // Helper function to create a unique key for any value type
  const createUniqueKey = (value: any, index: number): string => {
    if (value === null || value === undefined) {
      return `null-${index}`;
    }
    if (typeof value === 'object') {
      // For objects, use JSON stringification or a combination of properties
      try {
        return `obj-${JSON.stringify(value)}`;
      } catch {
        // Fallback for circular references or non-serializable objects
        return `obj-${index}`;
      }
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return `${typeof value}-${value}`;
    }
    // For other types (dates, etc.)
    return `${typeof value}-${String(value)}-${index}`;
  };

  // Helper function to format value for display
  const formatDisplayValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[Objeto]';
      }
    }
    return String(value);
  };

  // Get unique values for filtering
  const getFilterValues = (columnId: string) => {
    const values = data.map(item => item[columnId]).filter(Boolean);
    // Use a Map to handle uniqueness with proper key generation
    const uniqueValues = new Map();
    values.forEach((value, index) => {
      const key = createUniqueKey(value, index);
      if (!uniqueValues.has(key)) {
        uniqueValues.set(key, value);
      }
    });
    return Array.from(uniqueValues.values());
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with search and actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          )}

          {onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onExport('csv')}>
                  Exportar como CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('json')}>
                  Exportar como JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('excel')}>
                  Exportar como Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {selected.length > 0 && bulkActions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selected.length} seleccionado{selected.length !== 1 ? 's' : ''}
              </span>
              {bulkActions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || 'default'}
                  size="sm"
                  onClick={() => action.onClick(selected)}
                  disabled={action.disabled}
                >
                  {action.icon}
                  <span className="ml-2">{action.label}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {columns
          .filter(column => column.filterable)
          .map(column => (
            <div key={column.id} className="flex items-center gap-2">
              <span className="text-sm font-medium">{column.header}:</span>
              <Select
                value={filters[column.id] || ''}
                onValueChange={(value) => handleFilter(column.id, value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {getFilterValues(column.id).map((value, index) => (
                    <SelectItem
                      key={createUniqueKey(value, index)}
                      value={String(value)}
                    >
                      {formatDisplayValue(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {onRowSelect && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selected.length === data.length && data.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map(column => (
                <TableHead
                  key={column.id}
                  style={{ width: column.width }}
                  className={cn(
                    column.sortable && 'cursor-pointer hover:bg-muted/50',
                    column.className
                  )}
                  onClick={() => column.sortable && handleSort(column.id)}
                >
                  <div className="flex items-center space-x-2">
                    <span>{column.header}</span>
                    {column.sortable && (
                      <div className="flex flex-col">
                        <ChevronUp
                          className={cn(
                            'h-3 w-3',
                            sortColumn === column.id && sortDirection === 'asc'
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                        />
                        <ChevronDown
                          className={cn(
                            'h-3 w-3 -mt-1',
                            sortColumn === column.id && sortDirection === 'desc'
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                        />
                      </div>
                    )}
                  </div>
                </TableHead>
              ))}
              {actions.length > 0 && <TableHead className="w-12">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions.length > 0 ? 2 : 1) + (onRowSelect ? 1 : 0)}>
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredAndSortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions.length > 0 ? 2 : 1) + (onRowSelect ? 1 : 0)}>
                  <div className="text-center py-8 text-muted-foreground">
                    {emptyMessage}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedData.map(row => (
                <TableRow key={row.id}>
                  {onRowSelect && (
                    <TableCell>
                      <Checkbox
                        checked={selected.some(selectedRow => selectedRow.id === row.id)}
                        onCheckedChange={(checked) => handleSelectRow(row, checked as boolean)}
                      />
                    </TableCell>
                  )}
                  {columns.map(column => (
                    <TableCell key={column.id} className={column.className}>
                      {renderCell(column, row)}
                    </TableCell>
                  ))}
                  {actions.length > 0 && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {actions?.map((action, index) => (
                            <DropdownMenuItem
                              key={index}
                              onClick={() => action.onClick(row)}
                              disabled={
                                typeof action.disabled === 'function'
                                  ? action.disabled(row)
                                  : action.disabled || false
                              }
                              className={cn(
                                action.variant === 'destructive' && 'text-destructive'
                              )}
                            >
                              {action.icon}
                              <span className="ml-2">{action.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="text-sm text-muted-foreground">
              Mostrando{' '}
            <span className="font-medium">
              {(pagination.page - 1) * pagination.limit + 1}
            </span>{' '}
            a{' '}
            <span className="font-medium">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            de{' '}
            <span className="font-medium">{pagination.total}</span> resultados
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Select
              value={String(pagination.limit)}
              onValueChange={(value) => onLimitChange?.(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map(pageSize => (
                  <SelectItem key={pageSize} value={String(pageSize)}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => onPageChange?.(1)}
                disabled={pagination.page === 1}
              >
                <span className="sr-only">Ir a la primera página</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => onPageChange?.(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                <span className="sr-only">Ir a la página anterior</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-center text-sm font-medium w-8 h-8">
                {pagination.page}
              </div>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => onPageChange?.(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
              >
                <span className="sr-only">Ir a la página siguiente</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => onPageChange?.(pagination.pages)}
                disabled={pagination.page === pagination.pages}
              >
                <span className="sr-only">Ir a la última página</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}