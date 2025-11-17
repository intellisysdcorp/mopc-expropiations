'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  FileText,
  Upload,
  Download,
  RefreshCw,
  Eye,
  Edit
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

// Types
interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  type: 'DOCUMENT' | 'ACTION' | 'VERIFICATION' | 'APPROVAL' | 'INSPECTION' | 'SIGNATURE' | 'PAYMENT' | 'NOTIFICATION';
  isRequired: boolean;
  sequence: number;
  estimatedTime?: number;
  validationRule?: string;
  attachmentRequired: boolean;
  attachmentTypes?: string[];
  dependencies?: string[];
  autoValidate: boolean;
  isActive: boolean;
}

interface ChecklistCompletion {
  id: string;
  itemId: string;
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  attachmentPath?: string;
  validationResult?: any;
  validationErrors?: any;
  item: ChecklistItem;
}

interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  stage: string;
  isActive: boolean;
  version: number;
  checklistItems: ChecklistItem[];
}

interface DynamicChecklistProps {
  caseId: string;
  stage: string;
  caseStageId: string;
  templateId?: string;
  editable?: boolean;
  onComplete?: (completions: ChecklistCompletion[]) => void;
}

export function DynamicChecklist({
  caseId,
  stage,
  caseStageId,
  templateId,
  editable = true,
  onComplete
}: DynamicChecklistProps) {
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [completions, setCompletions] = useState<ChecklistCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const { toast } = useToast();

  // Fetch checklist template and completions
  useEffect(() => {
    fetchChecklistData();
  }, [caseStageId]);

  const fetchChecklistData = async () => {
    try {
      setLoading(true);

      // Find template for the current stage
      const templateResponse = await fetch(`/api/checklist/templates?stage=${stage}&isActive=true`);
      if (templateResponse.ok) {
        const templates = await templateResponse.json();
        const currentTemplate = templates.find((t: ChecklistTemplate) =>
          templateId ? t.id === templateId : true
        ) || templates[0];

        if (currentTemplate) {
          setTemplate(currentTemplate);
        }
      }

      // Fetch existing completions
      const completionsResponse = await fetch(`/api/checklist/completions?caseStageId=${caseStageId}`);
      if (completionsResponse.ok) {
        const data = await completionsResponse.json();
        setCompletions(data);
      }
    } catch (error) {
      clientLogger.error('Error fetching checklist data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load checklist data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate progress
  const calculateProgress = () => {
    if (!template?.checklistItems.length) return 0;

    const requiredItems = template.checklistItems.filter(item => item.isRequired);
    const completedRequired = completions.filter(completion =>
      completion.isCompleted &&
      requiredItems.some(item => item.id === completion.itemId)
    );

    return requiredItems.length > 0
      ? Math.round((completedRequired.length / requiredItems.length) * 100)
      : 0;
  };

  // Toggle item completion
  const toggleItemCompletion = async (itemId: string, isCompleted: boolean) => {
    if (!editable) return;

    try {
      setSaving(true);

      const item = template?.checklistItems.find(i => i.id === itemId);
      if (!item) return;

      // Check dependencies
      if (isCompleted && item.dependencies) {
        const unmetDependencies = item.dependencies.filter(depId => {
          const depCompletion = completions.find(c => c.itemId === depId);
          return !depCompletion?.isCompleted;
        });

        if (unmetDependencies.length > 0) {
          toast({
            title: 'Dependencies Not Met',
            description: 'Please complete all required dependencies first',
            variant: 'destructive',
          });
          return;
        }
      }

      // Update completion
      const response = await fetch('/api/checklist/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseStageId,
          completions: [{
            itemId,
            isCompleted,
          }],
        }),
      });

      if (response.ok) {
        const updatedCompletions = await response.json();
        setCompletions(prev => {
          const newCompletions = [...prev];
          updatedCompletions.forEach((updated: ChecklistCompletion) => {
            const index = newCompletions.findIndex(c => c.itemId === updated.itemId);
            if (index >= 0) {
              newCompletions[index] = updated;
            } else {
              newCompletions.push(updated);
            }
          });
          return newCompletions;
        });

        toast({
          title: 'Success',
          description: `Checklist item ${isCompleted ? 'completed' : 'uncompleted'}`,
        });

        // Check if all required items are completed
        if (isComplete() && onComplete) {
          onComplete(completions);
        }
      } else {
        throw new Error('Failed to update completion');
      }
    } catch (error) {
      clientLogger.error('Error updating completion:', error);
      toast({
        title: 'Error',
        description: 'Failed to update checklist item',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Update item notes
  const updateItemNotes = async (itemId: string, notes: string) => {
    if (!editable) return;

    try {
      const completion = completions.find(c => c.itemId === itemId);
      if (!completion) return;

      const response = await fetch('/api/checklist/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseStageId,
          completions: [{
            itemId,
            isCompleted: completion.isCompleted,
            notes,
          }],
        }),
      });

      if (response.ok) {
        const updatedCompletions = await response.json();
        setCompletions(prev => {
          const newCompletions = [...prev];
          updatedCompletions.forEach((updated: ChecklistCompletion) => {
            const index = newCompletions.findIndex(c => c.itemId === updated.itemId);
            if (index >= 0) {
              newCompletions[index] = updated;
            }
          });
          return newCompletions;
        });
      }
    } catch (error) {
      clientLogger.error('Error updating notes:', error);
    }
  };

  // Check if checklist is complete
  const isComplete = () => {
    if (!template?.checklistItems.length) return false;

    const requiredItems = template.checklistItems.filter(item => item.isRequired);
    const completedRequired = completions.filter(completion =>
      completion.isCompleted &&
      requiredItems.some(item => item.id === completion.itemId)
    );

    return completedRequired.length === requiredItems.length;
  };

  // Get filtered items based on active tab
  const getFilteredItems = () => {
    if (!template?.checklistItems) return [];

    switch (activeTab) {
      case 'required':
        return template.checklistItems.filter(item => item.isRequired);
      case 'optional':
        return template.checklistItems.filter(item => !item.isRequired);
      case 'completed':
        return template.checklistItems.filter(item =>
          completions.some(c => c.itemId === item.id && c.isCompleted)
        );
      case 'pending':
        return template.checklistItems.filter(item =>
          !completions.some(c => c.itemId === item.id && c.isCompleted)
        );
      default:
        return template.checklistItems;
    }
  };

  // Get item completion status
  const getItemCompletion = (itemId: string) => {
    return completions.find(c => c.itemId === itemId);
  };

  // Get item status icon
  const getItemIcon = (item: ChecklistItem) => {
    const completion = getItemCompletion(item.id);

    if (completion?.isCompleted) {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }

    if (completion?.validationErrors) {
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    }

    return <Circle className="h-5 w-5 text-gray-400" />;
  };

  // Get item type badge color
  const getTypeColor = (type: string) => {
    const colors = {
      DOCUMENT: 'bg-blue-100 text-blue-800',
      ACTION: 'bg-green-100 text-green-800',
      VERIFICATION: 'bg-yellow-100 text-yellow-800',
      APPROVAL: 'bg-purple-100 text-purple-800',
      INSPECTION: 'bg-orange-100 text-orange-800',
      SIGNATURE: 'bg-red-100 text-red-800',
      PAYMENT: 'bg-indigo-100 text-indigo-800',
      NOTIFICATION: 'bg-gray-100 text-gray-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading checklist...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No checklist template available for this stage.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const progress = calculateProgress();
  const filteredItems = getFilteredItems();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {template.name}
                <Badge variant="outline">v{template.version}</Badge>
              </CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{progress}%</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-2" />
          <div className="mt-2 flex justify-between text-sm text-gray-500">
            <span>
              {completions.filter(c => c.isCompleted).length} of {template.checklistItems.length} items
            </span>
            {isComplete() && (
              <Badge className="bg-green-100 text-green-800">
                All Required Items Complete
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Items</TabsTrigger>
          <TabsTrigger value="required">Required</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="optional">Optional</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredItems.map((item) => {
            const completion = getItemCompletion(item.id);
            const isCompleted = completion?.isCompleted || false;
            const hasError = completion?.validationErrors;

            return (
              <Card key={item.id} className={hasError ? 'border-red-200' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <div className="pt-1">
                      {editable ? (
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={(checked) =>
                            toggleItemCompletion(item.id, checked as boolean)
                          }
                          disabled={saving}
                        />
                      ) : (
                        getItemIcon(item)
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{item.title}</h3>
                        <Badge className={getTypeColor(item.type)}>
                          {item.type}
                        </Badge>
                        {item.isRequired && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                        {item.estimatedTime && (
                          <div className="flex items-center text-sm text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            {item.estimatedTime}m
                          </div>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-sm text-gray-600">{item.description}</p>
                      )}

                      {/* Validation errors */}
                      {hasError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Validation failed. Please review the requirements.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Notes */}
                      {editable && (
                        <div className="space-y-2">
                          <Label htmlFor={`notes-${item.id}`}>Notes</Label>
                          <Textarea
                            id={`notes-${item.id}`}
                            placeholder="Add notes about this item..."
                            value={completion?.notes || ''}
                            onChange={(e) => updateItemNotes(item.id, e.target.value)}
                            rows={2}
                          />
                        </div>
                      )}

                      {/* Attachments */}
                      {item.attachmentRequired && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-orange-600">
                            <Upload className="h-3 w-3 mr-1" />
                            Attachment Required
                          </Badge>
                          {completion?.attachmentPath && (
                            <Button variant="outline" size="sm">
                              <Download className="h-3 w-3 mr-1" />
                              View Attachment
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Dependencies */}
                      {item.dependencies && item.dependencies.length > 0 && (
                        <div className="text-sm text-gray-500">
                          Depends on: {item.dependencies.join(', ')}
                        </div>
                      )}

                      {/* Completion info */}
                      {isCompleted && completion?.completedAt && (
                        <div className="text-sm text-green-600">
                          Completed on {new Date(completion.completedAt).toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedItem(item)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Item Details Modal */}
      {selectedItem && (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedItem.title}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedItem(null)}
              >
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedItem.description && (
              <div>
                <Label>Description</Label>
                <p className="text-sm text-gray-600">{selectedItem.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Badge className={getTypeColor(selectedItem.type)}>
                  {selectedItem.type}
                </Badge>
              </div>
              <div>
                <Label>Required</Label>
                <Badge variant={selectedItem.isRequired ? 'destructive' : 'outline'}>
                  {selectedItem.isRequired ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>

            {selectedItem.validationRule && (
              <div>
                <Label>Validation Rule</Label>
                <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                  {selectedItem.validationRule}
                </p>
              </div>
            )}

            {selectedItem.attachmentTypes && selectedItem.attachmentTypes.length > 0 && (
              <div>
                <Label>Allowed File Types</Label>
                <div className="flex flex-wrap gap-1">
                  {selectedItem.attachmentTypes.map((type, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}