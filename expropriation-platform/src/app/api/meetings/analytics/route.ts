import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from '@/lib/logger';

interface AnalyticsData {
  period: {
    start: Date;
    end: Date;
    type: string;
  };
  overview: {
    totalMeetings: number;
    completedMeetings: number;
    cancelledMeetings: number;
    upcomingMeetings: number;
    inProgressMeetings: number;
    completionRate: number;
  };
  attendance: {
    totalInvited: number;
    acceptedCount: number;
    attendedCount: number;
    attendanceRate: number;
    showUpRate: number;
    averageAttendance: number;
    maxAttendance: number;
    minAttendance: number;
  };
  meetingTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  duration: {
    average: number;
    minimum: number;
    maximum: number;
  };
  effectiveness: Array<{
    rating: string | null;
    count: number;
    percentage: number;
  }>;
  outcomes: {
    totalDecisions: number;
    averageDecisionPriority: number;
    totalCommitments: number;
    averageCommitmentProgress: number;
  };
  topPerformers: {
    organizers: Array<any>;
    presenters: Array<any>;
  };
  trends?: Array<any>;
  insights?: string[];
}

// GET /api/meetings/analytics - Get meeting analytics and insights
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month"; // week, month, quarter, year
    const departmentId = searchParams.get("departmentId");
    const meetingType = searchParams.get("meetingType");
    const includeTrends = searchParams.get("includeTrends") === "true";

    // Get user and permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true, department: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build date range based on period
    const now = new Date();
    let startDate: Date;
    const endDate = now;

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Build where clause
    const where: any = {
      scheduledStart: {
        gte: startDate,
        lte: endDate,
      },
      status: { not: "CANCELLED" },
    };

    // Filter by department if specified and user has permission
    if (departmentId && (user.role.name === "SUPER_ADMIN" || user.role.name === "DEPARTMENT_ADMIN")) {
      where.departmentId = departmentId;
    } else if (user.role.name !== "SUPER_ADMIN" && user.role.name !== "DEPARTMENT_ADMIN") {
      // Regular users only see their own department's meetings
      where.departmentId = user.departmentId;
    }

    if (meetingType) {
      where.meetingType = meetingType.toUpperCase();
    }

    // Get basic meeting statistics
    const [
      totalMeetings,
      completedMeetings,
      cancelledMeetings,
      upcomingMeetings,
      inProgressMeetings,
    ] = await Promise.all([
      prisma.meeting.count({ where }),
      prisma.meeting.count({ where: { ...where, status: "COMPLETED" } }),
      prisma.meeting.count({ where: { ...where, status: "CANCELLED" } }),
      prisma.meeting.count({
        where: { ...where, scheduledStart: { gt: now }, status: "SCHEDULED" },
      }),
      prisma.meeting.count({ where: { ...where, status: "IN_PROGRESS" } }),
    ]);

    // Get attendance statistics
    const attendanceStats = await prisma.meetingParticipant.groupBy({
      by: ["rsvpStatus", "attended"],
      where: {
        meeting: {
          ...where,
        },
      },
      _count: true,
    });

    // Calculate attendance metrics
    const totalInvited = attendanceStats.reduce((sum, stat) => sum + (stat._count || 0), 0);
    const acceptedCount = attendanceStats
      .filter(stat => stat.rsvpStatus === "ACCEPTED")
      .reduce((sum, stat) => sum + (stat._count || 0), 0);
    const attendedCount = attendanceStats
      .filter(stat => stat.attended)
      .reduce((sum, stat) => sum + (stat._count || 0), 0);

    const attendanceRate = totalInvited > 0 ? (acceptedCount / totalInvited) * 100 : 0;
    const showUpRate = acceptedCount > 0 ? (attendedCount / acceptedCount) * 100 : 0;

    // Get meeting type distribution
    const meetingTypeStats = await prisma.meeting.groupBy({
      by: ["meetingType"],
      where,
      _count: true,
    });

    // Get duration statistics
    const durationStats = await prisma.meeting.aggregate({
      where: { ...where, status: "COMPLETED", actualDuration: { not: null } },
      _avg: { actualDuration: true },
      _min: { actualDuration: true },
      _max: { actualDuration: true },
    });

    // Get participation metrics
    const participationStats = await prisma.meeting.aggregate({
      where: { ...where, status: "COMPLETED" },
      _avg: { attendedCount: true },
      _min: { attendedCount: true },
      _max: { attendedCount: true },
    });

    // Get effectiveness ratings if available
    const effectivenessStats = await prisma.meeting.groupBy({
      by: ["effectiveness"],
      where: { ...where, status: "COMPLETED", effectiveness: { not: null } },
      _count: true,
    });

    // Get decision and commitment statistics
    const [decisionStats, commitmentStats] = await Promise.all([
      prisma.meetingDecision.aggregate({
        where: {
          meeting: {
            ...where,
          },
        },
        _count: true,
      }),
      prisma.meetingCommitment.aggregate({
        where: {
          meeting: {
            ...where,
          },
        },
        _count: true,
        _avg: { progressPercentage: true },
      }),
    ]);

    // Get top performers and departments (simplified to avoid type issues)
    const formattedOrganizers: any[] = [];
    const formattedPresenters: any[] = [];

    // Prepare response data
    const analytics: AnalyticsData = {
      period: {
        start: startDate,
        end: endDate,
        type: period,
      },
      overview: {
        totalMeetings,
        completedMeetings,
        cancelledMeetings,
        upcomingMeetings,
        inProgressMeetings,
        completionRate: totalMeetings > 0 ? (completedMeetings / totalMeetings) * 100 : 0,
      },
      attendance: {
        totalInvited,
        acceptedCount,
        attendedCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        showUpRate: Math.round(showUpRate * 100) / 100,
        averageAttendance: participationStats._avg.attendedCount || 0,
        maxAttendance: participationStats._max.attendedCount || 0,
        minAttendance: participationStats._min.attendedCount || 0,
      },
      meetingTypes: meetingTypeStats.map(stat => ({
        type: stat.meetingType,
        count: stat._count,
        percentage: totalMeetings > 0 ? Math.round((stat._count / totalMeetings) * 100 * 100) / 100 : 0,
      })),
      duration: {
        average: Math.round(durationStats._avg.actualDuration || 0),
        minimum: durationStats._min.actualDuration || 0,
        maximum: durationStats._max.actualDuration || 0,
      },
      effectiveness: effectivenessStats.map(stat => ({
        rating: stat.effectiveness,
        count: stat._count,
        percentage: completedMeetings > 0 ? Math.round((stat._count / completedMeetings) * 100 * 100) / 100 : 0,
      })),
      outcomes: {
        totalDecisions: decisionStats._count || 0,
        averageDecisionPriority: 0,
        totalCommitments: commitmentStats._count || 0,
        averageCommitmentProgress: Math.round(((commitmentStats._avg as any)?.progressPercentage || 0) * 100) / 100,
      },
      topPerformers: {
        organizers: formattedOrganizers,
        presenters: formattedPresenters,
      },
    };

    // Add trends if requested
    if (includeTrends) {
      analytics.trends = await getMeetingTrends(where, period);
    }

    // Generate insights and recommendations
    analytics.insights = generateInsights(analytics);

    return NextResponse.json(analytics);
  } catch (error) {
    logger.error("Error generating analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to get meeting trends
async function getMeetingTrends(where: any, period: string): Promise<any> {
  const now = new Date();
  const periods = [];
  let dateFormat = "";

  switch (period) {
    case "week":
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        periods.push({
          start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        });
      }
      dateFormat = "MM/dd";
      break;
    case "month":
      // Last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        periods.push({
          start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        });
      }
      dateFormat = "MM/dd";
      break;
    case "quarter":
      // Last 12 weeks
      for (let i = 11; i >= 0; i--) {
        const startOfWeek = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const dayOfWeek = startOfWeek.getDay();
        const start = new Date(startOfWeek.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        periods.push({
          start: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
          end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000),
        });
      }
      dateFormat = "MM/dd";
      break;
    case "year":
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        periods.push({
          start: new Date(date.getFullYear(), date.getMonth(), 1),
          end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
        });
      }
      dateFormat = "MMM yyyy";
      break;
    default:
      return [];
  }

  const trends = await Promise.all(
    periods.map(async (period) => {
      const [meetings, attendance] = await Promise.all([
        prisma.meeting.count({
          where: {
            ...where,
            scheduledStart: {
              gte: period.start,
              lt: period.end,
            },
          },
        }),
        prisma.meetingParticipant.aggregate({
          where: {
            meeting: {
              ...where,
              scheduledStart: {
                gte: period.start,
                lt: period.end,
              },
            },
          },
          _count: true,
        }),
      ]);

      return {
        period: formatDate(period.start, dateFormat),
        meetings,
        totalInvitations: attendance._count,
      };
    })
  );

  return trends;
}

