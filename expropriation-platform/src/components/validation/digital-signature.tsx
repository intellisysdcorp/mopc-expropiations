'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  PenTool,
  CheckCircle2,
  Clock,
  User,
  Shield,
  X
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

// Types
interface DigitalSignature {
  id: string;
  userId: string;
  signatureType: 'APPROVAL' | 'REJECTION' | 'REVIEW' | 'WITNESS' | 'CERTIFICATION' | 'VALIDATION';
  entityType: string;
  entityId: string;
  isActive: boolean;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
  delegatedBy?: string;
  delegationReason?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokedReason?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface DigitalSignatureProps {
  entityType: string;
  entityId: string;
  entityTitle: string;
  requiredSignatureType?: string;
  existingSignatures?: DigitalSignature[];
  onSignatureComplete?: (signature: DigitalSignature) => void;
  allowDelegation?: boolean;
}

export function DigitalSignature({
  entityType,
  entityId,
  entityTitle,
  requiredSignatureType,
  existingSignatures = [],
  onSignatureComplete,
  allowDelegation = false
}: DigitalSignatureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureType, setSignatureType] = useState<string>(requiredSignatureType || 'APPROVAL');
  const [comments, setComments] = useState('');
  const [password, setPassword] = useState('');
  const [delegateTo, setDelegateTo] = useState<string>('');
  const [delegationReason, setDelegationReason] = useState('');
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<string>('');
  const { toast } = useToast();

