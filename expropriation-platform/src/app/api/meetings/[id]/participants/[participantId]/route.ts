import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { logger } from '@/lib/logger';
import type { ParticipantRole } from '@prisma/client';

// PUT /api/meetings/[id]/participants/[participantId] - Update participant
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const updateSchema = z.object({
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
      ]).optional(),
      permissions: z.object({
        canEditAgenda: z.boolean().optional(),
        canUploadDocs: z.boolean().optional(),
        canVote: z.boolean().optional(),
        canInviteOthers: z.boolean().optional(),
      }).optional(),
      delegatedTo: z.string().optional(),
      delegationReason: z.string().optional(),
    });

    const validatedData = updateSchema.parse(body);

    // Get meeting and participant
    const [meeting, participant] = await Promise.all([
      prisma.meeting.findUnique({
        where: { id: (await params).id },
        include: {
          organizer: { select: { id: true, firstName: true, lastName: true } },
          chair: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.meetingParticipant.findUnique({
        where: { id: (await params).participantId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const canEdit = checkEditParticipantPermission(meeting, participant, user);
    if (!canEdit) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Handle delegation
    if (validatedData.delegatedTo) {
      // Check if delegate exists
      const delegateUser = await prisma.user.findUnique({
        where: { id: validatedData.delegatedTo },
      });

      if (!delegateUser) {
        return NextResponse.json(
          { error: "Delegate user not found" },
          { status: 404 }
        );
      }

      const meetingParticipantUpdate: any = {
        delegatedTo: validatedData.delegatedTo,
        rsvpStatus: "DELEGATED",
      };

      if (validatedData.delegationReason) {
        meetingParticipantUpdate.delegationReason = validatedData.delegationReason;
      }

      // Create delegation record
      await prisma.meetingParticipant.update({
        where: { id: (await params).participantId },
        data: meetingParticipantUpdate,
      });

      // Create delegation notification
      await prisma.meetingNotification.create({
        data: {
          meetingId: (await params).id,
          recipientId: validatedData.delegatedTo,
          type: "INVITATION",
          title: `Meeting Delegation: ${meeting.title}`,
          message: `You have been delegated to attend "${meeting.title}" on ${meeting.scheduledStart.toLocaleDateString()} by ${participant.user?.firstName || participant.name}.`,
          details: {
            delegationReason: validatedData.delegationReason,
            originalParticipant: participant.user?.firstName || participant.name,
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
    }

    // Update participant
    const updateData: any = {};

    if (validatedData.role !== undefined) {
      updateData.role = validatedData.role as ParticipantRole;
    }

    if (validatedData.permissions) {
      if (validatedData.permissions.canEditAgenda !== undefined) {
        updateData.canEditAgenda = validatedData.permissions.canEditAgenda;
      }
      if (validatedData.permissions.canUploadDocs !== undefined) {
        updateData.canUploadDocs = validatedData.permissions.canUploadDocs;
      }
      if (validatedData.permissions.canVote !== undefined) {
        updateData.canVote = validatedData.permissions.canVote;
      }
      if (validatedData.permissions.canInviteOthers !== undefined) {
        updateData.canInviteOthers = validatedData.permissions.canInviteOthers;
      }
    }

    const updatedParticipant = await prisma.meetingParticipant.update({
      where: { id: (await params).participantId },
      data: updateData,
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
        delegateUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        action: "UPDATED",
        entityType: "MEETING_PARTICIPANT",
        entityId: participant.id,
        description: `Updated participant: ${participant.user?.firstName || participant.name} ${participant.user?.lastName || ""}`,
        userId: session.user.id,
        metadata: {
          meetingId: (await params).id,
          updatedFields: Object.keys(validatedData),
        },
      },
    });

    return NextResponse.json(updatedParticipant);
  } catch (error) {
    logger.error("Error updating participant:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/meetings/[id]/participants/[participantId] - Remove participant
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get meeting and participant
    const [meeting, participant] = await Promise.all([
      prisma.meeting.findUnique({
        where: { id: (await params).id },
        include: {
          organizer: { select: { id: true, firstName: true, lastName: true } },
          chair: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.meetingParticipant.findUnique({
        where: { id: (await params).participantId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const canRemove = checkRemoveParticipantPermission(meeting, participant, user);
    if (!canRemove) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Remove participant
    await prisma.meetingParticipant.delete({
      where: { id: (await params).participantId },
    });

    // Update meeting participant count
    const meetingUpdateData: {
      invitedCount: { decrement: number };
      acceptedCount?: { decrement: number };
      attendedCount?: { decrement: number };
    } = {
      invitedCount: { decrement: 1 },
    };

    if (participant.rsvpStatus === "ACCEPTED") {
      meetingUpdateData.acceptedCount = { decrement: 1 };
    }

    if (participant.attended) {
      meetingUpdateData.attendedCount = { decrement: 1 };
    }

    await prisma.meeting.update({
      where: { id: (await params).id },
      data: meetingUpdateData,
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        action: "DELETED",
        entityType: "MEETING_PARTICIPANT",
        entityId: participant.id,
        description: `Removed participant: ${participant.user?.firstName || participant.name} ${participant.user?.lastName || ""}`,
        userId: session.user.id,
        metadata: {
          meetingId: (await params).id,
          participantEmail: participant.user?.email || participant.email,
        },
      },
    });

    // Send cancellation notification
    if (participant.user) {
      await prisma.meetingNotification.create({
        data: {
          meetingId: (await params).id,
          recipientId: participant.user.id,
          type: "CANCELLATION",
          title: `Meeting Invitation Cancelled: ${meeting.title}`,
          message: `Your invitation to "${meeting.title}" on ${meeting.scheduledStart.toLocaleDateString()} has been cancelled.`,
          details: {
            meetingDetails: {
              title: meeting.title,
              type: meeting.meetingType,
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

    return NextResponse.json({ message: "Participant removed successfully" });
  } catch (error) {
    logger.error("Error removing participant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper functions
function checkEditParticipantPermission(
  meeting: {
    organizer: { id: string };
    chair?: { id: string } | null;
  },
  participant: {
    userId?: string | null;
  },
  user: {
    id: string;
    role: { name: string };
  }
): boolean {
  const userRole = user.role.name;

  // Super admins and department admins can edit any participant
  if (userRole === "SUPER_ADMIN" || userRole === "DEPARTMENT_ADMIN") {
    return true;
  }

  // Organizer can edit any participant
  if (meeting.organizer.id === user.id) {
    return true;
  }

  // Chair can edit any participant
  if (meeting.chair?.id === user.id) {
    return true;
  }

  // Users can edit their own participation (RSVP, delegation)
  if (participant.userId === user.id) {
    return true;
  }

  return false;
}

function checkRemoveParticipantPermission(
  meeting: {
    organizer: { id: string };
    chair?: { id: string } | null;
  },
  participant: {
    userId?: string | null;
  },
  user: {
    id: string;
    role: { name: string };
  }
): boolean {
  const userRole = user.role.name;

  // Super admins and department admins can remove any participant
  if (userRole === "SUPER_ADMIN" || userRole === "DEPARTMENT_ADMIN") {
    return true;
  }

  // Organizer can remove any participant (except themselves from ongoing meetings)
  if (meeting.organizer.id === user.id) {
    return true;
  }

  // Chair can remove any participant
  if (meeting.chair?.id === user.id) {
    return true;
  }

  // Users can remove themselves
  if (participant.userId === user.id) {
    return true;
  }

  return false;
}