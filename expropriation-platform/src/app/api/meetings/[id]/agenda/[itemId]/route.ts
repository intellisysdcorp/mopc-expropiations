import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logger } from '@/lib/logger';

// GET /api/meetings/[id]/agenda/[itemId] - Get specific agenda item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify meeting and agenda item exist
    const [meeting, agendaItem] = await Promise.all([
      prisma.meeting.findUnique({
        where: { id: (await params).id },
        include: {
          organizer: { select: { id: true } },
          chair: { select: { id: true } },
          department: { select: { id: true } },
        },
      }),
      prisma.meetingAgendaItem.findUnique({
        where: { id: (await params).itemId },
        include: {
          presenter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          documents: {
            include: {
              uploader: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
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
          decision: {
            include: {
              proposer: {
                select: { id: true, firstName: true, lastName: true },
              },
              approver: {
                select: { id: true, firstName: true, lastName: true },
              },
              commitments: {
                include: {
                  assignee: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!agendaItem) {
      return NextResponse.json({ error: "Agenda item not found" }, { status: 404 });
    }

    // Check if agenda item belongs to the meeting
    if (agendaItem.meetingId !== (await params).id) {
      return NextResponse.json({ error: "Agenda item does not belong to this meeting" }, { status: 400 });
    }

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

    return NextResponse.json(agendaItem);
  } catch (error) {
    logger.error("Error fetching agenda item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/meetings/[id]/agenda/[itemId] - Update agenda item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
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
      type: z.enum([
        "PRESENTATION",
        "DISCUSSION",
        "DECISION",
        "VOTE",
        "ANNOUNCEMENT",
        "BREAK",
        "ACTION_ITEM",
        "REVIEW",
        "APPROVAL",
        "INFORMATION",
      ]).optional(),
      plannedDuration: z.number().min(1).optional(),
      presenterId: z.string().optional(),
      ownerId: z.string().optional(),
      content: z.string().optional(),
      materials: z.array(z.string()).optional(),
      preparation: z.string().optional(),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"]).optional(),
      outcome: z.string().optional(),
      actionItems: z.string().optional(),
      actualDuration: z.number().optional(),
      startTime: z.string().transform((str) => new Date(str)).optional(),
      endTime: z.string().transform((str) => new Date(str)).optional(),
      requiresVote: z.boolean().optional(),
      allowDiscussion: z.boolean().optional(),
      discussionTime: z.number().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"]).optional(),
      isRequired: z.boolean().optional(),
      isOptional: z.boolean().optional(),
      sequence: z.number().optional(),
    });

    const validatedData = updateSchema.parse(body);

    // Get meeting and agenda item
    const [meeting, agendaItem] = await Promise.all([
      prisma.meeting.findUnique({
        where: { id: (await params).id },
        include: {
          organizer: { select: { id: true } },
          chair: { select: { id: true } },
          scheduledStart: true,
        },
      }),
      prisma.meetingAgendaItem.findUnique({
        where: { id: (await params).itemId },
        include: {
          presenter: { select: { id: true } },
          owner: { select: { id: true } },
        },
      }),
    ]);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!agendaItem) {
      return NextResponse.json({ error: "Agenda item not found" }, { status: 404 });
    }

    // Check if agenda item belongs to the meeting
    if (agendaItem.meetingId !== (await params).id) {
      return NextResponse.json({ error: "Agenda item does not belong to this meeting" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const canEdit = checkEditAgendaItemPermission(meeting, agendaItem, user);
    if (!canEdit) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Handle sequence reordering
    if (validatedData.sequence !== undefined && validatedData.sequence !== agendaItem.sequence) {
      await reorderAgendaItems((await params).id, agendaItem.sequence, validatedData.sequence);
    }

    // Validate presenter and owner if changed
    if (validatedData.presenterId && validatedData.presenterId !== agendaItem.presenterId) {
      const canPresent = await validatePresenterAccess(meeting, validatedData.presenterId);
      if (!canPresent) {
        return NextResponse.json(
          { error: "Presenter is not a meeting participant" },
          { status: 400 }
        );
      }
    }

    if (validatedData.ownerId && validatedData.ownerId !== agendaItem.ownerId) {
      const canOwn = await validateOwnerAccess(meeting, validatedData.ownerId);
      if (!canOwn) {
        return NextResponse.json(
          { error: "Owner is not a meeting participant" },
          { status: 400 }
        );
      }
    }

    // Update agenda item
    const updatedItem = await prisma.meetingAgendaItem.update({
      where: { id: (await params).itemId },
      data: {
        ...validatedData,
        materials: validatedData.materials || agendaItem.materials,
        updatedAt: new Date(),
      },
      include: {
        presenter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        action: "UPDATED",
        entityType: "AGENDA_ITEM",
        entityId: agendaItem.id,
        description: `Updated agenda item: ${agendaItem.title}`,
        userId: session.user.id,
        metadata: {
          meetingId: (await params).id,
          updatedFields: Object.keys(validatedData),
        },
      },
    });

    // Notify presenter if changed
    if (validatedData.presenterId && validatedData.presenterId !== agendaItem.presenterId) {
      await prisma.meetingNotification.create({
        data: {
          meetingId: (await params).id,
          recipientId: validatedData.presenterId,
          type: "UPDATE",
          title: `Presentation Assignment: ${updatedItem.title}`,
          message: `You have been assigned to present "${updatedItem.title}" during the meeting "${meeting.title}".`,
          details: {
            agendaItem: {
              id: updatedItem.id,
              title: updatedItem.title,
              type: updatedItem.type,
              duration: updatedItem.plannedDuration,
              preparation: updatedItem.preparation,
            },
            meetingDetails: {
              title: meeting.title,
              startTime: meeting.scheduledStart,
              endTime: meeting.scheduledEnd,
            },
          },
          channels: ["EMAIL", "IN_APP"],
          scheduledAt: new Date(),
          createdBy: session.user.id,
        },
      });
    }

    return NextResponse.json(updatedItem);
  } catch (error) {
    logger.error("Error updating agenda item:", error);
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

// DELETE /api/meetings/[id]/agenda/[itemId] - Delete agenda item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get meeting and agenda item
    const [meeting, agendaItem] = await Promise.all([
      prisma.meeting.findUnique({
        where: { id: (await params).id },
        include: {
          organizer: { select: { id: true } },
          chair: { select: { id: true } },
          scheduledStart: true,
        },
      }),
      prisma.meetingAgendaItem.findUnique({
        where: { id: (await params).itemId },
      }),
    ]);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!agendaItem) {
      return NextResponse.json({ error: "Agenda item not found" }, { status: 404 });
    }

    // Check if agenda item belongs to the meeting
    if (agendaItem.meetingId !== (await params).id) {
      return NextResponse.json({ error: "Agenda item does not belong to this meeting" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const canDelete = checkDeleteAgendaItemPermission(meeting, agendaItem, user);
    if (!canDelete) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Check if meeting has already started
    const now = new Date();
    if (meeting.scheduledStart <= now) {
      return NextResponse.json(
        { error: "Cannot delete agenda items from meeting that has already started" },
        { status: 400 }
      );
    }

    // Delete agenda item
    await prisma.meetingAgendaItem.delete({
      where: { id: (await params).itemId },
    });

    // Reorder remaining items
    await reorderAfterDeletion((await params).id, agendaItem.sequence);

    // Create activity log
    await prisma.activity.create({
      data: {
        action: "DELETED",
        entityType: "AGENDA_ITEM",
        entityId: agendaItem.id,
        description: `Deleted agenda item: ${agendaItem.title}`,
        userId: session.user.id,
        metadata: {
          meetingId: (await params).id,
          deletedSequence: agendaItem.sequence,
        },
      },
    });

    return NextResponse.json({ message: "Agenda item deleted successfully" });
  } catch (error) {
    logger.error("Error deleting agenda item:", error);
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
  if (meeting.organizer.id === user.id || meeting.chair.id === user.id) {
    return true;
  }

  // Department members have access to department meetings
  if (meeting.department.id === user.departmentId && !meeting.isPrivate) {
    return true;
  }

  return false;
}

function checkEditAgendaItemPermission(meeting: any, agendaItem: any, user: any): boolean {
  const userRole = user.role.name;

  // Super admins and department admins can edit any agenda item
  if (userRole === "SUPER_ADMIN" || userRole === "DEPARTMENT_ADMIN") {
    return true;
  }

  // Organizer can edit any agenda item
  if (meeting.organizer.id === user.id) {
    return true;
  }

  // Chair can edit any agenda item
  if (meeting.chair.id === user.id) {
    return true;
  }

  // Technical meeting coordinators can edit agenda items
  if (userRole === "TECHNICAL_MEETING_COORDINATOR") {
    return true;
  }

  // Presenters can edit their own agenda items
  if (agendaItem.presenterId === user.id) {
    return true;
  }

  // Owners can edit their own agenda items
  if (agendaItem.ownerId === user.id) {
    return true;
  }

  return false;
}

function checkDeleteAgendaItemPermission(meeting: any, agendaItem: any, user: any): boolean {
  const userRole = user.role.name;

  // Super admins and department admins can delete any agenda item
  if (userRole === "SUPER_ADMIN" || userRole === "DEPARTMENT_ADMIN") {
    return true;
  }

  // Organizer can delete any agenda item
  if (meeting.organizer.id === user.id) {
    return true;
  }

  // Chair can delete any agenda item
  if (meeting.chair.id === user.id) {
    return true;
  }

  // Technical meeting coordinators can delete agenda items
  if (userRole === "TECHNICAL_MEETING_COORDINATOR") {
    return true;
  }

  return false;
}

async function reorderAgendaItems(meetingId: string, oldSequence: number, newSequence: number): Promise<void> {
  if (oldSequence === newSequence) return;

  const direction = oldSequence < newSequence ? "decrement" : "increment";

  await prisma.meetingAgendaItem.updateMany({
    where: {
      meetingId,
      sequence: {
        [direction === "decrement" ? "gt" : "lt"]: newSequence,
        [direction === "decrement" ? "lte" : "gte"]: oldSequence,
      },
    },
    data: {
      sequence: {
        [direction]: 1,
      },
    },
  });
}

async function reorderAfterDeletion(meetingId: string, deletedSequence: number): Promise<void> {
  await prisma.meetingAgendaItem.updateMany({
    where: {
      meetingId,
      sequence: {
        gt: deletedSequence,
      },
    },
    data: {
      sequence: {
        decrement: 1,
      },
    },
  });
}

async function validatePresenterAccess(meeting: any, presenterId: string): Promise<boolean> {
  if (meeting.organizer.id === presenterId || meeting.chair.id === presenterId) {
    return true;
  }

  const isParticipant = meeting.participants.some(
    (p: any) => p.userId === presenterId
  );

  if (isParticipant) {
    return true;
  }

  const presenter = await prisma.user.findUnique({
    where: { id: presenterId },
    include: { role: true },
  });

  if (!presenter) {
    return false;
  }

  return ["SUPER_ADMIN", "DEPARTMENT_ADMIN"].includes(presenter.role.name);
}

async function validateOwnerAccess(meeting: any, ownerId: string): Promise<boolean> {
  return await validatePresenterAccess(meeting, ownerId);
}