import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { isAfter } from 'date-fns';
import { logger } from '@/lib/logger';

const calendarSchema = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  filters: z.object({
    types: z.array(z.string()).optional(),
    priorities: z.array(z.string()).optional(),
    departments: z.array(z.string()).optional(),
    showCompleted: z.boolean().default(true),
  }).optional(),
});

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'deadline' | 'meeting' | 'milestone' | 'reminder';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'completed' | 'overdue';
  description?: string;
  caseId?: string;
  caseNumber?: string;
  assignedTo?: string;
  department?: string;
}

// Helper function to determine priority from case priority
function getPriorityFromCase(casePriority: string): 'low' | 'medium' | 'high' | 'urgent' {
  switch (casePriority) {
    case 'URGENT': return 'urgent';
    case 'HIGH': return 'high';
    case 'MEDIUM': return 'medium';
    case 'LOW': return 'low';
    default: return 'medium';
  }
}

// Helper function to calculate deadlines based on case stages
function calculateStageDeadlines(currentCase: any): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const now = new Date();

  // Calculate expected deadlines for each stage (simplified logic)
  const stageDeadlines: Record<string, number> = {
    'RECEPCION_SOLICITUD': 1, // 1 day
    'VERIFICACION_REQUISITOS': 3, // 3 days
    'CARGA_DOCUMENTOS': 5, // 5 days
    'ASIGNACION_ANALISTA': 2, // 2 days
    'ANALISIS_PRELIMINAR': 7, // 7 days
    'NOTIFICACION_PROPIETARIO': 3, // 3 days
    'PERITAJE_TECNICO': 10, // 10 days
    'DETERMINACION_VALOR': 5, // 5 days
    'OFERTA_COMPRA': 3, // 3 days
    'NEGOCIACION': 14, // 14 days
    'APROBACION_ACUERDO': 5, // 5 days
    'ELABORACION_ESCRITURA': 7, // 7 days
    'FIRMA_DOCUMENTOS': 3, // 3 days
    'REGISTRO_PROPIEDAD': 10, // 10 days
    'DESEMBOLSO_PAGO': 5, // 5 days
    'ENTREGA_INMUEBLE': 3, // 3 days
    'CIERRE_ARCHIVO': 2, // 2 days
  };

  // Add deadline for current stage
  if (currentCase.currentStage && stageDeadlines[currentCase.currentStage]) {
    const deadlineDate = new Date(currentCase.updatedAt);
    deadlineDate.setDate(deadlineDate.getDate() + stageDeadlines[currentCase.currentStage]!);

    if (isAfter(deadlineDate, now)) {
      events.push({
        id: `deadline-${currentCase.id}`,
        title: `Plazo: ${currentCase.currentStage.replace(/_/g, ' ')}`,
        date: deadlineDate.toISOString(),
        type: 'deadline',
        priority: getPriorityFromCase(currentCase.priority),
        status: isAfter(deadlineDate, now) ? 'pending' : 'overdue',
        description: `Plazo para completar la etapa actual del caso ${currentCase.fileNumber}`,
        caseId: currentCase.id,
        caseNumber: currentCase.fileNumber,
        assignedTo: `${currentCase.assignedTo?.firstName} ${currentCase.assignedTo?.lastName}`.trim(),
        department: currentCase.department?.name,
      });
    }
  }

  // Add expected end date if exists
  if (currentCase.expectedEndDate) {
    events.push({
      id: `enddate-${currentCase.id}`,
      title: `Fecha límite del caso`,
      date: currentCase.expectedEndDate.toISOString(),
      type: 'milestone',
      priority: getPriorityFromCase(currentCase.priority),
      status: isAfter(new Date(currentCase.expectedEndDate), now) ? 'pending' : 'overdue',
      description: `Fecha esperada de finalización del caso ${currentCase.fileNumber}`,
      caseId: currentCase.id,
      caseNumber: currentCase.fileNumber,
      assignedTo: `${currentCase.assignedTo?.firstName} ${currentCase.assignedTo?.lastName}`.trim(),
      department: currentCase.department?.name,
    });
  }

  return events;
}

// Helper function to get meeting events
async function getMeetingEvents(startDate: Date, endDate: Date, session: any): Promise<CalendarEvent[]> {
  const where: any = {
    scheduledDate: {
      gte: startDate,
      lte: endDate,
    },
  };

  // Department-based access control
  if (session.user.role !== 'SUPER_ADMIN') {
    where.OR = [
      { organizerId: session.user.id },
      {
        participants: {
          some: {
            userId: session.user.id
          }
        }
      },
      {
        case: {
          department: {
            OR: [
              { id: session.user.departmentId },
              { parentId: session.user.departmentId }
            ]
          }
        }
      }
    ];
  }

  const meetings = await prisma.meeting.findMany({
    where: {
      scheduledStart: {
        gte: startDate,
        lte: endDate,
      },
      ...(session.user.role !== 'SUPER_ADMIN' && {
        OR: [
          { organizerId: session.user.id },
          {
            participants: {
              some: {
                userId: session.user.id
              }
            }
          },
          {
            case: {
              department: {
                OR: [
                  { id: session.user.departmentId },
                  { parentId: session.user.departmentId }
                ]
              }
            }
          }
        ]
      })
    },
    include: {
      organizer: {
        select: {
          firstName: true,
          lastName: true
        }
      },
      case: {
        select: {
          fileNumber: true,
          department: {
            select: { name: true }
          }
        }
      }
    },
  });

  return meetings.map((meeting: any) => ({
    id: meeting.id,
    title: meeting.title,
    date: meeting.scheduledStart.toISOString(),
    type: 'meeting' as const,
    priority: meeting.priority.toLowerCase() as any,
    status: meeting.status === 'COMPLETED' ? 'completed' :
            meeting.status === 'CANCELLED' ? 'overdue' : 'pending',
    description: meeting.description,
    caseId: meeting.caseId,
    caseNumber: meeting.case?.fileNumber,
    assignedTo: `${meeting.organizer?.firstName} ${meeting.organizer?.lastName}`.trim(),
    department: meeting.case?.department?.name,
  }));
}

