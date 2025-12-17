'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Eye,
  Edit,
  AlertTriangle,
  Star,
  Calendar,
  Send,
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

// Types
interface ReviewAssignment {
  id: string;
  caseId: string;
  reviewType: 'INTERNAL_CONTROL' | 'TECHNICAL_ANALYSIS' | 'LEGAL_REVIEW' | 'FINANCIAL_REVIEW' | 'SUPERVISORY_REVIEW' | 'QUALITY_ASSURANCE';
  assignedTo: string;
  assignedBy: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  instructions?: string;
  dueDate?: string;
  estimatedTime?: number;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  startedAt?: string;
  completedAt?: string;
  parallelWith?: string[];
  dependsOn?: string[];
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assigner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reviews: Review[];
  case: {
    id: string;
    fileNumber: string;
    title: string;
    currentStage: string;
  };
}

interface Review {
  id: string;
  assignmentId: string;
  reviewerId: string;
  findings: string;
  recommendations?: string;
  conclusion: string;
  rating?: number;
  decision: 'APPROVED' | 'REJECTED' | 'CONDITIONAL' | 'NEEDS_REVISION';
  evidence?: any;
  attachments?: string[];
  reviewTime?: number;
  ipAddress?: string;
  createdAt: string;
  updatedAt: string;
}

interface ParallelReviewProps {
  caseId: string;
  caseStage?: string;
  autoAssign?: boolean;
  showCompleted?: boolean;
  onReviewComplete?: (assignment: ReviewAssignment, review: Review) => void;
}

