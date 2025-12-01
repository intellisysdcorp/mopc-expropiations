'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, Check, X, User, Shield, Settings } from 'lucide-react';

// Schema for user form validation
const userFormSchema = z.object({
  // Basic Information
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  email: z.email('Correo electrónico inválido'),
  username: z.string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo se permiten letras, números y guiones bajos'),
  phone: z.string().optional(),

  // Password (only for new users)
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
           'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial')
    .optional()
    .or(z.literal('')),

  confirmPassword: z.string().optional(),

  // Department and Role
  departmentId: z.string().min(1, 'El departamento es requerido'),
  roleId: z.string().min(1, 'El rol es requerido'),

  // Job Information
  jobTitle: z.string().optional(),
  officeLocation: z.string().optional(),
  bio: z.string().max(500, 'La biografía no puede exceder 500 caracteres').optional(),

  // Preferences
  preferredLanguage: z.string().default('es'),
  timezone: z.string().default('America/Santo_Domingo'),
  theme: z.enum(['light', 'dark', 'system']).default('light'),

  // Notifications
  emailNotifications: z.boolean().default(true),
  emailMarketing: z.boolean().default(false),
  emailDigest: z.boolean().default(true),

  // Status
  isActive: z.boolean().default(true),
  isSuspended: z.boolean().default(false),
  suspensionReason: z.string().optional(),

  // Security
  twoFactorEnabled: z.boolean().default(false),
  mustChangePassword: z.boolean().default(false),
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormProps {
  initialData?: Partial<UserFormValues>;
  onSubmit: (data: UserFormValues) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
  departments: Array<{ id: string; name: string; code: string }>;
  roles: Array<{ id: string; name: string; description: string; permissions: any }>;
}

export function UserForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
  departments,
  roles,
}: UserFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const form = useForm({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      firstName: initialData?.firstName || '',
      lastName: initialData?.lastName || '',
      email: initialData?.email || '',
      username: initialData?.username || '',
      phone: initialData?.phone || '',
      password: initialData?.password || '',
      confirmPassword: initialData?.confirmPassword || '',
      departmentId: initialData?.departmentId || '',
      roleId: initialData?.roleId || '',
      jobTitle: initialData?.jobTitle || '',
      officeLocation: initialData?.officeLocation || '',
      bio: initialData?.bio || '',
      preferredLanguage: initialData?.preferredLanguage || 'es',
      timezone: initialData?.timezone || 'America/Santo_Domingo',
      theme: initialData?.theme || 'light',
      emailNotifications: initialData?.emailNotifications ?? true,
      emailMarketing: initialData?.emailMarketing ?? false,
      emailDigest: initialData?.emailDigest ?? true,
      isActive: initialData?.isActive ?? true,
      isSuspended: initialData?.isSuspended ?? false,
      suspensionReason: initialData?.suspensionReason || '',
      twoFactorEnabled: initialData?.twoFactorEnabled ?? false,
      mustChangePassword: initialData?.mustChangePassword ?? false,
    },
  });

  const watchPassword = form.watch('password');
  const watchEmail = form.watch('email');
  const watchUsername = form.watch('username');
  const watchIsSuspended = form.watch('isSuspended');

  // Calculate password strength
  useEffect(() => {
    if (!watchPassword) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (watchPassword.length >= 8) {strength++;}
    if (watchPassword.length >= 12) {strength++;}
    if (/[a-z]/.test(watchPassword)) {strength++;}
    if (/[A-Z]/.test(watchPassword)) {strength++;}
    if (/\d/.test(watchPassword)) {strength++;}
    if (/[@$!%*?&]/.test(watchPassword)) {strength++;}
    if (watchPassword.length >= 16) {strength++;}

    setPasswordStrength(Math.min(strength, 5));
  }, [watchPassword]);

  // Check email availability
  useEffect(() => {
    if (!watchEmail || !watchEmail.includes('@')) {
      setEmailAvailable(null);
      return;
    }

    const checkEmail = async () => {
      setCheckingEmail(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        // In a real app, this would be an actual API call
        setEmailAvailable(true);
      } catch (_) {
        setEmailAvailable(null);
      } finally {
        setCheckingEmail(false);
      }
    };

    checkEmail();
  }, [watchEmail]);

  // Check username availability
  useEffect(() => {
    if (!watchUsername || watchUsername.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const checkUsername = async () => {
      setCheckingUsername(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        // In a real app, this would be an actual API call
        setUsernameAvailable(true);
      } catch (_) {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    };

    checkUsername();
  }, [watchUsername]);

  const handleSubmit = async (data: UserFormValues) => {
    // For edit mode, remove password fields if they're empty
    if (mode === 'edit' && !data.password) {
      const { password: _password, confirmPassword: _confirmPassword, ...submitData } = data;
      await onSubmit(submitData);
    } else {
      await onSubmit(data);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) {return 'text-red-500';}
    if (passwordStrength <= 4) {return 'text-yellow-500';}
    return 'text-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 2) {return 'Débil';}
    if (passwordStrength <= 4) {return 'Media';}
    return 'Fuerte';
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Información Básica
              </TabsTrigger>
              <TabsTrigger value="job" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Información Laboral
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Seguridad
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Preferencias
              </TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Información Personal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre *</FormLabel>
                          <FormControl>
                            <Input placeholder="Juan" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apellido *</FormLabel>
                          <FormControl>
                            <Input placeholder="Pérez" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="email"
                              placeholder="juan.perez@ejemplo.com"
                              {...field}
                            />
                            {checkingEmail && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              </div>
                            )}
                            {emailAvailable !== null && !checkingEmail && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                {emailAvailable ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Este será el correo electrónico para iniciar sesión
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de Usuario *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="juanperez"
                              {...field}
                            />
                            {checkingUsername && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              </div>
                            )}
                            {usernameAvailable !== null && !checkingUsername && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                {usernameAvailable ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Solo se permiten letras, números y guiones bajos
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+1 809-123-4567"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(mode === 'create' || watchPassword) && (
                    <>
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Contraseña {mode === 'create' && '*'}
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder={mode === 'create' ? '••••••••' : 'Dejar en blanco para mantener la actual'}
                                  {...field}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </FormControl>
                            {watchPassword && (
                              <FormDescription className="flex items-center gap-2">
                                <span>Fortaleza: </span>
                                <Badge className={getPasswordStrengthColor()}>
                                  {getPasswordStrengthText()}
                                </Badge>
                              </FormDescription>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {watchPassword && (
                        <FormField
                          control={form.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirmar Contraseña *</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    {...field}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  >
                                    {showConfirmPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Asignación de Departamento y Rol</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar departamento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.map(dept => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name} ({dept.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rol *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar rol" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles.map(role => (
                              <SelectItem key={role.id} value={role.id}>
                                <div>
                                  <div className="font-medium">{role.name}</div>
                                  {role.description && (
                                    <div className="text-sm text-muted-foreground">
                                      {role.description}
                                    </div>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Job Information Tab */}
            <TabsContent value="job" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Información Laboral</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo</FormLabel>
                        <FormControl>
                          <Input placeholder="Analista de Proyectos" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="officeLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ubicación de Oficina</FormLabel>
                        <FormControl>
                          <Input placeholder="Edificio Central, Piso 3" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Biografía</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Información adicional sobre el usuario..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Máximo 500 caracteres
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estado de la Cuenta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Cuenta Activa</FormLabel>
                          <FormDescription>
                            Permite que el usuario pueda iniciar sesión en el sistema
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isSuspended"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Cuenta Suspendida</FormLabel>
                          <FormDescription>
                            Bloquea temporalmente el acceso del usuario al sistema
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {watchIsSuspended && (
                    <FormField
                      control={form.control}
                      name="suspensionReason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Razón de Suspensión</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe el motivo de la suspensión..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de Seguridad</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="twoFactorEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Autenticación de Dos Factores</FormLabel>
                          <FormDescription>
                            Requiere un código adicional al iniciar sesión
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mustChangePassword"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Forzar Cambio de Contraseña</FormLabel>
                          <FormDescription>
                            El usuario deberá cambiar su contraseña en el próximo inicio de sesión
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preferencias de Usuario</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="preferredLanguage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Idioma Preferido</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="es">Español</SelectItem>
                              <SelectItem value="en">English</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zona Horaria</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="America/Santo_Domingo">
                                Santo Domingo (GMT-4)
                              </SelectItem>
                              <SelectItem value="America/New_York">
                                Nueva York (GMT-5)
                              </SelectItem>
                              <SelectItem value="Europe/Madrid">
                                Madrid (GMT+1)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="theme"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tema</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="light">Claro</SelectItem>
                              <SelectItem value="dark">Oscuro</SelectItem>
                              <SelectItem value="system">Sistema</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notificaciones por Correo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="emailNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Notificaciones Generales</FormLabel>
                          <FormDescription>
                            Recibir notificaciones importantes del sistema
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emailDigest"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Resumen Diario</FormLabel>
                          <FormDescription>
                            Recibir un resumen diario de las actividades
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emailMarketing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Marketing</FormLabel>
                          <FormDescription>
                            Recibir correos promocionales y novedades
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || (checkingEmail || checkingUsername)}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  {mode === 'create' ? 'Creando...' : 'Actualizando...'}
                </div>
              ) : (
                mode === 'create' ? 'Crear Usuario' : 'Actualizar Usuario'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}