// Helper function to get reminder events
async function getReminderEvents(startDate: Date, endDate: Date, session: any): Promise<CalendarEvent[]> {
  const reminders = [];

  // Add birthday reminders (if user has birth date)
  // This would require adding birthDate to the User model

  // Add periodic review reminders
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  // Check for cases that haven't been updated in a while
  const staleCases = await prisma.case.findMany({
    where: {
      updatedAt: {
        lt: lastMonth
      },
      status: {
        notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED']
      },
      ...(session.user.role !== 'SUPER_ADMIN' && {
        OR: [
          { assignedToId: session.user.id },
          {
            assignments: {
              some: {
                userId: session.user.id
              }
            }
          },
          {
            department: {
              OR: [
                { id: session.user.departmentId },
                { parentId: session.user.departmentId }
              ]
            }
          }
        ]
      })
    },
    include: {
      assignedTo: {
        select: {
          firstName: true,
          lastName: true
        }
      },
      department: {
        select: { name: true }
      }
    }
  });

  // Generate reminders for each day in the range
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  for (let i = 0; i < days; i++) {
    const reminderDate = new Date(startDate);
    reminderDate.setDate(startDate.getDate() + i);

    if (reminderDate.getDay() === 1) { // Monday
      reminders.push({
        id: `reminder-weekly-${reminderDate.toISOString()}`,
        title: 'Revisión semanal de casos',
        date: reminderDate.toISOString(),
        type: 'reminder' as const,
        priority: 'medium' as const,
        status: 'pending' as const,
        description: `Revisar ${staleCases.length} casos sin actualizaciones recientes`,
      });
    }
  }

  return reminders;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const params = calendarSchema.parse({
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      filters: searchParams.get('filters') ? JSON.parse(searchParams.get('filters')!) : undefined,
    });

    const startDate = new Date(params.start);
    const endDate = new Date(params.end);

    const events: CalendarEvent[] = [];

    // Get case deadlines and milestones
    const cases = await prisma.case.findMany({
      where: {
        OR: [
          // Cases with activities in the date range
          {
            activities: {
              some: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                }
              }
            }
          },
          // Cases with expected end dates in the range
          {
            expectedEndDate: {
              gte: startDate,
              lte: endDate,
            }
          },
          // Cases updated in the range (for deadlines calculation)
          {
            updatedAt: {
              gte: new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days before
              lte: endDate,
            }
          }
        ],
        ...(session.user.role !== 'SUPER_ADMIN' && {
          OR: [
            { assignedToId: session.user.id },
            {
              assignments: {
                some: {
                  userId: session.user.id
                }
              }
            },
            {
              department: {
                OR: [
                  { id: session.user.departmentId },
                  { parentId: session.user.departmentId }
                ]
              }
            }
          ]
        })
      },
      include: {
        assignedTo: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        department: {
          select: { name: true }
        }
      }
    });

    // Process cases to extract events
    for (const case_ of cases) {
      const caseEvents = calculateStageDeadlines(case_);
      events.push(...caseEvents);
    }

    // Get meeting events
    const meetingEvents = await getMeetingEvents(startDate, endDate, session);
    events.push(...meetingEvents);

    // Get reminder events
    const reminderEvents = await getReminderEvents(startDate, endDate, session);
    events.push(...reminderEvents);

    // Apply filters
    let filteredEvents = events;

    if (params.filters?.types && params.filters.types.length > 0) {
      filteredEvents = filteredEvents.filter(event =>
        params.filters!.types!.includes(event.type)
      );
    }

    if (params.filters?.priorities && params.filters.priorities.length > 0) {
      filteredEvents = filteredEvents.filter(event =>
        params.filters!.priorities!.includes(event.priority)
      );
    }

    if (params.filters?.departments && params.filters.departments.length > 0) {
      filteredEvents = filteredEvents.filter(event =>
        !event.department || params.filters!.departments!.includes(event.department)
      );
    }

    if (!params.filters?.showCompleted) {
      filteredEvents = filteredEvents.filter(event =>
        event.status !== 'completed'
      );
    }

    // Sort events by date and priority
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    filteredEvents.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    return NextResponse.json({
      events: filteredEvents,
      total: filteredEvents.length,
      dateRange: {
        start: params.start,
        end: params.end,
      }
    });
  } catch (error) {
    logger.error('Calendar error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid calendar parameters', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}