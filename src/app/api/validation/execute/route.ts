import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType } from '@/prisma/client';
import { logger } from '@/lib/logger';
import { Prisma } from '@/prisma/client';

// POST /api/validation/execute - Execute validation rules
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Get validation rules
    const rules = await prisma.validationRule.findMany({
      where: {
        id: { in: body.ruleIds },
        isActive: true,
      },
    });
    
    if (rules.length === 0) {
      return NextResponse.json(
        { error: 'No active validation rules found' },
        { status: 404 }
      );
    }

    const case_ = await prisma.case.findFirst({
      where: {
        id: body.caseId
      },
    });

    if (!case_) {
      return NextResponse.json(
        { error: 'A case with the provided ID was NOT found.' },
        { status: 404 }
      );
    }

    const startTime = Date.now();
    const executions = [];
    let passedCount = 0;
    let failedCount = 0;

    // Execute each rule
    for (const rule of rules) {
      try {
        // Evaluate the rule expression (simplified implementation)
        const evaluationResult = evaluateRule(rule, body.context);
        const payloadData: Prisma.ValidationExecutionCreateInput = {
          stage: body.stage,
          entityType: body.entityType,
          entityId: body.entityId || body.caseId,
          context: body.context,
          passed: evaluationResult.passed,
          errors: evaluationResult.errors,
          warnings: evaluationResult.warnings,
          executedBy: session.user.id,
          rule: { connect: { id: rule.id } },
          case: { connect: { id: case_.id } }
        }

        const execution = await prisma.validationExecution.create({
          data: payloadData,
          include: {
            rule: true,
          },
        });

        executions.push(execution);

        if (evaluationResult.passed) {
          passedCount++;
        } else {
          failedCount++;
        }

      } catch (error) {
        logger.error(`Error executing rule ${rule.id}:`, error);

        const execution = await prisma.validationExecution.create({
          data: {
            ruleId: rule.id,
            caseId: body.caseId,
            stage: body.stage,
            entityType: body.entityType,
            entityId: body.entityId || body.caseId,
            context: body.context,
            passed: false,
            errors: { message: 'Rule execution failed', error: error instanceof Error ? error.message : 'Unknown error' },
            executedBy: session.user.id,
          },
          include: {
            rule: true,
          },
        });

        executions.push(execution);
        failedCount++;
      }
    }

    const executionTime = Date.now() - startTime;

    // Calculate summary
    const summary = {
      total: executions.length,
      passed: passedCount,
      failed: failedCount,
      warnings: executions.filter(e => e.warnings && Object.keys(e.warnings).length > 0).length,
      executionTime,
      coverage: Math.round((passedCount / executions.length) * 100),
    };

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.UPDATED,
        entityType: 'validation_execution',
        entityId: executions[0]?.id || '',
        description: `Executed ${executions.length} validation rules for case ${body.caseId}`,
        userId: session.user.id,
        caseId: body.caseId,
        metadata: {
          summary,
          ruleIds: body.ruleIds,
        },
      },
    });

    return NextResponse.json({
      executions,
      summary,
      executionTime,
    });
  } catch (error) {

    logger.error('Error executing validation:', error);
    return NextResponse.json(
      { error: 'Failed to execute validation' },
      { status: 500 }
    );
  }
}

