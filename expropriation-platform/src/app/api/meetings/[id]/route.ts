import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logger } from '@/lib/logger';

// GET /api/meetings/[id] - Get a specific meeting
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: (await params).id },
      include: {
        organizer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        chair: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        agendaItems: {
          include: {
            presenter: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            owner: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            documents: true,
            votingSession: {
              include: {
                votes: {
                  include: {
                    participant: {
                      include: {
                        user: {
                          select: { id: true, firstName: true, lastName: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            decision: true,
          },
          orderBy: { sequence: "asc" },
        },
        decisions: {
          include: {
            proposer: {
              select: { id: true, firstName: true, lastName: true },
            },
            approver: {
              select: { id: true, firstName: true, lastName: true },
            },
            reviewer: {
              select: { id: true, firstName: true, lastName: true },
            },
            votingSession: {
              include: {
                votes: {
                  include: {
                    participant: {
                      include: {
                        user: {
                          select: { id: true, firstName: true, lastName: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            commitments: {
              include: {
                assignee: {
                  select: { id: true, firstName: true, lastName: true },
                },
                assigner: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
        commitments: {
          include: {
            assignee: {
              select: { id: true, firstName: true, lastName: true },
            },
            assigner: {
              select: { id: true, firstName: true, lastName: true },
            },
            decision: {
              select: { id: true, title },
            },
            progressUpdates: {
              orderBy: { updatedAt: "desc" },
            },
          },
        },
        documents: {
          include: {
            uploader: {
              select: { id: true, firstName: true, lastName: true },
            },
            agendaItem: {
              select: { id: true, title },
            },
          },
        },
        votingSessions: {
          include: {
            votes: {
              include: {
                participant: {
                  include: {
                    user: {
                      select: { id: true, firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
        },
        minutes: {
          orderBy: { version: "desc" },
        },
        notifications: {
          orderBy: { createdAt: "desc" },
        },
        analytics: {
          orderBy: { reportingDate: "desc" },
        },
        conflicts: {
          include: {
            resolver: {
              select: { id: true, firstName: true, lastName: true },
            },
            detector: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        case: {
          select: { id: true, fileNumber: true, title },
        },
        agendaTemplate: {
          select: { id: true, name, content },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Check if user has permission to access this meeting
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true, department: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hasAccess = checkMeetingAccess(meeting, user);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(meeting);
  } catch (error) {
    logger.error("Error fetching meeting:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/meetings/[id] - Update a meeting
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const updateSchema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      meetingType: z.enum([
        "SITE_VISIT",
        "COORDINATION",
        "DECISION",
        "PUBLIC_CONSULTATION",
        "TECHNICAL_REVIEW",
        "LEGAL_REVIEW",
        "NEGOTIATION",
        "STATUS_UPDATE",
        "RECURRING",
        "EMERGENCY",
        "TRAINING",
        "BOARD_MEETING",
        "COMMITTEE_MEETING",
        "STAKEHOLDER_MEETING",
        "KICKOFF_MEETING",
        "REVIEW_MEETING",
        "PLANNING_MEETING",
        "RETROSPECTIVE",
      ]).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"]).optional(),
      location: z.string().optional(),
      virtual: z.boolean().optional(),
      meetingUrl: z.string().optional(),
      dialInInfo: z.string().optional(),
      room: z.string().optional(),
      equipment: z.array(z.string()).optional(),
      scheduledStart: z.string().transform((str) => new Date(str)).optional(),
      scheduledEnd: z.string().transform((str) => new Date(str)).optional(),
      timezone: z.string().optional(),
      maxParticipants: z.number().optional(),
      allowGuests: z.boolean().optional(),
      requireApproval: z.boolean().optional(),
      isPrivate: z.boolean().optional(),
      recordMeeting: z.boolean().optional(),
      enableChat: z.boolean().optional(),
      enableScreenShare: z.boolean().optional(),
      chairId: z.string().optional(),
      tags: z.string().optional(),
      metadata: z.object({}).optional(),
      status: z.enum([
        "DRAFT",
        "SCHEDULED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "POSTPONED",
        "RESCHEDULED",
        "ARCHIVED",
      ]).optional(),
    });

    const validatedData = updateSchema.parse(body);

    // Get existing meeting
    const existingMeeting = await prisma.meeting.findUnique({
      where: { id: (await params).id },
      include: { participants: true },
    });

    if (!existingMeeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true, department: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const canEdit = checkEditPermission(existingMeeting, user);
    if (!canEdit) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Check for conflicts if time is being changed
    if (validatedData.scheduledStart || validatedData.scheduledEnd) {
      const newStartTime = validatedData.scheduledStart || existingMeeting.scheduledStart;
      const newEndTime = validatedData.scheduledEnd || existingMeeting.scheduledEnd;

      const conflicts = await checkMeetingConflicts(
        newStartTime,
        newEndTime,
        session.user.id,
        validatedData.room || existingMeeting.room,
        existingMeeting.id
      );

      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            error: "Scheduling conflicts detected",
            conflicts
          },
          { status: 409 }
        );
      }
    }

    // Calculate duration if dates are changed
    let duration = existingMeeting.plannedDuration;
    if (validatedData.scheduledStart && validatedData.scheduledEnd) {
      duration = Math.round(
        (validatedData.scheduledEnd.getTime() - validatedData.scheduledStart.getTime()) / (1000 * 60)
      );
    }

    // Update meeting
    const meeting = await prisma.meeting.update({
      where: { id: (await params).id },
      data: {
        ...validatedData,
        plannedDuration: duration,
        equipment: validatedData.equipment || existingMeeting.equipment,
        metadata: validatedData.metadata || existingMeeting.metadata,
      },
      include: {
        organizer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        chair: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: {
            participants: true,
            agendaItems: true,
            decisions: true,
            commitments: true,
          },
        },
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        action: "UPDATED",
        entityType: "MEETING",
        entityId: meeting.id,
        description: `Updated meeting: ${meeting.title}`,
        userId: session.user.id,
        metadata: {
          updatedFields: Object.keys(validatedData),
        },
      },
    });

    return NextResponse.json(meeting);
  } catch (error) {
    logger.error("Error updating meeting:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/meetings/[id] - Delete a meeting
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: (await params).id },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const canDelete = user.role.name === "SUPER_ADMIN" ||
                     user.role.name === "DEPARTMENT_ADMIN" ||
                     meeting.organizerId === session.user.id;

    if (!canDelete) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Soft delete by marking as cancelled
    await prisma.meeting.update({
      where: { id: (await params).id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: session.user.id,
        cancellationReason: "Meeting deleted by organizer",
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        action: "DELETED",
        entityType: "MEETING",
        entityId: meeting.id,
        description: `Cancelled meeting: ${meeting.title}`,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ message: "Meeting cancelled successfully" });
  } catch (error) {
    logger.error("Error deleting meeting:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper functions
function checkMeetingAccess(meeting: any, user: any): boolean {
  const userRole = user.role.name;

  // Super admins and department admins have access to all meetings
  if (userRole === "SUPER_ADMIN" || userRole === "DEPARTMENT_ADMIN") {
    return true;
  }

  // Organizer and chair have access
  if (meeting.organizerId === user.id || meeting.chairId === user.id) {
    return true;
  }

  // Participants have access
  const isParticipant = meeting.participants.some(
    (p: any) => p.userId === user.id
  );
  if (isParticipant) {
    return true;
  }

  // Department members have access to department meetings
  if (meeting.departmentId === user.departmentId && !meeting.isPrivate) {
    return true;
  }

  return false;
}

function checkEditPermission(meeting: any, user: any): boolean {
  const userRole = user.role.name;

  // Super admins and department admins can edit all meetings
  if (userRole === "SUPER_ADMIN" || userRole === "DEPARTMENT_ADMIN") {
    return true;
  }

  // Organizer can edit
  if (meeting.organizerId === user.id) {
    return true;
  }

  // Chair can edit
  if (meeting.chairId === user.id) {
    return true;
  }

  return false;
}

async function checkMeetingConflicts(
  startTime: Date,
  endTime: Date,
  userId: string,
  room?: string,
  excludeMeetingId?: string
): Promise<any[]> {
  const conflicts = [];
  const whereClause: any = {
    NOT: { id: excludeMeetingId },
    status: { not: "CANCELLED" },
    OR: [
      {
        AND: [
          { scheduledStart: { lte: startTime } },
          { scheduledEnd: { gt: startTime } },
        ],
      },
      {
        AND: [
          { scheduledStart: { lt: endTime } },
          { scheduledEnd: { gte: endTime } },
        ],
      },
      {
        AND: [
          { scheduledStart: { gte: startTime } },
          { scheduledEnd: { lte: endTime } },
        ],
      },
    ],
  };

  // Check participant conflicts
  const participantConflicts = await prisma.meeting.findMany({
    where: {
      ...whereClause,
      OR: [
        { organizerId: userId },
        { chairId: userId },
        { participants: { some: { userId } } },
      ],
    },
    include: {
      organizer: { select: { firstName: true, lastName: true } },
    },
  });

  participantConflicts.forEach((conflict) => {
    conflicts.push({
      type: "PARTICIPANT_UNAVAILABLE",
      meetingId: conflict.id,
      title: conflict.title,
      startTime: conflict.scheduledStart,
      endTime: conflict.scheduledEnd,
      description: `You are already scheduled in meeting "${conflict.title}" with ${conflict.organizer.firstName} ${conflict.organizer.lastName}`,
    });
  });

  // Check room conflicts
  if (room) {
    const roomConflicts = await prisma.meeting.findMany({
      where: {
        ...whereClause,
        room,
      },
    });

    roomConflicts.forEach((conflict) => {
      conflicts.push({
        type: "ROOM_UNAVAILABLE",
        meetingId: conflict.id,
        title: conflict.title,
        startTime: conflict.scheduledStart,
        endTime: conflict.scheduledEnd,
        description: `Room "${room}" is already booked for meeting "${conflict.title}"`,
      });
    });
  }

  return conflicts;
}