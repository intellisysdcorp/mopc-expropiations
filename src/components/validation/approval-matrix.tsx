'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  Eye,
  Shield,
  CheckCircle2,
  Info,
  X
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

// Types
interface ApprovalLevel {
  id: string;
  name: string;
  description: string;
  minAmount: number;
  maxAmount: number;
  requiredApprovers: number;
  approverRoles: string[];
  approverDepartments: string[];
  autoApprove: boolean;
  autoApproveConditions: any;
  escalationRules: any;
  isActive: boolean;
  sequence: number;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalMatrix {
  id: string;
  name: string;
  description: string;
  entityType: string;
  levels: ApprovalLevel[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CaseApprovalRequirement {
  caseId: string;
  caseType: string;
  estimatedValue: number;
  currency: string;
  requiredLevel: string;
  requiredApprovers: number;
  autoApprove: boolean;
  currentApprovals: number;
  pendingApprovals: number;
  completedApprovals: number;
  nextLevel?: ApprovalLevel;
  status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';
}

interface ApprovalMatrixProps {
  caseId?: string;
  caseType?: string;
  estimatedValue?: number;
  currency?: string;
  editable?: boolean;
  showHistory?: boolean;
  onApprovalUpdate?: (requirement: CaseApprovalRequirement) => void;
}

export function ApprovalMatrix({
  caseId,
  caseType = 'EXPROPRIATION',
  estimatedValue = 0,
  currency = 'DOP',
  editable = false,
  showHistory = false,
}: ApprovalMatrixProps) {
  const [matrices, setMatrices] = useState<ApprovalMatrix[]>([]);
  const [currentMatrix, setCurrentMatrix] = useState<ApprovalMatrix | null>(null);
  const [requirement, setRequirement] = useState<CaseApprovalRequirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('current');
  const [selectedLevel, setSelectedLevel] = useState<ApprovalLevel | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [levelData, setLevelData] = useState({
    name: '',
    description: '',
    minAmount: 0,
    maxAmount: 0,
    requiredApprovers: 1,
    approverRoles: [] as string[],
    approverDepartments: [] as string[],
    autoApprove: false,
    autoApproveConditions: '',
    escalationRules: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

    // Calculate approval requirement
  const calculateRequirement = useCallback((matrix: ApprovalMatrix, value: number) => {
    const applicableLevel = matrix.levels
      .filter((level) => level.isActive)
      .find(
        (level) =>
          value >= level.minAmount &&
          (level.maxAmount === 0 || value <= level.maxAmount)
      );

    if (!applicableLevel) {
      setRequirement(null);
      return;
    }

    // Calculate current approval status (this would normally come from the API)
    const requirementBase: CaseApprovalRequirement = {
      caseId: caseId || '',
      caseType,
      estimatedValue: value,
      currency,
      requiredLevel: applicableLevel.name,
      requiredApprovers: applicableLevel.requiredApprovers,
      autoApprove: applicableLevel.autoApprove,
      currentApprovals: 0, // This would be calculated from actual approvals
      pendingApprovals: applicableLevel.requiredApprovers,
      completedApprovals: 0,
      status: 'PENDING',
    };

    const nextLevelCandidate = matrix.levels
      .filter((level) => level.isActive)
      .find(
        (level) =>
          level.sequence > applicableLevel.sequence && value >= level.minAmount
      );

    const requirement: CaseApprovalRequirement = nextLevelCandidate
      ? { ...requirementBase, nextLevel: nextLevelCandidate }
      : requirementBase;

    setRequirement(requirement);
  }, [caseId, caseType, currency]);

  // Fetch approval matrices
  const fetchMatrices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/approval-matrices');
      if (response.ok) {
        const data = await response.json();
        setMatrices(data);

        // Find matrix for current case type
        const matrix = data.find((m: ApprovalMatrix) => m.entityType === caseType);
        if (matrix) {
          setCurrentMatrix(matrix);
          calculateRequirement(matrix, estimatedValue);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching approval matrices:', error);
      }
      toast({
        title: 'Error',
        description: 'Failed to fetch approval matrices',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [calculateRequirement, caseType, estimatedValue, toast]);



  // Create approval level
  const createLevel = async () => {
    if (!currentMatrix || !levelData.name) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        matrixId: currentMatrix.id,
        ...levelData,
        autoApproveConditions: levelData.autoApproveConditions ? JSON.parse(levelData.autoApproveConditions) : undefined,
        escalationRules: levelData.escalationRules ? JSON.parse(levelData.escalationRules) : undefined,
        sequence: Math.max(...currentMatrix.levels.map(l => l.sequence)) + 1,
      };

      const response = await fetch('/api/approval-matrices/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const newLevel = await response.json();
        toast({
          title: 'Success',
          description: 'Approval level created successfully',
        });

        // Update matrix
        setCurrentMatrix(prev => prev ? {
          ...prev,
          levels: [...prev.levels, newLevel]
        } : null);

        // Reset form
        setLevelData({
          name: '',
          description: '',
          minAmount: 0,
          maxAmount: 0,
          requiredApprovers: 1,
          approverRoles: [],
          approverDepartments: [],
          autoApprove: false,
          autoApproveConditions: '',
          escalationRules: '',
        });
        setIsDialogOpen(false);

        // Recalculate requirement
        if (currentMatrix) {
          calculateRequirement(currentMatrix, estimatedValue);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create approval level');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error creating approval level:', error);
      }
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create approval level',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update approval level
  const updateLevel = async () => {
    if (!selectedLevel) return;

    try {
      setIsSubmitting(true);

      const payload = {
        ...levelData,
        autoApproveConditions: levelData.autoApproveConditions ? JSON.parse(levelData.autoApproveConditions) : undefined,
        escalationRules: levelData.escalationRules ? JSON.parse(levelData.escalationRules) : undefined,
      };

      const response = await fetch(`/api/approval-matrices/levels/${selectedLevel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const updatedLevel = await response.json();
        toast({
          title: 'Success',
          description: 'Approval level updated successfully',
        });

        // Update matrix
        setCurrentMatrix(prev => prev ? {
          ...prev,
          levels: prev.levels.map(l => l.id === selectedLevel.id ? updatedLevel : l)
        } : null);

        // Reset form
        setSelectedLevel(null);
        setLevelData({
          name: '',
          description: '',
          minAmount: 0,
          maxAmount: 0,
          requiredApprovers: 1,
          approverRoles: [],
          approverDepartments: [],
          autoApprove: false,
          autoApproveConditions: '',
          escalationRules: '',
        });
        setIsEditDialogOpen(false);

        // Recalculate requirement
        if (currentMatrix) {
          calculateRequirement(currentMatrix, estimatedValue);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update approval level');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error updating approval level:', error);
      }
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update approval level',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete approval level
  const deleteLevel = async (levelId: string) => {
    if (!confirm('Are you sure you want to delete this approval level?')) return;

    try {
      const response = await fetch(`/api/approval-matrices/levels/${levelId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Approval level deleted successfully',
        });

        // Update matrix
        setCurrentMatrix(prev => prev ? {
          ...prev,
          levels: prev.levels.filter(l => l.id !== levelId)
        } : null);

        // Recalculate requirement
        if (currentMatrix) {
          calculateRequirement(currentMatrix, estimatedValue);
        }
      } else {
        throw new Error('Failed to delete approval level');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error deleting approval level:', error);
      }
      toast({
        title: 'Error',
        description: 'Failed to delete approval level',
        variant: 'destructive',
      });
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  useEffect(() => {
    fetchMatrices();
  }, [fetchMatrices]);

  useEffect(() => {
    if (currentMatrix) {
      calculateRequirement(currentMatrix, estimatedValue);
    }
  }, [currentMatrix, estimatedValue, calculateRequirement]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 mr-2" />
            <span>Loading approval matrix...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Requirement */}
      {requirement && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Current Approval Requirement
            </CardTitle>
            <CardDescription>
              Based on case type and estimated value
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label>Case Value</Label>
                <div className="text-2xl font-bold">
                  {formatCurrency(requirement.estimatedValue)}
                </div>
              </div>
              <div>
                <Label>Required Level</Label>
                <div className="text-2xl font-bold text-blue-600">
                  {requirement.requiredLevel}
                </div>
                <div className="text-sm text-gray-500">
                  {requirement.requiredApprovers} approvers required
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getStatusColor(requirement.status)}>
                    {requirement.status.replace('_', ' ')}
                  </Badge>
                  {requirement.autoApprove && (
                    <Badge variant="outline" className="text-green-600">
                      Auto-approve
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {requirement.nextLevel && (
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This case also requires higher-level approval ({requirement.nextLevel.name})
                  if value exceeds {formatCurrency(requirement.nextLevel.minAmount)}.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Approval Matrix Configuration
              </CardTitle>
              <CardDescription>
                Define approval levels and requirements for {caseType}
              </CardDescription>
            </div>
            {editable && currentMatrix && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Level
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Approval Level</DialogTitle>
                    <DialogDescription>
                      Create a new approval level for the matrix
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Level Name *</Label>
                        <Input
                          value={levelData.name}
                          onChange={(e) => setLevelData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Manager Approval"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Required Approvers *</Label>
                        <Input
                          type="number"
                          value={levelData.requiredApprovers}
                          onChange={(e) => setLevelData(prev => ({ ...prev, requiredApprovers: parseInt(e.target.value) }))}
                          min="1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Minimum Amount ({currency})</Label>
                        <Input
                          type="number"
                          value={levelData.minAmount}
                          onChange={(e) => setLevelData(prev => ({ ...prev, minAmount: parseFloat(e.target.value) }))}
                          min="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Maximum Amount ({currency})</Label>
                        <Input
                          type="number"
                          value={levelData.maxAmount}
                          onChange={(e) => setLevelData(prev => ({ ...prev, maxAmount: parseFloat(e.target.value) }))}
                          min="0"
                          placeholder="0 for no limit"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={levelData.description}
                        onChange={(e) => setLevelData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe this approval level..."
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="autoApprove"
                        checked={levelData.autoApprove}
                        onChange={(e) => setLevelData(prev => ({ ...prev, autoApprove: e.target.checked }))}
                      />
                      <Label htmlFor="autoApprove">Enable auto-approval</Label>
                    </div>

                    {levelData.autoApprove && (
                      <div className="space-y-2">
                        <Label>Auto-approval Conditions (JSON)</Label>
                        <Textarea
                          value={levelData.autoApproveConditions}
                          onChange={(e) => setLevelData(prev => ({ ...prev, autoApproveConditions: e.target.value }))}
                          placeholder='{"userRole": "MANAGER", "department": "FINANCE"}'
                          rows={3}
                        />
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={createLevel}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Creating...' : 'Create Level'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="current">Current Matrix</TabsTrigger>
              <TabsTrigger value="levels">All Levels</TabsTrigger>
              <TabsTrigger value="history">Approval History</TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-4 mt-6">
              {currentMatrix ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">{currentMatrix.name}</h3>
                    <Badge variant={currentMatrix.isActive ? 'default' : 'secondary'}>
                      {currentMatrix.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-gray-600">{currentMatrix.description}</p>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Level</TableHead>
                        <TableHead>Amount Range</TableHead>
                        <TableHead>Required Approvers</TableHead>
                        <TableHead>Auto-Approve</TableHead>
                        <TableHead>Status</TableHead>
                        {editable && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentMatrix.levels
                        .filter(level => level.isActive)
                        .sort((a, b) => a.minAmount - b.minAmount)
                        .map((level) => (
                          <TableRow key={level.id}>
                            <TableCell className="font-medium">
                              {level.name}
                              {requirement?.requiredLevel === level.name && (
                                <Badge className="ml-2 text-xs">Current</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(level.minAmount)} - {' '}
                              {level.maxAmount > 0 ? formatCurrency(level.maxAmount) : '∞'}
                            </TableCell>
                            <TableCell>{level.requiredApprovers}</TableCell>
                            <TableCell>
                              {level.autoApprove ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <X className="h-4 w-4 text-gray-400" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">Active</Badge>
                            </TableCell>
                            {editable && (
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedLevel(level);
                                      setLevelData({
                                        name: level.name,
                                        description: level.description,
                                        minAmount: level.minAmount,
                                        maxAmount: level.maxAmount,
                                        requiredApprovers: level.requiredApprovers,
                                        approverRoles: level.approverRoles,
                                        approverDepartments: level.approverDepartments,
                                        autoApprove: level.autoApprove,
                                        autoApproveConditions: JSON.stringify(level.autoApproveConditions || {}),
                                        escalationRules: JSON.stringify(level.escalationRules || {}),
                                      });
                                      setIsEditDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteLevel(level.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No approval matrix configured for this case type</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="levels" className="space-y-4 mt-6">
              <div className="space-y-4">
                {matrices.map((matrix) => (
                  <Card key={matrix.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{matrix.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{matrix.entityType}</Badge>
                          <Badge variant={matrix.isActive ? 'default' : 'secondary'}>
                            {matrix.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 mb-4">{matrix.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {matrix.levels.map((level) => (
                          <div key={level.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{level.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                Level {level.sequence}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div>
                                <span className="text-gray-500">Range: </span>
                                {formatCurrency(level.minAmount)} - {' '}
                                {level.maxAmount > 0 ? formatCurrency(level.maxAmount) : '∞'}
                              </div>
                              <div>
                                <span className="text-gray-500">Approvers: </span>
                                {level.requiredApprovers}
                              </div>
                              {level.autoApprove && (
                                <div className="text-green-600">
                                  <CheckCircle2 className="h-3 w-3 inline mr-1" />
                                  Auto-approve enabled
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-6">
              {showHistory ? (
                <div className="space-y-4">
                  {/* Approval history would be displayed here */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Approval history would be displayed here when showHistory is enabled.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Approval history not available</p>
                  <p className="text-sm mt-2">Enable showHistory to see approval history</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Level Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Approval Level</DialogTitle>
            <DialogDescription>
              Update approval level configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Same form fields as create dialog */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Level Name *</Label>
                <Input
                  value={levelData.name}
                  onChange={(e) => setLevelData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Required Approvers *</Label>
                <Input
                  type="number"
                  value={levelData.requiredApprovers}
                  onChange={(e) => setLevelData(prev => ({ ...prev, requiredApprovers: parseInt(e.target.value) }))}
                  min="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Amount ({currency})</Label>
                <Input
                  type="number"
                  value={levelData.minAmount}
                  onChange={(e) => setLevelData(prev => ({ ...prev, minAmount: parseFloat(e.target.value) }))}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum Amount ({currency})</Label>
                <Input
                  type="number"
                  value={levelData.maxAmount}
                  onChange={(e) => setLevelData(prev => ({ ...prev, maxAmount: parseFloat(e.target.value) }))}
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={levelData.description}
                onChange={(e) => setLevelData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={updateLevel}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Level'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}