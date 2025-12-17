'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Activity,
  RefreshCw,
} from 'lucide-react';

// Import validation components
import { DynamicChecklist } from './dynamic-checklist';
import { DigitalSignature } from './digital-signature';
import { TimeTrackingDashboard } from './time-tracking-dashboard';
import { ParallelReview } from './parallel-review';
import { ApprovalMatrix } from './approval-matrix';
import { ObservationSystem } from './observation-system';
import { ValidationEngine } from './validation-engine';
import { RiskAssessment } from './risk-assessment';

// Types
interface CaseValidationSummary {
  caseId: string;
  caseTitle: string;
  currentStage: string;
  overallProgress: number;
  checklistProgress: number;
  approvalProgress: number;
  reviewProgress: number;
  validationProgress: number;
  riskScore: number;
  openObservations: number;
  pendingSignatures: number;
  overdueItems: number;
  lastValidation: string;
  nextDeadline?: string;
  status: 'COMPLIANT' | 'WARNING' | 'CRITICAL' | 'BLOCKED';
}

interface ValidationDashboardProps {
  caseId: string;
  caseStage: string | null;
  caseTitle?: string;
  editable?: boolean;
  refreshInterval?: number;
  validationSummary?: CaseValidationSummary | null;
  onValidationComplete?: () => void | Promise<void>;
}

