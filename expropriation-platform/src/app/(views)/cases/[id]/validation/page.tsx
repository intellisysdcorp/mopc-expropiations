import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ValidationDashboard } from '@/components/validation/validation-dashboard';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const caseInfo = await prisma.case.findUnique({
    where: { id: (await params).id },
    select: {
      fileNumber: true,
      title: true,
    },
  });

  if (!caseInfo) {
    return {
      title: 'Case Not Found',
    };
  }

  return {
    title: `Validation Dashboard - ${caseInfo.fileNumber} - ${caseInfo.title}`,
    description: 'Comprehensive validation and control system for expropriation cases',
  };
}

export default async function ValidationPage({ params }: Props) {
  const caseInfo = await prisma.case.findUnique({
    where: { id: (await params).id },
    select: {
      id: true,
      fileNumber: true,
      title: true,
      currentStage: true,
      estimatedValue: true,
      currency: true,
    },
  });

  if (!caseInfo) {
    notFound();
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
        autoRefresh={true}
        refreshInterval={30000}
      />
    </div>
  );
}