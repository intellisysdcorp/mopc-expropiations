'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Edit,
  History,
  Save,
  Search
} from 'lucide-react'
import clientLogger from '@/lib/client-logger';

interface SystemConfig {
  id: string
  key: string
  value: any
  type: string
  category: string
  description?: string
  environment?: string
  isRequired: boolean
  isPublic: boolean
  validation?: any
  version: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface ConfigHistory {
  id: string
  key: string
  oldValue: any
  newValue: any
  type: string
  category: string
  changeReason?: string
  changedBy: string
  createdAt: string
}

export function SystemConfigurationPanel() {
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [configHistory, setConfigHistory] = useState<ConfigHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConfig, setSelectedConfig] = useState<SystemConfig | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all')

  const categories = [
    'all',
    'general',
    'security',
    'backup',
    'performance',
    'email',
    'storage'
  ]

  const environments = [
    'all',
    'development',
    'staging',
    'production'
  ]

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/admin/config')
      if (response.ok) {
        const data = await response.json()
        setConfigs(data)
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching configs:', error)
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchConfigHistory = async (configKey: string) => {
    try {
      const response = await fetch(`/api/admin/config/${configKey}/history`)
      if (response.ok) {
        const data = await response.json()
        setConfigHistory(data)
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching config history:', error)
      }
    }
  }

  const handleEditConfig = (config: SystemConfig) => {
    setSelectedConfig({...config})
    setIsEditDialogOpen(true)
  }

  const handleSaveConfig = async () => {
    if (!selectedConfig) return

    try {
      const isCreating = selectedConfig.id === ''
      const url = isCreating ? '/api/admin/config' : `/api/admin/config/${selectedConfig.key}`
      const method = isCreating ? 'POST' : 'PUT'

      const body = isCreating ? {
        key: selectedConfig.key,
        value: selectedConfig.value,
        type: selectedConfig.type,
        category: selectedConfig.category,
        description: selectedConfig.description,
        environment: selectedConfig.environment,
        isRequired: selectedConfig.isRequired,
        isPublic: selectedConfig.isPublic
      } : {
        value: selectedConfig.value,
        description: selectedConfig.description,
        changeReason: 'Updated from admin panel'
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        await fetchConfigs()
        setIsEditDialogOpen(false)
        setSelectedConfig(null)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error saving config:', error)
      }
      alert('Error al guardar la configuración')
    }
  }

  const handleCreateConfig = () => {
    setSelectedConfig({
      id: '',
      key: '',
      value: '',
      type: 'string',
      category: 'general',
      description: '',
      environment: 'production',
      isRequired: false,
      isPublic: false,
      version: 1,
      createdBy: '',
      createdAt: '',
      updatedAt: ''
    })
    setIsEditDialogOpen(true)
  }

  const handleViewHistory = async (config: SystemConfig) => {
    setSelectedConfig(config)
    await fetchConfigHistory(config.key)
    setIsHistoryDialogOpen(true)
  }

  const filteredConfigs = configs.filter(config => {
    const matchesSearch = config.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         config.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || config.category === selectedCategory
    const matchesEnvironment = selectedEnvironment === 'all' || config.environment === selectedEnvironment

    return matchesSearch && matchesCategory && matchesEnvironment
  })

  const renderConfigValue = (config: SystemConfig) => {
    switch (config.type) {
      case 'boolean':
        return config.value ? 'Sí' : 'No'
      case 'json':
        return <code className="text-xs bg-muted p-1 rounded">{JSON.stringify(config.value)}</code>
      case 'number':
        return config.value.toString()
      default:
        return config.value.toString()
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando configuraciones...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Configuración del Sistema</h2>
          <p className="text-muted-foreground">
            Gestiona las configuraciones globales del sistema
          </p>
        </div>
        <Button onClick={handleCreateConfig}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Configuración
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar configuración..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'Todas las categorías' : category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
              <SelectTrigger>
                <SelectValue placeholder="Ambiente" />
              </SelectTrigger>
              <SelectContent>
                {environments.map((env) => (
                  <SelectItem key={env} value={env}>
                    {env === 'all' ? 'Todos los ambientes' : env.charAt(0).toUpperCase() + env.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Configurations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configuraciones</CardTitle>
          <CardDescription>
            Se encontraron {filteredConfigs.length} configuraciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clave</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConfigs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-mono text-sm">{config.key}</div>
                      {config.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {config.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{renderConfigValue(config)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{config.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{config.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={config.environment === 'production' ? 'destructive' :
                              config.environment === 'staging' ? 'default' : 'outline'}
                    >
                      {config.environment || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {config.isRequired && (
                        <Badge variant="destructive" className="text-xs">Requerido</Badge>
                      )}
                      {config.isPublic && (
                        <Badge variant="outline" className="text-xs">Público</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditConfig(config)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewHistory(config)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Config Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedConfig ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedConfig.id === '' ? 'Nueva Configuración' : 'Editar Configuración'}
                </DialogTitle>
                <DialogDescription>
                  {selectedConfig.id === ''
                    ? 'Crea una nueva configuración del sistema'
                    : 'Modifica el valor de la configuración seleccionada'
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                <Label htmlFor="key">Clave</Label>
                <Input
                  id="key"
                  value={selectedConfig.key}
                  onChange={(e) => setSelectedConfig({...selectedConfig, key: e.target.value})}
                  placeholder="ej: max_file_size"
                  disabled={selectedConfig.id !== ''}
                  className={selectedConfig.id !== '' ? 'bg-muted' : ''}
                />
              </div>
              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={selectedConfig.type}
                  onValueChange={(value) => setSelectedConfig({...selectedConfig, type: value})}
                  disabled={selectedConfig.id !== ''}
                >
                  <SelectTrigger className={selectedConfig.id !== '' ? 'bg-muted' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="boolean">Booleano</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="array">Arreglo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Categoría</Label>
                <Select
                  value={selectedConfig.category}
                  onValueChange={(value) => setSelectedConfig({...selectedConfig, category: value})}
                  disabled={selectedConfig.id !== ''}
                >
                  <SelectTrigger className={selectedConfig.id !== '' ? 'bg-muted' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="security">Seguridad</SelectItem>
                    <SelectItem value="backup">Backup</SelectItem>
                    <SelectItem value="performance">Rendimiento</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="storage">Almacenamiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="environment">Ambiente</Label>
                <Select
                  value={selectedConfig.environment || 'production'}
                  onValueChange={(value) => setSelectedConfig({...selectedConfig, environment: value})}
                  disabled={selectedConfig.id !== ''}
                >
                  <SelectTrigger className={selectedConfig.id !== '' ? 'bg-muted' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Desarrollo</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Producción</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="value">Valor</Label>
                {selectedConfig.type === 'boolean' ? (
                  <Switch
                    checked={selectedConfig.value}
                    onCheckedChange={(checked) =>
                      setSelectedConfig({...selectedConfig, value: checked})
                    }
                  />
                ) : selectedConfig.type === 'json' ? (
                  <Textarea
                    id="value"
                    value={JSON.stringify(selectedConfig.value, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsedValue = JSON.parse(e.target.value)
                        setSelectedConfig({...selectedConfig, value: parsedValue})
                      } catch {
                        // Invalid JSON, don't update
                      }
                    }}
                    rows={6}
                    className="font-mono text-sm"
                  />
                ) : (
                  <Input
                    id="value"
                    type={selectedConfig.type === 'number' ? 'number' : 'text'}
                    value={selectedConfig.value}
                    onChange={(e) => {
                      const value = selectedConfig.type === 'number'
                        ? parseFloat(e.target.value)
                        : e.target.value
                      setSelectedConfig({...selectedConfig, value})
                    }}
                  />
                )}
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={selectedConfig.description || ''}
                  onChange={(e) =>
                    setSelectedConfig({...selectedConfig, description: e.target.value})
                  }
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </Button>
              </div>
            </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-6">
              <p className="text-muted-foreground">No hay configuración seleccionada</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Historial de Cambios</DialogTitle>
            <DialogDescription>
              Historial de modificaciones para: {selectedConfig?.key}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Valor Anterior</TableHead>
                <TableHead>Valor Nuevo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Modificado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configHistory.map((history) => (
                <TableRow key={history.id}>
                  <TableCell>
                    {new Date(history.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted p-1 rounded">
                      {history.oldValue ? JSON.stringify(history.oldValue) : 'N/A'}
                    </code>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted p-1 rounded">
                      {JSON.stringify(history.newValue)}
                    </code>
                  </TableCell>
                  <TableCell>{history.changeReason || 'N/A'}</TableCell>
                  <TableCell>{history.changedBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  )
}