  // Initialize canvas
  const initCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Set drawing style
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    setCanvasRef(canvas);
  };

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef) return;
    setIsDrawing(true);

    const rect = canvasRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef) return;

    const rect = canvasRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Clear signature
  const clearSignature = () => {
    if (!canvasRef) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);
    setSignatureData('');
  };

  // Handle signature submission
  const handleSign = async () => {
    if (!signatureData && !password) {
      toast({
        title: 'Signature Required',
        description: 'Please provide a signature or password',
        variant: 'destructive',
      });
      return;
    }

    if (!signatureType) {
      toast({
        title: 'Signature Type Required',
        description: 'Please select a signature type',
        variant: 'destructive',
      });
      return;
    }

    // Check for delegation requirements
    if (allowDelegation && delegateTo && !delegationReason) {
      toast({
        title: 'Delegation Reason Required',
        description: 'Please provide a reason for delegation',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSigning(true);

      const signaturePayload = {
        signatureType,
        entityType,
        entityId,
        signatureData: signatureData || password, // Use password as signature data if no drawing
        comments,
        delegatedBy: delegateTo ? undefined : delegateTo, // This logic needs adjustment
        delegationReason: delegateTo ? delegationReason : undefined,
      };

      const response = await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signaturePayload),
      });

      if (response.ok) {
        const signature = await response.json();
        toast({
          title: 'Success',
          description: 'Digital signature created successfully',
        });

        // Reset form
        clearSignature();
        setComments('');
        setPassword('');
        setDelegateTo('');
        setDelegationReason('');
        setIsOpen(false);

        // Callback
        if (onSignatureComplete) {
          onSignatureComplete(signature);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create signature');
      }
    } catch (error) {
      clientLogger.error('Error creating signature:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create signature',
        variant: 'destructive',
      });
    } finally {
      setIsSigning(false);
    }
  };

  // Get signature type color
  const getSignatureTypeColor = (type: string) => {
    const colors = {
      APPROVAL: 'bg-green-100 text-green-800',
      REJECTION: 'bg-red-100 text-red-800',
      REVIEW: 'bg-blue-100 text-blue-800',
      WITNESS: 'bg-yellow-100 text-yellow-800',
      CERTIFICATION: 'bg-purple-100 text-purple-800',
      VALIDATION: 'bg-indigo-100 text-indigo-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Check if user has already signed
  const userHasSigned = existingSignatures.some(sig => sig.isActive);

  return (
    <div className="space-y-6">
      {/* Existing Signatures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Digital Signatures
          </CardTitle>
          <CardDescription>
            Signatures and approvals for {entityTitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {existingSignatures.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <PenTool className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No signatures yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {existingSignatures.map((signature) => (
                <div
                  key={signature.id}
                  className={`p-4 border rounded-lg ${
                    signature.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {signature.isActive ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <X className="h-5 w-5 text-red-600" />
                        )}
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">
                          {signature.user.firstName} {signature.user.lastName}
                        </span>
                        <span className="text-sm text-gray-500">
                          ({signature.user.email})
                        </span>
                      </div>
                      <Badge className={getSignatureTypeColor(signature.signatureType)}>
                        {signature.signatureType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      {new Date(signature.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {signature.delegationReason && (
                    <div className="mt-2 text-sm text-orange-600">
                      <strong>Delegation:</strong> {signature.delegationReason}
                    </div>
                  )}

                  {signature.revokedReason && (
                    <div className="mt-2 text-sm text-red-600">
                      <strong>Revoked:</strong> {signature.revokedReason}
                      {signature.revokedAt && (
                        <span className="ml-2">
                          on {new Date(signature.revokedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-500">
                    IP: {signature.ipAddress} • {signature.userAgent}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign Button */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Add Your Signature</h3>
              <p className="text-sm text-gray-500">
                {userHasSigned
                  ? 'You have already signed this document'
                  : 'Sign to approve or review this document'}
              </p>
            </div>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button disabled={userHasSigned}>
                  <PenTool className="h-4 w-4 mr-2" />
                  {userHasSigned ? 'Already Signed' : 'Sign Document'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Sign Document: {entityTitle}</DialogTitle>
                  <DialogDescription>
                    Create your digital signature for this document
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Signature Type */}
                  <div className="space-y-2">
                    <Label>Signature Type</Label>
                    <Select value={signatureType} onValueChange={setSignatureType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select signature type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPROVAL">Approval</SelectItem>
                        <SelectItem value="REJECTION">Rejection</SelectItem>
                        <SelectItem value="REVIEW">Review</SelectItem>
                        <SelectItem value="WITNESS">Witness</SelectItem>
                        <SelectItem value="CERTIFICATION">Certification</SelectItem>
                        <SelectItem value="VALIDATION">Validation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Signature Drawing */}
                  <div className="space-y-2">
                    <Label>Digital Signature</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <canvas
                        ref={initCanvas}
                        width={400}
                        height={200}
                        className="w-full h-32 border border-gray-300 rounded cursor-crosshair bg-white"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                      />
                      <div className="flex justify-between mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearSignature}
                        >
                          Clear
                        </Button>
                        <span className="text-sm text-gray-500">
                          Draw your signature above
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Alternative: Password Signature */}
                  <div className="space-y-2">
                    <Label>Or sign with password</Label>
                    <Input
                      type="password"
                      placeholder="Enter your password to sign"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {/* Comments */}
                  <div className="space-y-2">
                    <Label>Comments (Optional)</Label>
                    <Textarea
                      placeholder="Add any comments about your signature..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Delegation */}
                  {allowDelegation && (
                    <div className="space-y-4 p-4 border rounded-lg bg-yellow-50">
                      <Label className="text-yellow-800 font-medium">
                        Delegate Signature (Optional)
                      </Label>
                      <div className="space-y-2">
                        <Select value={delegateTo} onValueChange={setDelegateTo}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select user to delegate to" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* User options would go here */}
                          </SelectContent>
                        </Select>
                        <Textarea
                          placeholder="Reason for delegation..."
                          value={delegationReason}
                          onChange={(e) => setDelegationReason(e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                  )}

                  {/* Security Notice */}
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      This digital signature is legally binding and will be recorded with your
                      IP address, timestamp, and device information for audit purposes.
                    </AlertDescription>
                  </Alert>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSign}
                    disabled={isSigning || (!signatureData && !password)}
                  >
                    {isSigning ? (
                      <>
                        <div className="animate-spin h-4 w-4 mr-2" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Sign Document
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}