export function ParallelReview({
  caseId,
  onReviewComplete
}: ParallelReviewProps) {
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedAssignment, setSelectedAssignment] = useState<ReviewAssignment | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewData, setReviewData] = useState({
    findings: '',
    recommendations: '',
    conclusion: '',
    rating: 3,
    decision: 'APPROVED' as const,
    attachments: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch review assignments
  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reviews/assignments?caseId=${caseId}`);
      if (response.ok) {
        const data = await response.json();
        setAssignments(data);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching review assignments:', error);
      }
      toast({
        title: 'Error',
        description: 'Failed to fetch review assignments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [caseId, toast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Handle review submission
  const handleSubmitReview = async () => {
    if (!selectedAssignment) return;

    if (!reviewData.findings || !reviewData.conclusion) {
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
        assignmentId: selectedAssignment.id,
        findings: reviewData.findings,
        recommendations: reviewData.recommendations,
        conclusion: reviewData.conclusion,
        rating: reviewData.rating,
        decision: reviewData.decision,
        attachments: reviewData.attachments,
      };

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const review = await response.json();
        toast({
          title: 'Success',
          description: 'Review submitted successfully',
        });

        // Update assignment status
        await fetch(`/api/reviews/assignments/${selectedAssignment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
          }),
        });

        // Reset form
        setReviewData({
          findings: '',
          recommendations: '',
          conclusion: '',
          rating: 3,
          decision: 'APPROVED',
          attachments: [],
        });
        setIsReviewDialogOpen(false);
        setSelectedAssignment(null);

        // Refresh data
        fetchAssignments();

        // Callback
        if (onReviewComplete) {
          onReviewComplete(selectedAssignment, review);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit review');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error submitting review:', error);
      }
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit review',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get filtered assignments based on active tab
  const getFilteredAssignments = () => {
    switch (activeTab) {
      case 'pending':
        return assignments.filter(a => a.status === 'ASSIGNED' || a.status === 'IN_PROGRESS');
      case 'completed':
        return assignments.filter(a => a.status === 'COMPLETED');
      case 'overdue':
        return assignments.filter(a => {
          if (!a.dueDate) return false;
          return new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED';
        });
      default:
        return assignments;
    }
  };

  // Get review type color
  const getReviewTypeColor = (type: string) => {
    const colors = {
      INTERNAL_CONTROL: 'bg-blue-100 text-blue-800',
      TECHNICAL_ANALYSIS: 'bg-green-100 text-green-800',
      LEGAL_REVIEW: 'bg-purple-100 text-purple-800',
      FINANCIAL_REVIEW: 'bg-yellow-100 text-yellow-800',
      SUPERVISORY_REVIEW: 'bg-red-100 text-red-800',
      QUALITY_ASSURANCE: 'bg-indigo-100 text-indigo-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors = {
      ASSIGNED: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Get decision color
  const getDecisionColor = (decision: string) => {
    const colors = {
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CONDITIONAL: 'bg-yellow-100 text-yellow-800',
      NEEDS_REVISION: 'bg-orange-100 text-orange-800',
    };
    return colors[decision as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Check if assignment is overdue
  const isOverdue = (assignment: ReviewAssignment) => {
    if (!assignment.dueDate || assignment.status === 'COMPLETED') return false;
    return new Date(assignment.dueDate) < new Date();
  };

  // Calculate progress
  const calculateProgress = () => {
    if (assignments.length === 0) return 0;
    const completed = assignments.filter(a => a.status === 'COMPLETED').length;
    return Math.round((completed / assignments.length) * 100);
  };

  if (loading && !assignments.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 mr-2" />
            <span>Loading review assignments...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredAssignments = getFilteredAssignments();
  const progress = calculateProgress();

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Parallel Review System
              </CardTitle>
              <CardDescription>
                Manage parallel reviews for case {caseId}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{progress}%</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-2" />
          <div className="mt-2 flex justify-between text-sm text-gray-500">
            <span>
              {assignments.filter(a => a.status === 'COMPLETED').length} of {assignments.length} reviews
            </span>
            {assignments.some(a => isOverdue(a)) && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overdue Reviews
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
              <TabsTrigger value="all">All Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4 mt-6">
              {filteredAssignments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No review assignments found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAssignments.map((assignment) => {
                    const latestReview = assignment.reviews[assignment.reviews.length - 1];
                    const isOverdueAssignment = isOverdue(assignment);

                    return (
                      <Card
                        key={assignment.id}
                        className={isOverdueAssignment ? 'border-red-200' : ''}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-3">
                              {/* Header */}
                              <div className="flex items-center gap-3">
                                <Badge className={getReviewTypeColor(assignment.reviewType)}>
                                  {assignment.reviewType.replace('_', ' ')}
                                </Badge>
                                <Badge className={getStatusColor(assignment.status)}>
                                  {assignment.status.replace('_', ' ')}
                                </Badge>
                                <Badge variant="outline">
                                  {assignment.priority}
                                </Badge>
                                {isOverdueAssignment && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Overdue
                                  </Badge>
                                )}
                              </div>

                              {/* Case Info */}
                              <div>
                                <h3 className="font-medium">
                                  {assignment.case.fileNumber} - {assignment.case.title}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  Assigned to: {assignment.assignee.firstName} {assignment.assignee.lastName}
                                  ({assignment.assignee.email})
                                </p>
                              </div>

                              {/* Instructions */}
                              {assignment.instructions && (
                                <div className="bg-gray-50 p-3 rounded">
                                  <p className="text-sm text-gray-700">
                                    <strong>Instructions:</strong> {assignment.instructions}
                                  </p>
                                </div>
                              )}

                              {/* Latest Review */}
                              {latestReview && (
                                <div className="border-l-4 border-blue-200 pl-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className={getDecisionColor(latestReview.decision)}>
                                      {latestReview.decision}
                                    </Badge>
                                    {latestReview.rating && (
                                      <div className="flex items-center">
                                        {[...Array(5)].map((_, i) => (
                                          <Star
                                            key={i}
                                            className={`h-4 w-4 ${
                                              i < latestReview.rating!
                                                ? 'text-yellow-400 fill-current'
                                                : 'text-gray-300'
                                            }`}
                                          />
                                        ))}
                                      </div>
                                    )}
                                    <span className="text-sm text-gray-500">
                                      {new Date(latestReview.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700">
                                    <strong>Conclusion:</strong> {latestReview.conclusion}
                                  </p>
                                  {latestReview.recommendations && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      <strong>Recommendations:</strong> {latestReview.recommendations}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Due Date */}
                              {assignment.dueDate && (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Calendar className="h-4 w-4" />
                                  Due: {new Date(assignment.dueDate).toLocaleString()}
                                  {assignment.estimatedTime && (
                                    <span>• Est. {assignment.estimatedTime}h</span>
                                  )}
                                </div>
                              )}

                              {/* Parallel Reviews */}
                              {assignment.parallelWith && assignment.parallelWith.length > 0 && (
                                <div className="text-sm text-gray-500">
                                  <strong>Parallel with:</strong> {assignment.parallelWith.length} other reviews
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 ml-4">
                              {assignment.status === 'ASSIGNED' || assignment.status === 'IN_PROGRESS' ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedAssignment(assignment);
                                    setIsReviewDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Submit Review
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedAssignment(assignment)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View Details
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Review</DialogTitle>
            <DialogDescription>
              {selectedAssignment && (
                <>Review for {selectedAssignment.case.fileNumber} - {selectedAssignment.case.title}</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Findings */}
            <div className="space-y-2">
              <Label htmlFor="findings">Findings *</Label>
              <Textarea
                id="findings"
                placeholder="Describe your findings..."
                value={reviewData.findings}
                onChange={(e) => setReviewData(prev => ({ ...prev, findings: e.target.value }))}
                rows={4}
              />
            </div>

            {/* Recommendations */}
            <div className="space-y-2">
              <Label htmlFor="recommendations">Recommendations</Label>
              <Textarea
                id="recommendations"
                placeholder="Provide recommendations..."
                value={reviewData.recommendations}
                onChange={(e) => setReviewData(prev => ({ ...prev, recommendations: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Conclusion */}
            <div className="space-y-2">
              <Label htmlFor="conclusion">Conclusion *</Label>
              <Textarea
                id="conclusion"
                placeholder="Provide your conclusion..."
                value={reviewData.conclusion}
                onChange={(e) => setReviewData(prev => ({ ...prev, conclusion: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Decision */}
            <div className="space-y-2">
              <Label>Decision *</Label>
              <Select
                value={reviewData.decision}
                onValueChange={(value: any) => setReviewData(prev => ({ ...prev, decision: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                  <SelectItem value="NEEDS_REVISION">Needs Revision</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rating */}
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex items-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReviewData(prev => ({ ...prev, rating: i + 1 }))}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        i < reviewData.rating
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-sm text-gray-500 ml-2">
                  {reviewData.rating} / 5
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReviewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitReview}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}