export function ValidationDashboard({
  caseId,
  caseStage,
  caseTitle,
  editable = true,
  refreshInterval = 30000,
  validationSummary,
  onValidationComplete
}: ValidationDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Refresh all validation data
  const refreshAll = async () => {
    setRefreshing(true);

    // Call the onValidationComplete callback to refresh data in parent
    if (onValidationComplete) {
      await onValidationComplete();
    }

    // Force refresh of all child components
    window.dispatchEvent(new CustomEvent('refreshValidationData'));

    setRefreshing(false);
    toast({
      title: 'Refreshed',
      description: 'Validation data has been updated',
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors = {
      COMPLIANT: 'bg-green-100 text-green-800',
      WARNING: 'bg-yellow-100 text-yellow-800',
      CRITICAL: 'bg-red-100 text-red-800',
      BLOCKED: 'bg-red-200 text-red-900',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLIANT':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'WARNING':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'CRITICAL':
      case 'BLOCKED':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  if (!validationSummary) {
    return (
      <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 mr-2" />
              <span>Loading validation dashboard...</span>
            </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Validation & Control Dashboard
              </CardTitle>
              <CardDescription>
                {caseTitle ? `Case: ${caseTitle}` : `Case ID: ${caseId}`}
                {caseStage && ` • Stage: ${caseStage}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={refreshAll}
                disabled={refreshing}
              >
                {refreshing ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </>
                )}
              </Button>
              {validationSummary && (
                <Badge className={getStatusColor(validationSummary.status)}>
                  {getStatusIcon(validationSummary.status)}
                  {validationSummary.status}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        {validationSummary && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Overall Progress */}
              <div className="text-center">
                <div className="text-3xl font-bold mb-2">
                  {validationSummary.overallProgress}%
                </div>
                <div className="text-sm text-gray-500 mb-2">
                  Overall Progress
                </div>
                <Progress value={validationSummary.overallProgress} className="h-2" />
              </div>

              {/* Risk Score */}
              <div className="text-center">
                <div
                  className={`text-3xl font-bold mb-2 ${
                    validationSummary.riskScore >= 70
                      ? 'text-red-600'
                      : validationSummary.riskScore >= 40
                        ? 'text-yellow-600'
                        : 'text-green-600'
                  }`}
                >
                  {validationSummary.riskScore}
                </div>
                <div className="text-sm text-gray-500 mb-2">Risk Score</div>
                <div className="flex justify-center">
                  <Badge
                    className={
                      validationSummary.riskScore >= 70
                        ? 'bg-red-100 text-red-800'
                        : validationSummary.riskScore >= 40
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                    }
                  >
                    {validationSummary.riskScore >= 70
                      ? 'High Risk'
                      : validationSummary.riskScore >= 40
                        ? 'Medium Risk'
                        : 'Low Risk'}
                  </Badge>
                </div>
              </div>

              {/* Open Issues */}
              <div className="text-center">
                <div className="text-3xl font-bold mb-2 text-orange-600">
                  {validationSummary.openObservations + validationSummary.overdueItems}
                </div>
                <div className="text-sm text-gray-500 mb-2">Open Issues</div>
                <div className="text-xs text-gray-500">
                  {validationSummary.openObservations} observations •{' '}
                  {validationSummary.overdueItems} overdue
                </div>
              </div>

              {/* Pending Actions */}
              <div className="text-center">
                <div className="text-3xl font-bold mb-2 text-blue-600">
                  {validationSummary.pendingSignatures}
                </div>
                <div className="text-sm text-gray-500 mb-2">
                  Pending Actions
                </div>
                <div className="text-xs text-gray-500">
                  Signatures and approvals
                </div>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Checklist</span>
                  <span>{validationSummary.checklistProgress}%</span>
                </div>
                <Progress value={validationSummary.checklistProgress} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Approvals</span>
                  <span>{validationSummary.approvalProgress}%</span>
                </div>
                <Progress value={validationSummary.approvalProgress} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Reviews</span>
                  <span>{validationSummary.reviewProgress}%</span>
                </div>
                <Progress value={validationSummary.reviewProgress} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Validation</span>
                  <span>{validationSummary.validationProgress}%</span>
                </div>
                <Progress value={validationSummary.validationProgress} className="h-2" />
              </div>
            </div>

            {/* Alerts */}
            {(validationSummary.openObservations > 0 ||
              validationSummary.overdueItems > 0 ||
              validationSummary.riskScore >= 70) && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {validationSummary.riskScore >= 70 && 'High risk level detected. '}
                  {validationSummary.overdueItems > 0 &&
                    `${validationSummary.overdueItems} overdue items require attention. `}
                  {validationSummary.openObservations > 0 &&
                    `${validationSummary.openObservations} observations are pending resolution. `}
                  Please review the details below.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
          <TabsTrigger value="time">Time Tracking</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="observations">Observations</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {caseStage && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Validation Engine */}
              <ValidationEngine
                caseId={caseId}
                stage={caseStage}
              />

              {/* Risk Assessment Summary */}
              <RiskAssessment
                caseId={caseId}
                stage={caseStage}
                showAnalytics={true}
                onRiskUpdate={() => onValidationComplete && onValidationComplete()}
              />
            </div>
          )}

          {/* Time Tracking Overview */}
          <TimeTrackingDashboard
            caseId={caseId}
            refreshInterval={refreshInterval}
          />
        </TabsContent>

        <TabsContent value="checklist" className="mt-6">
          {/* Find case stage assignment */}
          <DynamicChecklist
            caseId={caseId}
            stage={caseStage || ''}
            caseStageId={caseId} // This would normally be the case stage assignment ID
            editable={editable}
            onComplete={() => onValidationComplete && onValidationComplete()}
          />
        </TabsContent>

        <TabsContent value="signatures" className="mt-6">
          <DigitalSignature
            entityType="case"
            entityId={caseId}
            entityTitle={caseTitle || `Case ${caseId}`}
            onSignatureComplete={() => onValidationComplete && onValidationComplete()}
            allowDelegation={editable}
          />
        </TabsContent>

        <TabsContent value="time" className="mt-6">
          <TimeTrackingDashboard
            caseId={caseId}
            refreshInterval={refreshInterval}
          />
        </TabsContent>

        {caseStage && (
          <>
            <TabsContent value="reviews" className="mt-6">
              <ParallelReview
                caseId={caseId}
                caseStage={caseStage}
                onReviewComplete={() => onValidationComplete && onValidationComplete()}
              />
            </TabsContent>

            <TabsContent value="approvals" className="mt-6">
              <ApprovalMatrix
                caseId={caseId}
                editable={editable}
                onApprovalUpdate={() => onValidationComplete && onValidationComplete()}
              />
            </TabsContent>

            <TabsContent value="observations" className="mt-6">
              <ObservationSystem
                caseId={caseId}
                stage={caseStage}
                allowCreate={editable}
                allowRespond={editable}
                onObservationUpdate={() => onValidationComplete && onValidationComplete()}
              />
            </TabsContent>

            <TabsContent value="risk" className="mt-6">
              <RiskAssessment
                caseId={caseId}
                stage={caseStage}
                autoAssess={false}
                showAnalytics={true}
                onRiskUpdate={() => onValidationComplete && onValidationComplete()}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}