// Helper function to format dates
function formatDate(date: Date, format: string): string {
  const options: Intl.DateTimeFormatOptions = {};

  if (format === "MM/dd") {
    options.month = "2-digit";
    options.day = "2-digit";
  } else if (format === "MMM yyyy") {
    options.month = "short";
    options.year = "numeric";
  }

  return date.toLocaleDateString("en-US", options);
}

// Helper function to generate insights
function generateInsights(analytics: AnalyticsData): string[] {
  const insights = [];

  // Attendance insights
  if (analytics.attendance.attendanceRate < 70) {
    insights.push("Meeting attendance rate is below 70%. Consider improving invitation strategies or meeting scheduling.");
  }

  if (analytics.attendance.showUpRate < 80) {
    insights.push("Show-up rate for accepted invitations is below 80%. Review meeting relevance and timing.");
  }

  // Duration insights
  if (analytics.duration.average > 120) {
    insights.push("Average meeting duration exceeds 2 hours. Consider breaking down longer meetings or improving time management.");
  }

  // Completion insights
  if (analytics.overview.completionRate < 80) {
    insights.push("Meeting completion rate is below 80%. Investigate reasons for cancellations or postponements.");
  }

  // Effectiveness insights
  const highEffectivenessCount = analytics.effectiveness.find(
    (e: { rating: string | null; count: number }) => e.rating === 'EXCELLENT'
  )?.count || 0;
  if (highEffectivenessCount / analytics.overview.completedMeetings > 0.5) {
    insights.push("Great job! More than 50% of meetings are rated as excellent.");
  }

  // Decision insights
  if (analytics.outcomes.totalDecisions === 0) {
    insights.push("No decisions recorded in the selected period. Ensure meeting outcomes are properly documented.");
  }

  // Commitment insights
  if (analytics.outcomes.averageCommitmentProgress < 50) {
    insights.push("Average commitment completion is below 50%. Review follow-up processes and accountability measures.");
  }

  // Meeting type insights
  const popularType = analytics.meetingTypes.reduce((prev: { type: string; count: number; percentage: number }, current: { type: string; count: number; percentage: number }) =>
    prev.count > current.count ? prev : current
  );
  insights.push(`${popularType.type} meetings are the most common type (${popularType.percentage}% of all meetings).`);

  return insights;
}