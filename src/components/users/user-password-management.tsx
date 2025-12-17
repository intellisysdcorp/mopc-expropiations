'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Eye,
  EyeOff,
  Key,
  Shield,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserPasswordManagementProps {
  userId: string;
  userName: string;
  userEmail: string;
}

export function UserPasswordManagement({ userId, userName, userEmail }: UserPasswordManagementProps) {
  const [loading, setLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showForceChangeDialog, setShowForceChangeDialog] = useState(false);

  // Reset password form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [forceChange, setForceChange] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Current password change form (for self)
  const [newSelfPassword, _setNewSelfPassword] = useState('');
  const [_selfPasswordStrength, setSelfPasswordStrength] = useState(0);

  // Calculate password strength
  const calculatePasswordStrength = (password: string) => {
    if (!password) {return 0;}

    let strength = 0;
    const checks = [
      password.length >= 8,
      password.length >= 12,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[@$!%*?&]/.test(password),
      password.length >= 16,
    ];

    strength = checks.filter(Boolean).length;
    return Math.min(strength, 5);
  };

  // Update password strength when password changes
  React.useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(newPassword));
  }, [newPassword]);

  React.useEffect(() => {
    setSelfPasswordStrength(calculatePasswordStrength(newSelfPassword));
  }, [newSelfPassword]);

  // Generate random password
  const generateRandomPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$!%*?&';
    let password = '';

    // Ensure at least one character from each required type
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '@$!%*?&'[Math.floor(Math.random() * 8)];

    // Fill the rest
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');

    setGeneratedPassword(password);
    setNewPassword(password);
    setConfirmPassword(password);
  };

  // Copy password to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Contraseña copiada al portapapeles');
  };

  // Get password strength color and text
  const getPasswordStrengthInfo = (strength: number) => {
    if (strength <= 2) {return { color: 'bg-red-500', text: 'Débil', textColor: 'text-red-500' };}
    if (strength <= 4) {return { color: 'bg-yellow-500', text: 'Media', textColor: 'text-yellow-500' };}
    return { color: 'bg-green-500', text: 'Fuerte', textColor: 'text-green-500' };
  };

  // Validate password
  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[@$!%*?&]/.test(password);

    return {
      minLength,
      hasLower,
      hasUpper,
      hasNumber,
      hasSpecial,
      isValid: minLength && hasLower && hasUpper && hasNumber && hasSpecial,
    };
  };

  // Reset user password
  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast.error('La contraseña no cumple con los requisitos mínimos');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword,
          reason: resetReason || 'Restablecimiento por administrador',
          forceChange,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al resetear la contraseña');
      }

      toast.success('Contraseña reseteada correctamente');
      setShowResetDialog(false);

      // Reset form
      setNewPassword('');
      setConfirmPassword('');
      setResetReason('');
      setForceChange(false);
      setGeneratedPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al resetear la contraseña');
    } finally {
      setLoading(false);
    }
  };

  // Force password change on next login
  const handleForcePasswordChange = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: '',
          reason: 'Forzar cambio de contraseña',
          forceChange: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al forzar cambio de contraseña');
      }

      toast.success('Se ha forzado el cambio de contraseña en el próximo inicio de sesión');
      setShowForceChangeDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al forzar cambio de contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Password Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Gestión de Contraseña
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Usuario</Label>
              <div className="text-sm text-muted-foreground">{userName}</div>
            </div>
            <div>
              <Label className="text-sm font-medium">Correo Electrónico</Label>
              <div className="text-sm text-muted-foreground">{userEmail}</div>
            </div>
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button
              onClick={() => setShowResetDialog(true)}
              variant="outline"
            >
              <Key className="h-4 w-4 mr-2" />
              Resetear Contraseña
            </Button>

            <Button
              onClick={() => setShowForceChangeDialog(true)}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Forzar Cambio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Requisitos de Contraseña
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Mínimo 8 caracteres</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Al menos una letra minúscula</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Al menos una letra mayúscula</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Al menos un número</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Al menos un carácter especial (@$!%*?&)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Consejos de seguridad:</strong> Usa contraseñas únicas, evita información personal,
          y considera el uso de un gestor de contraseñas. Las contraseñas generadas automáticamente
          son más seguras.
        </AlertDescription>
      </Alert>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resetear Contraseña</DialogTitle>
            <DialogDescription>
              Genera una nueva contraseña para {userName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Generate Password Section */}
            <div className="space-y-2">
              <Label>Generar Contraseña</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateRandomPassword}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generar Automática
                </Button>
                {generatedPassword && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedPassword)}
                  >
                    Copiar
                  </Button>
                )}
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label>Nueva Contraseña</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ingresar nueva contraseña"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {newPassword && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Fortaleza:</span>
                    <span className={`text-sm font-medium ${getPasswordStrengthInfo(passwordStrength).textColor}`}>
                      {getPasswordStrengthInfo(passwordStrength).text}
                    </span>
                  </div>
                  <Progress value={passwordStrength * 20} className="h-2" />
                </div>
              )}

              {newPassword && (
                <div className="space-y-1 text-xs">
                  {Object.entries(validatePassword(newPassword)).map(([key, valid]) => (
                    <div key={key} className="flex items-center gap-2">
                      {valid ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                      <span className={valid ? 'text-green-600' : 'text-red-600'}>
                        {key === 'minLength' && 'Mínimo 8 caracteres'}
                        {key === 'hasLower' && 'Una letra minúscula'}
                        {key === 'hasUpper' && 'Una letra mayúscula'}
                        {key === 'hasNumber' && 'Un número'}
                        {key === 'hasSpecial' && 'Un carácter especial'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label>Confirmar Contraseña</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar nueva contraseña"
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
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-red-500">Las contraseñas no coinciden</p>
              )}
            </div>

            {/* Reset Reason */}
            <div className="space-y-2">
              <Label>Razón del Reset</Label>
              <Input
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                placeholder="Ej: Solicitud del usuario, Política de seguridad, etc."
              />
            </div>

            {/* Force Change */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="forceChange"
                checked={forceChange}
                onChange={(e) => setForceChange(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="forceChange">
                Forzar cambio en el próximo inicio de sesión
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={loading || !newPassword || newPassword !== confirmPassword}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                  Resetenado...
                </div>
              ) : (
                'Resetear Contraseña'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force Password Change Dialog */}
      <Dialog open={showForceChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Forzar Cambio de Contraseña</DialogTitle>
            <DialogDescription>
              El usuario {userName} deberá cambiar su contraseña en el próximo inicio de sesión.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta acción no resetea la contraseña actual, solo obliga al usuario a cambiarla
              en el siguiente inicio de sesión.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForceChangeDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleForcePasswordChange}
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                  Procesando...
                </div>
              ) : (
                'Forzar Cambio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}