'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  TrendingUp,
  Shield,
  BarChart3,
  Eye,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

// Types
interface RiskAssessment {
  id: string;
  caseId: string;
  stage?: string;
  riskFactors: any;
  riskLevel: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'CRITICAL';
  riskScore: number;
  likelihood: number; // 1-5 scale
  impact: number; // 1-5 scale
  urgency: number; // 1-5 scale
  description: string;
  mitigation?: string;
  contingency?: string;
  assessedBy: string;
  assessmentDate: string;
  validUntil?: string;
  recommendations?: any;
  status: 'ACTIVE' | 'MITIGATED' | 'ACCEPTED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  alerts: RiskAlert[];
  assessor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface RiskAlert {
  id: string;
  riskAssessmentId: string;
  alertType: 'DEADLINE_APPROACHING' | 'DEADLINE_EXCEEDED' | 'DOCUMENT_MISSING' | 'VALIDATION_FAILED' | 'APPROVAL_REQUIRED' | 'RISK_IDENTIFIED' | 'OBSERVATION_OVERDUE' | 'ESCALATION_REQUIRED';
  title: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isActive: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  sendEmail: boolean;
  sendSMS: boolean;
  recipients?: any;
  triggerConditions?: any;
  escalationRules?: any;
  createdAt: string;
  updatedAt: string;
}

interface RiskAnalytics {
  overview: {
    totalAssessments: number;
    activeRisks: number;
    mitigatedRisks: number;
    averageRiskScore: number;
    highRiskCount: number;
    criticalRiskCount: number;
  };
  byLevel: Record<string, number>;
  byStage: Record<string, {
    count: number;
    averageScore: number;
    highRiskCount: number;
  }>;
  byTrend: Array<{
    date: string;
    score: number;
    count: number;
  }>;
  topRiskFactors: Array<{
    factor: string;
    count: number;
    averageImpact: number;
  }>;
}

interface RiskAssessmentProps {
  caseId: string;
  stage?: string;
  autoAssess?: boolean;
  showAnalytics?: boolean;
  onRiskUpdate?: (assessment: RiskAssessment) => void;
}

export function RiskAssessment({
  caseId,
  stage,
  autoAssess = false,
  showAnalytics = true,
  onRiskUpdate
}: RiskAssessmentProps) {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [analytics, setAnalytics] = useState<RiskAnalytics | null>(null);
  const [_loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [_selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [assessmentData, setAssessmentData] = useState({
    likelihood: 3,
    impact: 3,
    urgency: 3,
    description: '',
    mitigation: '',
    contingency: '',
    recommendations: '',
    validUntil: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch risk assessments
  const fetchAssessments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/risk-assessments?caseId=${caseId}`);
      if (response.ok) {
        const data = await response.json();
        setAssessments(data);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching risk assessments:', error);        
      }
      toast({
        title: 'Error',
        description: 'Failed to fetch risk assessments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [caseId, toast]);

  // Fetch risk analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/risk-assessments/analytics?caseId=${caseId}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching risk analytics:', error);
      }
    }
  }, [caseId]);

  // Run risk assessment
  const runAssessment = useCallback(async () => {
    try {
      setAssessing(true);

      const payload = {
        caseId,
        stage,
        autoAssess: true,
      };

      const response = await fetch('/api/risk-assessments/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const assessment = await response.json();
        toast({
          title: 'Risk Assessment Complete',
          description: `Risk level: ${assessment.riskLevel} (Score: ${assessment.riskScore})`,
        });

        // Refresh data
        fetchAssessments();
        fetchAnalytics();

        // Callback
        if (onRiskUpdate) {
          onRiskUpdate(assessment);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Risk assessment failed');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error running risk assessment:', error);
      }
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Risk assessment failed',
        variant: 'destructive',
      });
    } finally {
      setAssessing(false);
    }
  }, [caseId, fetchAnalytics, fetchAssessments, onRiskUpdate, stage, toast]);

  // Create manual assessment
  const createAssessment = async () => {
    if (!assessmentData.description) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a description',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Calculate risk score based on likelihood, impact, and urgency
      const riskScore = (assessmentData.likelihood + assessmentData.impact + assessmentData.urgency) * 6.67; // Scale to 0-100

      // Determine risk level
      let riskLevel: string;
      if (riskScore >= 80) riskLevel = 'CRITICAL';
      else if (riskScore >= 65) riskLevel = 'VERY_HIGH';
      else if (riskScore >= 50) riskLevel = 'HIGH';
      else if (riskScore >= 35) riskLevel = 'MEDIUM';
      else if (riskScore >= 20) riskLevel = 'LOW';
      else riskLevel = 'VERY_LOW';

      const payload = {
        caseId,
        stage,
        likelihood: assessmentData.likelihood,
        impact: assessmentData.impact,
        urgency: assessmentData.urgency,
        description: assessmentData.description,
        mitigation: assessmentData.mitigation || undefined,
        contingency: assessmentData.contingency || undefined,
        recommendations: assessmentData.recommendations ? JSON.parse(assessmentData.recommendations) : undefined,
        validUntil: assessmentData.validUntil ? new Date(assessmentData.validUntil).toISOString() : undefined,
        riskLevel,
        riskScore,
        riskFactors: {
          likelihood: assessmentData.likelihood,
          impact: assessmentData.impact,
          urgency: assessmentData.urgency,
        },
      };

      const response = await fetch('/api/risk-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const assessment = await response.json();
        toast({
          title: 'Success',
          description: `Risk assessment created: ${riskLevel} (Score: ${riskScore.toFixed(1)})`,
        });

        // Reset form
        setAssessmentData({
          likelihood: 3,
          impact: 3,
          urgency: 3,
          description: '',
          mitigation: '',
          contingency: '',
          recommendations: '',
          validUntil: '',
        });
        setIsDialogOpen(false);

        // Refresh data
        fetchAssessments();
        fetchAnalytics();

        // Callback
        if (onRiskUpdate) {
          onRiskUpdate(assessment);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create assessment');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error creating assessment:', error);
      }
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create assessment',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get risk level color
  const getRiskLevelColor = (level: string) => {
    const colors = {
      VERY_LOW: 'bg-green-100 text-green-800',
      LOW: 'bg-blue-100 text-blue-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      HIGH: 'bg-orange-100 text-orange-800',
      VERY_HIGH: 'bg-red-100 text-red-800',
      CRITICAL: 'bg-red-200 text-red-900',
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    const colors = {
      LOW: 'bg-blue-100 text-blue-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      HIGH: 'bg-orange-100 text-orange-800',
      CRITICAL: 'bg-red-100 text-red-800',
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };
  // Get critical risks
  const getCriticalRisks = () => {
    return assessments.filter(a => a.riskLevel === 'CRITICAL' || a.riskLevel === 'VERY_HIGH');
  };

  useEffect(() => {
    fetchAssessments();
    if (showAnalytics) {
      fetchAnalytics();
    }
  }, [fetchAssessments, fetchAnalytics, showAnalytics]);

  useEffect(() => {
    if (autoAssess) {
      runAssessment();
    }
  }, [autoAssess, runAssessment]);

  const criticalRisks = getCriticalRisks();

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Risks</p>
                  <p className="text-2xl font-bold">{analytics.overview.activeRisks}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Critical Risks</p>
                  <p className="text-2xl font-bold text-red-600">{analytics.overview.criticalRiskCount}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Risk Score</p>
                  <p className="text-2xl font-bold">{analytics.overview.averageRiskScore.toFixed(1)}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Mitigated</p>
                  <p className="text-2xl font-bold text-green-600">{analytics.overview.mitigatedRisks}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
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
                <Shield className="h-5 w-5" />
                Risk Assessment & Management
              </CardTitle>
              <CardDescription>
                Assess and monitor risks for case {caseId}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={runAssessment}
                disabled={assessing}
              >
                {assessing ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2" />
                    Assessing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Auto Assess
                  </>
                )}
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Assessment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Risk Assessment</DialogTitle>
                    <DialogDescription>
                      Manually assess risks for this case
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Likelihood (1-5)</Label>
                        <Select
                          value={assessmentData.likelihood.toString()}
                          onValueChange={(value) => setAssessmentData(prev => ({ ...prev, likelihood: parseInt(value) }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Very Low</SelectItem>
                            <SelectItem value="2">2 - Low</SelectItem>
                            <SelectItem value="3">3 - Medium</SelectItem>
                            <SelectItem value="4">4 - High</SelectItem>
                            <SelectItem value="5">5 - Very High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Impact (1-5)</Label>
                        <Select
                          value={assessmentData.impact.toString()}
                          onValueChange={(value) => setAssessmentData(prev => ({ ...prev, impact: parseInt(value) }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Very Low</SelectItem>
                            <SelectItem value="2">2 - Low</SelectItem>
                            <SelectItem value="3">3 - Medium</SelectItem>
                            <SelectItem value="4">4 - High</SelectItem>
                            <SelectItem value="5">5 - Very High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Urgency (1-5)</Label>
                        <Select
                          value={assessmentData.urgency.toString()}
                          onValueChange={(value) => setAssessmentData(prev => ({ ...prev, urgency: parseInt(value) }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Very Low</SelectItem>
                            <SelectItem value="2">2 - Low</SelectItem>
                            <SelectItem value="3">3 - Medium</SelectItem>
                            <SelectItem value="4">4 - High</SelectItem>
                            <SelectItem value="5">5 - Very High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Textarea
                        placeholder="Describe the risk factors..."
                        value={assessmentData.description}
                        onChange={(e) => setAssessmentData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Mitigation Strategy</Label>
                      <Textarea
                        placeholder="How can this risk be mitigated?"
                        value={assessmentData.mitigation}
                        onChange={(e) => setAssessmentData(prev => ({ ...prev, mitigation: e.target.value }))}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Contingency Plan</Label>
                      <Textarea
                        placeholder="What is the backup plan if this risk materializes?"
                        value={assessmentData.contingency}
                        onChange={(e) => setAssessmentData(prev => ({ ...prev, contingency: e.target.value }))}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Valid Until</Label>
                      <Input
                        type="datetime-local"
                        value={assessmentData.validUntil}
                        onChange={(e) => setAssessmentData(prev => ({ ...prev, validUntil: e.target.value }))}
                      />
                    </div>
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
                      onClick={createAssessment}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Creating...' : 'Create Assessment'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Critical Alerts */}
          {criticalRisks.length > 0 && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {criticalRisks.length} critical risks require immediate attention.
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assessments">Assessments</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-6">
              {analytics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Risk by Level */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Risk Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(analytics.byLevel)
                          .sort(([a], [b]) => {
                            const order = ['CRITICAL', 'VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'];
                            return order.indexOf(a) - order.indexOf(b);
                          })
                          .map(([level, count]) => (
                            <div key={level} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge className={getRiskLevelColor(level)}>
                                  {level.replace('_', ' ')}
                                </Badge>
                                <span className="text-sm text-gray-500">{count} risks</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Risk Factors */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Top Risk Factors</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {analytics.topRiskFactors.slice(0, 5).map((factor, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{factor.factor}</div>
                              <div className="text-sm text-gray-500">
                                {factor.count} occurrences • Avg impact: {factor.averageImpact.toFixed(1)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="assessments" className="space-y-4 mt-6">
              {assessments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No risk assessments found</p>
                  <p className="text-sm mt-2">Run an assessment to identify risks</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assessments.map((assessment) => (
                    <Card
                      key={assessment.id}
                      className={
                        assessment.status === 'ACTIVE' && assessment.riskLevel === 'CRITICAL'
                          ? 'border-red-200'
                          : ''
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            {/* Header */}
                            <div className="flex items-center gap-3">
                              <Badge className={getRiskLevelColor(assessment.riskLevel)}>
                                {assessment.riskLevel.replace('_', ' ')}
                              </Badge>
                              <Badge variant="outline">
                                Score: {assessment.riskScore.toFixed(1)}
                              </Badge>
                              <Badge variant={assessment.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {assessment.status}
                              </Badge>
                              {assessment.validUntil && new Date(assessment.validUntil) < new Date() && (
                                <Badge variant="destructive" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Expired
                                </Badge>
                              )}
                            </div>

                            {/* Description */}
                            <div>
                              <h3 className="font-medium mb-2">{assessment.description}</h3>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Likelihood:</span>
                                  <div className="flex items-center mt-1">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-blue-500 h-2 rounded-full"
                                        style={{ width: `${(assessment.likelihood / 5) * 100}%` }}
                                      />
                                    </div>
                                    <span className="ml-2">{assessment.likelihood}/5</span>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-500">Impact:</span>
                                  <div className="flex items-center mt-1">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-orange-500 h-2 rounded-full"
                                        style={{ width: `${(assessment.impact / 5) * 100}%` }}
                                      />
                                    </div>
                                    <span className="ml-2">{assessment.impact}/5</span>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-500">Urgency:</span>
                                  <div className="flex items-center mt-1">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-red-500 h-2 rounded-full"
                                        style={{ width: `${(assessment.urgency / 5) * 100}%` }}
                                      />
                                    </div>
                                    <span className="ml-2">{assessment.urgency}/5</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Mitigation and Contingency */}
                            {(assessment.mitigation || assessment.contingency) && (
                              <div className="grid grid-cols-2 gap-4">
                                {assessment.mitigation && (
                                  <div className="bg-blue-50 p-3 rounded">
                                    <p className="text-sm font-medium text-blue-800 mb-1">Mitigation:</p>
                                    <p className="text-sm text-blue-700">{assessment.mitigation}</p>
                                  </div>
                                )}
                                {assessment.contingency && (
                                  <div className="bg-yellow-50 p-3 rounded">
                                    <p className="text-sm font-medium text-yellow-800 mb-1">Contingency:</p>
                                    <p className="text-sm text-yellow-700">{assessment.contingency}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Active Alerts */}
                            {assessment.alerts.some(alert => alert.isActive) && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-red-600">Active Alerts:</p>
                                {assessment.alerts
                                  .filter(alert => alert.isActive)
                                  .map((alert) => (
                                    <div key={alert.id} className="bg-red-50 p-2 rounded border border-red-200">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-sm font-medium text-red-800">{alert.title}</p>
                                          <p className="text-xs text-red-600">{alert.message}</p>
                                        </div>
                                        <Badge className={getSeverityColor(alert.severity)}>
                                          {alert.severity}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <div>
                                Assessed by: {assessment.assessor.firstName} {assessment.assessor.lastName}
                              </div>
                              <div>
                                {new Date(assessment.assessmentDate).toLocaleDateString()}
                                {assessment.validUntil && (
                                  <span> • Valid until {new Date(assessment.validUntil).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedAssessment(assessment)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4 mt-6">
              {analytics ? (
                <div className="space-y-6">
                  {/* Risk Trend */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Risk Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Risk trend chart would be displayed here</p>
                          <p className="text-sm">Integration with charting library needed</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Risk by Stage */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Risk by Stage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(analytics.byStage).map(([stageName, data]) => (
                          <div key={stageName} className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium">{stageName}</span>
                                <span className="text-sm text-gray-500">
                                  {data.count} risks • Avg: {data.averageScore.toFixed(1)}
                                </span>
                              </div>
                              <Progress
                                value={(data.averageScore / 100) * 100}
                                className="h-2"
                              />
                            </div>
                            {data.highRiskCount > 0 && (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                {data.highRiskCount} high
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No analytics data available</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}