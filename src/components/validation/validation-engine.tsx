'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  XCircle,
  AlertTriangle,
  Play,
  Settings,
  Shield,
  Activity,
  List,
  Eye,
  Zap
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

// Types
interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  type: 'REQUIRED_FIELD' | 'DOCUMENT_COMPLETENESS' | 'BUSINESS_RULE' | 'REGULATORY_COMPLIANCE' | 'TIME_LIMIT' | 'FINANCIAL_THRESHOLD' | 'APPROVAL_MATRIX';
  stage?: string;
  expression: string;
  errorMessage: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  isActive: boolean;
  version: number;
  dependsOn?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ValidationExecution {
  id: string;
  ruleId: string;
  caseId: string;
  stage?: string;
  entityType: string;
  entityId: string;
  context?: any;
  passed: boolean;
  errors?: any;
  warnings?: any;
  executedBy?: string;
  executedAt: string;
  rule: ValidationRule;
}

interface ValidationSummary {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  info: number;
  executionTime: number;
  coverage: number;
}

interface ValidationEngineProps {
  caseId: string;
  stage?: string;
  entityType?: string;
  entityId?: string;
  autoRun?: boolean;
  showDetails?: boolean;
  onValidationComplete?: (summary: ValidationSummary, executions: ValidationExecution[]) => void;
}

