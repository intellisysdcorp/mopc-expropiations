import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logger } from '@/lib/logger';

// GET /api/meetings/[id]/participants - Get meeting participants
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

    const participants = await prisma.meetingParticipant.findMany({
      where: { meetingId: (await params).id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            department: {
              select: { id: true, name: true, code: true },
            },
            role: {
              select: { name: true },
            },
          },
        },
        delegatorUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        delegateUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [
        { role: "asc" },
        { rsvpStatus: "asc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json({ participants });
  } catch (error) {
    logger.error("Error fetching participants:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/meetings/[id]/participants - Add participants to meeting
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
    const participantSchema = z.object({
      participants: z.array(z.object({
        userId: z.string().optional(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        phone: z.string().optional(),
        organization: z.string().optional(),
        role: z.enum([
          "ORGANIZER",
          "PRESENTER",
          "ATTENDEE",
          "OPTIONAL_ATTENDEE",
          "NOTE_TAKER",
          "TIMEKEEPER",
          "FACILITATOR",
          "OBSERVER",
          "GUEST_SPEAKER",
          "VOTING_MEMBER",
          "NON_VOTING_MEMBER",
        ]).default("ATTENDEE"),
        permissions: z.object({
          canEditAgenda: z.boolean().default(false),
          canUploadDocs: z.boolean().default(false),
          canVote: z.boolean().default(false),
          canInviteOthers: z.boolean().default(false),
        }).optional(),
        message: z.string().optional(),
      })).min(1, "At least one participant is required"),
    });

    const validatedData = participantSchema.parse(body);

    // Verify meeting exists and user has permission
    const meeting = await prisma.meeting.findUnique({
      where: { id: (await params).id },
      include: {
        organizer: { select: { id: true } },
        chair: { select: { id: true } },
        department: { select: { id: true } },
        _count: { select: { participants: true } },
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

    const canManageParticipants = checkManageParticipantsPermission(meeting, user);
    if (!canManageParticipants) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Check max participants limit
    if (meeting.maxParticipants && meeting._count.participants >= meeting.maxParticipants) {
      return NextResponse.json(
        { error: "Meeting has reached maximum participant limit" },
        { status: 400 }
      );
    }

    const addedParticipants = [];
    const errors = [];

    for (const participantData of validatedData.participants) {
      try {
        // Check if participant already exists
        const existingParticipant = await prisma.meetingParticipant.findFirst({
          where: {
            meetingId: (await params).id,
            OR: [
              ...(participantData.userId ? [{ userId: participantData.userId }] : []),
              ...(participantData.email ? [{ email: participantData.email }] : []),
            ],
          },
        });

        if (existingParticipant) {
          errors.push({
            participant: participantData.email || participantData.userId,
            error: "Already invited to this meeting",
          });
          continue;
        }

        // Create participant
        const participant = await prisma.meetingParticipant.create({
          data: {
            meetingId: (await params).id,
            userId: participantData.userId,
            email: participantData.email,
            name: participantData.name,
            phone: participantData.phone,
            organization: participantData.organization,
            role: participantData.role,
            isExternal: !participantData.userId,
            canEditAgenda: participantData.permissions?.canEditAgenda || false,
            canUploadDocs: participantData.permissions?.canUploadDocs || false,
            canVote: participantData.permissions?.canVote || false,
            canInviteOthers: participantData.permissions?.canInviteOthers || false,
            invitedBy: session.user.id,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                department: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
        });

        // Create activity log
        await prisma.activity.create({
          data: {
            action: "ASSIGNED",
            entityType: "MEETING_PARTICIPANT",
            entityId: participant.id,
            description: `Added participant to meeting: ${participant.user?.firstName || participant.name} ${participant.user?.lastName || ""}`,
            userId: session.user.id,
            metadata: {
              meetingId: (await params).id,
              participantRole: participant.role,
              isExternal: participant.isExternal,
            },
          },
        });

        // Create invitation notification
        await prisma.meetingNotification.create({
          data: {
            meetingId: (await params).id,
            recipientId: participantData.userId || "external",
            type: "INVITATION",
            title: `Meeting Invitation: ${meeting.title}`,
            message: `You have been invited to attend "${meeting.title}" on ${meeting.scheduledStart.toLocaleDateString()} at ${meeting.scheduledStart.toLocaleTimeString()}.`,
            details: {
              participantRole: participant.role,
              customMessage: participantData.message,
              meetingDetails: {
                title: meeting.title,
                type: meeting.meetingType,
                startTime: meeting.scheduledStart,
                endTime: meeting.scheduledEnd,
                location: meeting.location,
                virtual: meeting.virtual,
                meetingUrl: meeting.meetingUrl,
              },
            },
            channels: ["EMAIL", "IN_APP"],
            scheduledAt: new Date(),
            createdBy: session.user.id,
          },
        });

        addedParticipants.push(participant);
      } catch (error) {
        logger.error("Error adding participant:", error);
        errors.push({
          participant: participantData.email || participantData.userId,
          error: "Failed to add participant",
        });
      }
    }

    // Update meeting participant count
    await prisma.meeting.update({
      where: { id: (await params).id },
      data: {
        invitedCount: {
          increment: addedParticipants.length,
        },
      },
    });

    return NextResponse.json({
      addedParticipants,
      errors,
      summary: {
        total: validatedData.participants.length,
        added: addedParticipants.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    logger.error("Error adding participants:", error);
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

function checkManageParticipantsPermission(meeting: any, user: any): boolean {
  const userRole = user.role.name;

  // Super admins and department admins can manage participants
  if (userRole === "SUPER_ADMIN" || userRole === "DEPARTMENT_ADMIN") {
    return true;
  }

  // Organizer can manage participants
  if (meeting.organizer.id === user.id) {
    return true;
  }

  // Chair can manage participants
  if (meeting.chair.id === user.id) {
    return true;
  }

  return false;
}