// Simplified rule evaluation function
function evaluateRule(rule: any, context?: any): { passed: boolean; errors?: any; warnings?: any } {
  try {
    // This is a simplified implementation
    // In a real system, you would use a proper expression evaluator
    // or implement custom logic for each rule type

    switch (rule.type) {
      case 'REQUIRED_FIELD':
        // Check if required fields are present
        return evaluateRequiredFieldRule(rule, context);

      case 'DOCUMENT_COMPLETENESS':
        // Check document completeness
        return evaluateDocumentCompletenessRule(rule, context);

      case 'BUSINESS_RULE':
        // Evaluate business rules
        return evaluateBusinessRule(rule, context);

      case 'TIME_LIMIT':
        // Check time limits
        return evaluateTimeLimitRule(rule, context);

      case 'FINANCIAL_THRESHOLD':
        // Check financial thresholds
        return evaluateFinancialThresholdRule(rule, context);

      default:
        // Default: rule passes
        return { passed: true };
    }
  } catch (error) {
    return {
      passed: false,
      errors: { message: 'Rule evaluation failed', error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

// Helper functions for rule evaluation
function evaluateRequiredFieldRule(rule: any, context?: any) {
  if (!context) return { passed: false, errors: { message: 'No context provided for required field validation' } };

  // Parse the expression to get required fields
  const requiredFields = rule.expression.split(',').map((f: string) => f.trim());
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!context[field]) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      passed: false,
      errors: {
        message: rule.errorMessage,
        missingFields
      }
    };
  }

  return { passed: true };
}

function evaluateDocumentCompletenessRule(rule: any, context?: any) {
  if (!context || !context.documents) {
    return { passed: false, errors: { message: 'No documents found' } };
  }

  // Simplified document completeness check
  const requiredDocs = rule.expression.split(',').map((d: string) => d.trim());
  const existingDocs = context.documents || [];

  const missingDocs = requiredDocs.filter((doc: string) =>
    !existingDocs.some((existing: any) => existing.type === doc)
  );

  if (missingDocs.length > 0) {
    return {
      passed: false,
      errors: {
        message: rule.errorMessage,
        missingDocuments: missingDocs
      }
    };
  }

  return { passed: true };
}

function evaluateBusinessRule(rule: any, context?: any) {
  if (!context) return { passed: false, errors: { message: 'No context for business rule validation' } };

  // This would contain custom business logic
  // For now, just return a basic evaluation
  try {
    // Very simplified evaluation - in reality you'd use a proper expression evaluator
    const result = JSON.parse(rule.expression);
    const passed = evaluateCondition(result, context);

    if (!passed) {
      return {
        passed: false,
        errors: { message: rule.errorMessage }
      };
    }

    return { passed: true };
  } catch (_) {
    return {
      passed: false,
      errors: { message: 'Invalid business rule expression' }
    };
  }
}

function evaluateTimeLimitRule(rule: any, context?: any) {
  if (!context || !context.startDate) {
    return { passed: false, errors: { message: 'No start date provided' } };
  }

  const startDate = new Date(context.startDate);
  const now = new Date();
  const daysElapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const maxDays = parseInt(rule.expression);

  if (daysElapsed > maxDays) {
    return {
      passed: false,
      errors: {
        message: rule.errorMessage,
        daysElapsed,
        maxDays
      }
    };
  }

  // Check if approaching deadline
  const warningThreshold = maxDays * 0.8; // 80% of max time
  if (daysElapsed > warningThreshold) {
    return {
      passed: true,
      warnings: {
        message: `Approaching deadline: ${daysElapsed} of ${maxDays} days elapsed`
      }
    };
  }

  return { passed: true };
}

function evaluateFinancialThresholdRule(rule: any, context?: any) {
  if (!context || !context.estimatedValue) {
    return { passed: false, errors: { message: 'No financial value provided' } };
  }

  const threshold = parseFloat(rule.expression);
  const value = parseFloat(context.estimatedValue);

  if (value > threshold) {
    return {
      passed: false,
      errors: {
        message: rule.errorMessage,
        value,
        threshold
      }
    };
  }

  return { passed: true };
}

function evaluateCondition(condition: any, context: any): boolean {
  // Very simplified condition evaluator
  if (condition.field && condition.operator && condition.value) {
    const fieldValue = context[condition.field];

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'greaterThan':
        return parseFloat(fieldValue) > parseFloat(condition.value);
      case 'lessThan':
        return parseFloat(fieldValue) < parseFloat(condition.value);
      case 'contains':
        return String(fieldValue).includes(condition.value);
      default:
        return false;
    }
  }

  return false;
}