import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logger } from '@/lib/logger';

// GET /api/meetings/[id]/agenda - Get meeting agenda items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify meeting exists and user has access
    const meeting = await prisma.meeting.findUnique({
      where: { id: (await params).id },
      include: {
        organizer: { select: { id: true } },
        chair: { select: { id: true } },
        department: { select: { id: true } },
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
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

    const agendaItems = await prisma.meetingAgendaItem.findMany({
      where: { meetingId: (await params).id },
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
          },
        },
      },
      orderBy: { sequence: "asc" },
    });

    // Calculate total planned duration
    const totalPlannedDuration = agendaItems.reduce(
      (sum, item) => sum + item.plannedDuration,
      0
    );

    // Calculate total actual duration
    const totalActualDuration = agendaItems
      .filter((item) => item.actualDuration !== null)
      .reduce((sum, item) => sum + (item.actualDuration || 0), 0);

    return NextResponse.json({
      agendaItems,
      summary: {
        totalItems: agendaItems.length,
        totalPlannedDuration,
        totalActualDuration,
        completedItems: agendaItems.filter((item) => item.status === "COMPLETED").length,
        pendingItems: agendaItems.filter((item) => item.status === "PENDING").length,
        inProgressItems: agendaItems.filter((item) => item.status === "IN_PROGRESS").length,
        itemsRequiringVote: agendaItems.filter((item) => item.requiresVote).length,
      },
    });
  } catch (error) {
    logger.error("Error fetching agenda:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/meetings/[id]/agenda - Add agenda items to meeting
export async function POST(
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
    const agendaSchema = z.object({
      items: z.array(z.object({
        title: z.string().min(1, "Title is required"),
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
        ]),
        plannedDuration: z.number().min(1, "Duration must be at least 1 minute"),
        presenterId: z.string().optional(),
        ownerId: z.string().optional(),
        content: z.string().optional(),
        materials: z.array(z.string()).optional(),
        preparation: z.string().optional(),
        requiresVote: z.boolean().default(false),
        allowDiscussion: z.boolean().default(true),
        discussionTime: z.number().optional(),
        dependsOn: z.string().optional(),
        blockedBy: z.string().optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT", "CRITICAL"]).default("MEDIUM"),
        isRequired: z.boolean().default(true),
        isOptional: z.boolean().default(false),
      })).min(1, "At least one agenda item is required"),
    });

    const validatedData = agendaSchema.parse(body);

    // Verify meeting exists and user has permission
    const meeting = await prisma.meeting.findUnique({
      where: { id: (await params).id },
      include: {
        organizer: { select: { id: true } },
        chair: { select: { id: true } },
        participants: {
          select: { userId: true },
        },
        agendaItems: {
          select: { sequence: true },
          orderBy: { sequence: "desc" },
          take: 1,
        },
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const canEditAgenda = checkEditAgendaPermission(meeting, user);
    if (!canEditAgenda) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Check if meeting has already started
    const now = new Date();
    if (meeting.scheduledStart <= now) {
      return NextResponse.json(
        { error: "Cannot modify agenda of meeting that has already started" },
        { status: 400 }
      );
    }

    const addedItems = [];
    const errors = [];
    const nextSequence = (meeting.agendaItems[0]?.sequence || 0) + 1;

    for (const [index, itemData] of validatedData.items.entries()) {
      try {
        // Validate presenter and owner are participants or have access
        if (itemData.presenterId) {
          const canPresent = await validatePresenterAccess(meeting, itemData.presenterId);
          if (!canPresent) {
            errors.push({
              item: itemData.title,
              error: "Presenter is not a meeting participant",
            });
            continue;
          }
        }

        if (itemData.ownerId) {
          const canOwn = await validateOwnerAccess(meeting, itemData.ownerId);
          if (!canOwn) {
            errors.push({
              item: itemData.title,
              error: "Owner is not a meeting participant",
            });
            continue;
          }
        }

        // Create agenda item
        const agendaItem = await prisma.meetingAgendaItem.create({
          data: {
            meetingId: (await params).id,
            title: itemData.title,
            description: itemData.description,
            type: itemData.type,
            sequence: nextSequence + index,
            plannedDuration: itemData.plannedDuration,
            presenterId: itemData.presenterId,
            ownerId: itemData.ownerId,
            content: itemData.content,
            materials: itemData.materials || [],
            preparation: itemData.preparation,
            requiresVote: itemData.requiresVote,
            allowDiscussion: itemData.allowDiscussion,
            discussionTime: itemData.discussionTime,
            dependsOn: itemData.dependsOn,
            blockedBy: itemData.blockedBy,
            priority: itemData.priority,
            isRequired: itemData.isRequired,
            isOptional: itemData.isOptional,
            createdBy: session.user.id,
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
            action: "CREATED",
            entityType: "AGENDA_ITEM",
            entityId: agendaItem.id,
            description: `Added agenda item: ${agendaItem.title}`,
            userId: session.user.id,
            metadata: {
              meetingId: (await params).id,
              itemType: agendaItem.type,
              duration: agendaItem.plannedDuration,
            },
          },
        });

        // Notify presenter if assigned
        if (itemData.presenterId) {
          await prisma.meetingNotification.create({
            data: {
              meetingId: (await params).id,
              recipientId: itemData.presenterId,
              type: "UPDATE",
              title: `Presentation Assignment: ${agendaItem.title}`,
              message: `You have been assigned to present "${agendaItem.title}" during the meeting "${meeting.title}".`,
              details: {
                agendaItem: {
                  id: agendaItem.id,
                  title: agendaItem.title,
                  type: agendaItem.type,
                  duration: agendaItem.plannedDuration,
                  preparation: agendaItem.preparation,
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

        addedItems.push(agendaItem);
      } catch (error) {
        logger.error("Error adding agenda item:", error);
        errors.push({
          item: itemData.title,
          error: "Failed to create agenda item",
        });
      }
    }

    return NextResponse.json({
      addedItems,
      errors,
      summary: {
        total: validatedData.items.length,
        added: addedItems.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    logger.error("Error creating agenda:", error);
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

function checkEditAgendaPermission(meeting: any, user: any): boolean {
  const userRole = user.role.name;

  // Super admins and department admins can edit agenda
  if (userRole === "SUPER_ADMIN" || userRole === "DEPARTMENT_ADMIN") {
    return true;
  }

  // Organizer can edit agenda
  if (meeting.organizer.id === user.id) {
    return true;
  }

  // Chair can edit agenda
  if (meeting.chair.id === user.id) {
    return true;
  }

  // Technical meeting coordinators can edit agenda
  if (userRole === "TECHNICAL_MEETING_COORDINATOR") {
    return true;
  }

  return false;
}

async function validatePresenterAccess(meeting: any, presenterId: string): Promise<boolean> {
  // Check if presenter is organizer, chair, or a participant
  if (meeting.organizer.id === presenterId || meeting.chair.id === presenterId) {
    return true;
  }

  const isParticipant = meeting.participants.some(
    (p: any) => p.userId === presenterId
  );

  if (isParticipant) {
    return true;
  }

  // Check if user exists and has appropriate role
  const presenter = await prisma.user.findUnique({
    where: { id: presenterId },
    include: { role: true },
  });

  if (!presenter) {
    return false;
  }

  // Super admins and department admins can present at any meeting
  return ["SUPER_ADMIN", "DEPARTMENT_ADMIN"].includes(presenter.role.name);
}

async function validateOwnerAccess(meeting: any, ownerId: string): Promise<boolean> {
  // Same logic as presenter validation
  return await validatePresenterAccess(meeting, ownerId);
}