export function ValidationEngine({
  caseId,
  stage,
  entityType = 'case',
  entityId,
  autoRun = false,
  onValidationComplete
}: ValidationEngineProps) {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [executions, setExecutions] = useState<ValidationExecution[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [_loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRule, setSelectedRule] = useState<ValidationRule | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const { toast } = useToast();

  // Fetch validation rules
  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (stage) params.append('stage', stage);
      params.append('isActive', 'true');

      const response = await fetch(`/api/validation/rules?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching validation rules:', error);
      }
      toast({
        title: 'Error',
        description: 'Failed to fetch validation rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [stage, toast]);

  // Fetch validation executions
  const fetchExecutions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('caseId', caseId);
      if (stage) params.append('stage', stage);
      if (entityType) params.append('entityType', entityType);
      if (entityId) params.append('entityId', entityId);

      const response = await fetch(`/api/validation/executions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setExecutions(data);
        calculateSummary(data);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching validation executions:', error);
      }
    }
  }, [caseId, entityId, entityType, stage]);

  // Run validation
  const runValidation = useCallback(async () => {
    try {
      setValidating(true);

      const payload = {
        caseId,
        stage,
        entityType,
        entityId,
        ruleIds: rules.map(r => r.id), // Run all active rules
      };

      const response = await fetch('/api/validation/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setExecutions(data.executions);
        calculateSummary(data.executions);

        toast({
          title: 'Validation Complete',
          description: `Validated ${data.executions.length} rules in ${data.executionTime}ms`,
        });

        // Callback
        if (onValidationComplete) {
          onValidationComplete(data.summary, data.executions);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Validation failed');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error running validation:', error);
      }
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Validation failed',
        variant: 'destructive',
      });
    } finally {
      setValidating(false);
    }
  }, [caseId, entityId, entityType, onValidationComplete, rules, stage, toast]);

  // Calculate summary
  const calculateSummary = (executions: ValidationExecution[]) => {
    if (!executions.length) {
      setSummary(null);
      return;
    }

    const summary: ValidationSummary = {
      total: executions.length,
      passed: executions.filter(e => e.passed).length,
      failed: executions.filter(e => !e.passed && e.rule?.severity === 'ERROR').length,
      warnings: executions.filter(e => !e.passed && e.rule?.severity === 'WARNING').length,
      info: executions.filter(e => !e.passed && e.rule?.severity === 'INFO').length,
      executionTime: executions.reduce((sum, e) => sum + (e.executedAt ? 1 : 0), 0), // Simplified
      coverage: Math.round((executions.filter(e => e.passed).length / executions.length) * 100),
    };

    setSummary(summary);
  };

  // Filter executions
  const getFilteredExecutions = () => {
    let filtered = [...executions];

    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.rule.type === filterType);
    }

    if (filterSeverity !== 'all') {
      filtered = filtered.filter(e => e.rule.severity === filterSeverity);
    }

    return filtered.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
  };

  // Get rule type color
  const getRuleTypeColor = (type: string) => {
    const colors = {
      REQUIRED_FIELD: 'bg-red-100 text-red-800',
      DOCUMENT_COMPLETENESS: 'bg-blue-100 text-blue-800',
      BUSINESS_RULE: 'bg-green-100 text-green-800',
      REGULATORY_COMPLIANCE: 'bg-purple-100 text-purple-800',
      TIME_LIMIT: 'bg-yellow-100 text-yellow-800',
      FINANCIAL_THRESHOLD: 'bg-orange-100 text-orange-800',
      APPROVAL_MATRIX: 'bg-indigo-100 text-indigo-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    const colors = {
      ERROR: 'bg-red-100 text-red-800',
      WARNING: 'bg-yellow-100 text-yellow-800',
      INFO: 'bg-blue-100 text-blue-800',
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  useEffect(() => {
    fetchRules();
    fetchExecutions();
  }, [fetchRules, fetchExecutions]);

  useEffect(() => {
    if (autoRun && rules.length > 0) {
      runValidation();
    }
  }, [autoRun, rules, runValidation]);

  const filteredExecutions = getFilteredExecutions();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Rules</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
                <List className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Passed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {summary.passed}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Failed</p>
                  <p className="text-2xl font-bold text-red-600">
                    {summary.failed}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Coverage</p>
                  <p className="text-2xl font-bold">{summary.coverage}%</p>
                </div>
                <Shield className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Validation Engine
              </CardTitle>
              <CardDescription>
                Automated validation for case {caseId}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="REQUIRED_FIELD">
                      Required Field
                    </SelectItem>
                    <SelectItem value="DOCUMENT_COMPLETENESS">
                      Document
                    </SelectItem>
                    <SelectItem value="BUSINESS_RULE">Business Rule</SelectItem>
                    <SelectItem value="REGULATORY_COMPLIANCE">
                      Compliance
                    </SelectItem>
                    <SelectItem value="TIME_LIMIT">Time Limit</SelectItem>
                    <SelectItem value="FINANCIAL_THRESHOLD">
                      Financial
                    </SelectItem>
                    <SelectItem value="APPROVAL_MATRIX">Approval</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filterSeverity}
                  onValueChange={setFilterSeverity}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={runValidation}
                disabled={validating || !rules.length}
              >
                {validating ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Validation
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {summary && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Validation Progress</span>
                <span className="text-sm text-gray-500">
                  {summary.coverage}%
                </span>
              </div>
              <Progress value={summary.coverage} className="h-2" />
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>{summary.passed} passed</span>
                <span>
                  {summary.failed + summary.warnings + summary.info} issues
                </span>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="executions">Executions</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-6">
              {summary && summary.failed > 0 && (
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {summary.failed} validation rules failed. Please review the
                    issues below.
                  </AlertDescription>
                </Alert>
              )}

              {summary && summary.warnings > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {summary.warnings} warnings detected. These may need
                    attention.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {summary && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Execution Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span>Total Rules Executed:</span>
                            <span className="font-medium">{summary.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Passed:</span>
                            <span className="font-medium text-green-600">
                              {summary.passed}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Failed (Errors):</span>
                            <span className="font-medium text-red-600">
                              {summary.failed}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Warnings:</span>
                            <span className="font-medium text-yellow-600">
                              {summary.warnings}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Info:</span>
                            <span className="font-medium text-blue-600">
                              {summary.info}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Performance Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span>Coverage:</span>
                            <span className="font-medium">
                              {summary.coverage}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Execution Time:</span>
                            <span className="font-medium">
                              {summary.executionTime}ms
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Last Run:</span>
                            <span className="font-medium">
                              {executions.length > 0 ? new Date(
                                Math.max(
                                  ...executions.map((e) => new Date(e.executedAt).getTime())
                                )).toLocaleString()
                                : 'Never'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="executions" className="space-y-4 mt-6">
              {filteredExecutions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No validation executions found</p>
                  <p className="text-sm mt-2">
                    Run validation to see execution results
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredExecutions.map((execution) => (
                    <Card
                      key={execution.id}
                      className={
                        execution.passed ? 'border-green-200' : 'border-red-200'
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {execution.passed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <div className="font-medium">
                                {execution.rule.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {execution.rule.description}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  className={getRuleTypeColor(
                                    execution.rule.type
                                  )}
                                >
                                  {execution.rule.type.replace('_', ' ')}
                                </Badge>
                                <Badge
                                  className={getSeverityColor(
                                    execution.rule.severity
                                  )}
                                >
                                  {execution.rule.severity}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  {new Date(
                                    execution.executedAt
                                  ).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRule(execution.rule)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                        </div>

                        {!execution.passed && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-800">
                              <strong>Error:</strong>{' '}
                              {execution.rule.errorMessage}
                            </p>
                            {execution.errors && (
                              <div className="mt-1 text-xs text-red-600">
                                {JSON.stringify(execution.errors, null, 2)}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rules" className="space-y-4 mt-6">
              {rules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No validation rules found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rules.map((rule) => (
                    <Card key={rule.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="font-medium">{rule.name}</div>
                              <div className="text-sm text-gray-500">
                                {rule.description}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={getRuleTypeColor(rule.type)}>
                                  {rule.type.replace('_', ' ')}
                                </Badge>
                                <Badge
                                  className={getSeverityColor(rule.severity)}
                                >
                                  {rule.severity}
                                </Badge>
                                <Badge
                                  variant={
                                    rule.isActive ? 'default' : 'secondary'
                                  }
                                >
                                  {rule.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRule(rule)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View Rule
                          </Button>
                        </div>

                        <div className="mt-3 p-2 bg-gray-50 rounded text-xs font-mono">
                          {rule.expression}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Rule Details Dialog */}
      {selectedRule && (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedRule.name}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRule(null)}
              >
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRule.description && (
              <div>
                <Label>Description</Label>
                <p className="text-sm text-gray-600">
                  {selectedRule.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Badge className={getRuleTypeColor(selectedRule.type)}>
                  {selectedRule.type.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <Label>Severity</Label>
                <Badge className={getSeverityColor(selectedRule.severity)}>
                  {selectedRule.severity}
                </Badge>
              </div>
            </div>

            <div>
              <Label>Validation Expression</Label>
              <div className="p-3 bg-gray-50 rounded font-mono text-sm">
                {selectedRule.expression}
              </div>
            </div>

            <div>
              <Label>Error Message</Label>
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                {selectedRule.errorMessage}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
              <div>
                <Label>Version</Label>
                <p>v{selectedRule.version}</p>
              </div>
              <div>
                <Label>Status</Label>
                <p>{selectedRule.isActive ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}