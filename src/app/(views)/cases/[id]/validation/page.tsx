'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { ValidationDashboard } from '@/components/validation/validation-dashboard';
import { Card, CardContent } from '@/components/ui/card';
import clientLogger from '@/lib/client-logger';

interface Props {
  params: Promise<{
    id: string;
  }>;
}

interface CaseInfo {
  id: string;
  fileNumber: string;
  title: string;
  currentStage: string | null;
  estimatedValue: number | null;
  currency: string | null;
}

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

export default function ValidationPage({ params }: Props) {
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [validationSummary, setValidationSummary] = useState<CaseValidationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchValidationData = async () => {
      try {
        const { id } = await params;

        // Fetch case information
        const caseResponse = await fetch(`/api/cases/${id}`);
        if (!caseResponse.ok) {
          if (caseResponse.status === 404) {
            notFound();
          }
          throw new Error('Failed to fetch case information');
        }

        const caseData = await caseResponse.json();
        const caseInfoData: CaseInfo = {
          id: caseData.id,
          fileNumber: caseData.fileNumber,
          title: caseData.title,
          currentStage: caseData.currentStage,
          estimatedValue: caseData.estimatedValue,
          currency: caseData.currency,
        };

        setCaseInfo(caseInfoData);

        // Fetch validation summary
        const validationResponse = await fetch(`/api/cases/${id}/validation-summary`);
        if (validationResponse.ok) {
          const validationData = await validationResponse.json();
          setValidationSummary(validationData);
        } else {
          // Validation summary not found is not a critical error
          clientLogger.warn('Validation summary not available', { caseId: id });
        }

        // Update page title
        if (typeof window !== 'undefined') {
          document.title = `Validation Dashboard - ${caseData.fileNumber} - ${caseData.title}`;
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          clientLogger.error('Error fetching validation data:', err);
          setError(err.message);
        } else {
          clientLogger.error('Error fetching validation data:', { err });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchValidationData();
  }, [params]);

  const onValidationComplete = async () => {
    try {
      const { id } = await params;
      const response = await fetch(`/api/cases/${id}/validation-summary`);
      if (response.ok) {
        const data = await response.json();
        setValidationSummary(data);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      clientLogger.error('Error refreshing validation summary:', error);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 mr-2" />
              <span>Loading case information...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !caseInfo) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p>Failed to load case information</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Validation Dashboard</h1>
        <p className="text-muted-foreground">
          Case {caseInfo.fileNumber} - {caseInfo.title}
        </p>
      </div>

      <ValidationDashboard
        caseId={caseInfo.id}
        caseStage={caseInfo.currentStage}
        caseTitle={caseInfo.title}
        editable={true}
        refreshInterval={30000}
        validationSummary={validationSummary}
        onValidationComplete={onValidationComplete}
      />
    </div>
  );
}