'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  AlertTriangle,
  BarChart3,
  Activity,
  Timer,
  AlertCircle,
  Plus
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';
import { CASE_STAGES } from '@/constants/stages';

// Types
interface TimeEntry {
  id: string;
  caseId: string;
  stage: string;
  action: 'START' | 'PAUSE' | 'RESUME' | 'COMPLETE' | 'EXTEND';
  startTime: string;
  endTime?: string;
  duration?: number;
  pausedDuration?: number;
  reason?: string;
  justification?: string;
  userId: string;
  alertThreshold?: number;
  alertSent: boolean;
  case: {
    id: string;
    fileNumber: string;
    title: string;
    currentStage: string;
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface TimeAnalytics {
  overview: {
    totalEntries: number;
    totalDuration: number;
    averageDuration: number;
    totalPausedTime: number;
  };
  byStage: Record<string, {
    count: number;
    totalDuration: number;
    averageDuration: number;
    entries: TimeEntry[];
  }>;
  byAction: Record<string, number>;
  byUser: Record<string, {
    userId: string;
    count: number;
    totalDuration: number;
    averageDuration: number;
  }>;
  overdueEntries: TimeEntry[];
}

interface TimeTrackingDashboardProps {
  caseId?: string;
  departmentId?: string;
  startDate?: string;
  endDate?: string;
  refreshInterval?: number;
}

export function TimeTrackingDashboard({
  caseId,
  departmentId,
  startDate,
  endDate,
  refreshInterval = 30000 // 30 seconds
}: TimeTrackingDashboardProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [analytics, setAnalytics] = useState<TimeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('START');
  const [reason, setReason] = useState('');
  const [justification, setJustification] = useState('');
  const [alertThreshold, setAlertThreshold] = useState<number>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Build query parameters
      const params = new URLSearchParams();
      if (caseId) params.append('caseId', caseId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      // Fetch time entries
      const entriesResponse = await fetch(`/api/time-tracking?${params}`);
      if (entriesResponse.ok) {
        const data = await entriesResponse.json();
        setEntries(data.entries);
      }

      // Fetch analytics
      const analyticsParams = new URLSearchParams(params);
      if (departmentId) analyticsParams.append('departmentId', departmentId);

      const analyticsResponse = await fetch(`/api/time-tracking/analytics?${analyticsParams}`);
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching time tracking data:', error);
      }
      toast({
        title: 'Error',
        description: 'Failed to fetch time tracking data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [caseId, departmentId, endDate, startDate, toast]);

  useEffect(() => {
    fetchData();

    // Set up refresh interval
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  // Handle time entry submission
  const handleSubmitTimeEntry = async () => {
    if (!selectedCase || !selectedStage || !selectedAction) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        caseId: selectedCase,
        stage: selectedStage,
        action: selectedAction,
        reason: reason || undefined,
        justification: justification || undefined,
        alertThreshold: alertThreshold || undefined,
      };

      const response = await fetch('/api/time-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await response.json();
        toast({
          title: 'Success',
          description: `Time tracking entry created: ${selectedAction}`,
        });

        // Reset form
        setSelectedCase('');
        setSelectedStage('');
        setSelectedAction('START');
        setReason('');
        setJustification('');
        setAlertThreshold(undefined);
        setIsDialogOpen(false);

        // Refresh data
        fetchData();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create time entry');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error creating time entry:', error);
      }
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create time entry',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Get action color
  const getActionColor = (action: string) => {
    const colors = {
      START: 'bg-green-100 text-green-800',
      PAUSE: 'bg-yellow-100 text-yellow-800',
      RESUME: 'bg-blue-100 text-blue-800',
      COMPLETE: 'bg-purple-100 text-purple-800',
      EXTEND: 'bg-orange-100 text-orange-800',
    };
    return colors[action as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Check if entry is overdue
  const isOverdue = (entry: TimeEntry) => {
    if (!entry.alertThreshold || !entry.duration) return false;
    return entry.duration > entry.alertThreshold * 60; // Convert hours to minutes
  };

  if (loading && !entries.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 mr-2" />
            <span>Loading time tracking data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Entries</p>
                  <p className="text-2xl font-bold">{analytics.overview.totalEntries}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Duration</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(analytics.overview.totalDuration)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Average Duration</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(analytics.overview.averageDuration)}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Overdue Entries</p>
                  <p className="text-2xl font-bold text-red-600">
                    {analytics.overdueEntries.length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Time Tracking Dashboard
              </CardTitle>
              <CardDescription>
                Track and monitor time spent on cases and stages
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Time Entry
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Time Entry</DialogTitle>
                  <DialogDescription>
                    Record a new time tracking entry for a case
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Case ID</Label>
                      <Input
                        value={selectedCase}
                        onChange={(e) => setSelectedCase(e.target.value)}
                        placeholder="Enter case ID"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stage</Label>
                      <Select value={selectedStage} onValueChange={setSelectedStage}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {CASE_STAGES.filter(stage => !['SUSPENDED', 'CANCELLED'].includes(stage.value)).map(stage => (
                            <SelectItem key={stage.value} value={stage.value}>
                              {stage.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Select value={selectedAction} onValueChange={setSelectedAction}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="START">Start</SelectItem>
                        <SelectItem value="PAUSE">Pause</SelectItem>
                        <SelectItem value="RESUME">Resume</SelectItem>
                        <SelectItem value="COMPLETE">Complete</SelectItem>
                        <SelectItem value="EXTEND">Extend</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for this action"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Justification</Label>
                    <Textarea
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      placeholder="Additional justification if needed"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Alert Threshold (hours)</Label>
                    <Input
                      type="number"
                      value={alertThreshold || ''}
                      onChange={(e) => setAlertThreshold(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Set alert threshold in hours"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSubmitTimeEntry}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating...' : 'Create Entry'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="entries">Entries</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {analytics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Time by Stage */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Time by Stage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(analytics.byStage)
                          .sort(([, a], [, b]) => b.totalDuration - a.totalDuration)
                          .slice(0, 5)
                          .map(([stage, data]) => (
                            <div key={stage} className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm font-medium">{stage}</span>
                                  <span className="text-sm text-gray-500">
                                    {formatDuration(data.totalDuration)}
                                  </span>
                                </div>
                                <Progress
                                  value={(data.totalDuration / analytics.overview.totalDuration) * 100}
                                  className="h-2"
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Action Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Action Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(analytics.byAction)
                          .sort(([, a], [, b]) => b - a)
                          .map(([action, count]) => (
                            <div key={action} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge className={getActionColor(action)}>
                                  {action}
                                </Badge>
                                <span className="text-sm text-gray-500">{count} times</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Overdue Alerts */}
              {analytics?.overdueEntries && analytics.overdueEntries.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {analytics.overdueEntries.length} time entries have exceeded their alert thresholds.
                    Review these entries for potential delays.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="entries" className="space-y-4">
              <div className="space-y-4">
                {entries.map((entry) => (
                  <Card key={entry.id} className={isOverdue(entry) ? 'border-red-200' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Badge className={getActionColor(entry.action)}>
                            {entry.action}
                          </Badge>
                          <div>
                            <div className="font-medium">
                              {entry.case.fileNumber} - {entry.case.title}
                            </div>
                            <div className="text-sm text-gray-500">
                              Stage: {entry.stage} • by {entry.user.firstName} {entry.user.lastName}
                            </div>
                            {entry.reason && (
                              <div className="text-sm text-gray-600">
                                Reason: {entry.reason}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {entry.duration ? formatDuration(entry.duration) : 'In progress'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(entry.startTime).toLocaleString()}
                          </div>
                          {isOverdue(entry) && (
                            <Badge variant="destructive" className="mt-1">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              {analytics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Users */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Top Users by Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(analytics.byUser)
                          .sort(([, a], [, b]) => b.totalDuration - a.totalDuration)
                          .slice(0, 10)
                          .map(([userName, data]) => (
                            <div key={data.userId} className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{userName}</div>
                                <div className="text-sm text-gray-500">
                                  {data.count} entries
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">
                                  {formatDuration(data.totalDuration)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Avg: {formatDuration(data.averageDuration)}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Paused Time Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Paused Time Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-yellow-600">
                            {formatDuration(analytics.overview.totalPausedTime)}
                          </div>
                          <div className="text-sm text-gray-500">Total Paused Time</div>
                        </div>
                        <Progress
                          value={(analytics.overview.totalPausedTime / analytics.overview.totalDuration) * 100}
                          className="h-2"
                        />
                        <div className="text-sm text-gray-500 text-center">
                          {Math.round((analytics.overview.totalPausedTime / analytics.overview.totalDuration) * 100)}%
                          of total time was paused
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}