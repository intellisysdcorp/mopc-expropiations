'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Plus,
  Reply,
  Eye,
  AlertTriangle,
  User,
  Calendar,
  Search,
  Send,
  Tag
} from 'lucide-react';
import clientLogger from '@/lib/client-logger';

// Types
interface Observation {
  id: string;
  caseId: string;
  stage?: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'BLOCKING';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESPONDED' | 'RESOLVED' | 'CLOSED' | 'ESCALATED';
  observedBy: string;
  assignedTo?: string;
  deadline?: string;
  resolvedAt?: string;
  parentObservationId?: string;
  responseTo?: string;
  tags?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
  observer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  parentObservation?: {
    id: string;
    title: string;
  };
  childObservations: Observation[];
  responses: ObservationResponse[];
  _count: {
    childObservations: number;
    responses: number;
  };
}

interface ObservationResponse {
  id: string;
  observationId: string;
  userId: string;
  response: string;
  responseType: 'ACKNOWLEDGMENT' | 'CLARIFICATION' | 'ACTION' | 'RESOLUTION';
  attachments?: string[];
  responseTime?: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  observation: {
    id: string;
    title: string;
  };
}

interface ObservationSystemProps {
  caseId: string;
  stage?: string;
  allowCreate?: boolean;
  allowRespond?: boolean;
  showResolved?: boolean;
  compact?: boolean;
  onObservationUpdate?: (observation: Observation) => void;
}

export function ObservationSystem({
  caseId,
  stage,
  allowCreate = true,
  allowRespond = true,
  showResolved = true,
  onObservationUpdate
}: ObservationSystemProps) {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [selectedObservation, setSelectedObservation] = useState<Observation | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [observationData, setObservationData] = useState({
    title: '',
    description: '',
    category: '',
    subcategory: '',
    priority: 'MEDIUM' as const,
    assignedTo: '',
    deadline: '',
    tags: '',
  });
  const [responseData, setResponseData] = useState({
    response: '',
    responseType: 'ACKNOWLEDGMENT' as const,
    attachments: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch observations
  const fetchObservations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('caseId', caseId);
      if (stage) params.append('stage', stage);
      if (filterPriority !== 'all') params.append('priority', filterPriority);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`/api/observations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setObservations(data);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error fetching observations:', error);
      }
      toast({
        title: 'Error',
        description: 'Failed to fetch observations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [caseId, filterPriority, filterStatus, stage, toast]);

  // Create observation
  const createObservation = async () => {
    if (!observationData.title || !observationData.description || !observationData.category) {
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
        caseId,
        stage,
        title: observationData.title,
        description: observationData.description,
        category: observationData.category,
        subcategory: observationData.subcategory || undefined,
        priority: observationData.priority,
        assignedTo: observationData.assignedTo || undefined,
        deadline: observationData.deadline ? new Date(observationData.deadline).toISOString() : undefined,
        tags: observationData.tags || undefined,
      };

      const response = await fetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const observation = await response.json();
        toast({
          title: 'Success',
          description: 'Observation created successfully',
        });

        // Reset form
        setObservationData({
          title: '',
          description: '',
          category: '',
          subcategory: '',
          priority: 'MEDIUM',
          assignedTo: '',
          deadline: '',
          tags: '',
        });
        setIsCreateDialogOpen(false);

        // Refresh data
        fetchObservations();

        // Callback
        if (onObservationUpdate) {
          onObservationUpdate(observation);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create observation');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error creating observation:', error);
      }
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create observation',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create response
  const createResponse = async () => {
    if (!selectedObservation || !responseData.response) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a response',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        observationId: selectedObservation.id,
        response: responseData.response,
        responseType: responseData.responseType,
        attachments: responseData.attachments,
      };

      const response = await fetch('/api/observations/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await response.json();
        toast({
          title: 'Success',
          description: 'Response added successfully',
        });

        // Reset form
        setResponseData({
          response: '',
          responseType: 'ACKNOWLEDGMENT',
          attachments: [],
        });
        setIsResponseDialogOpen(false);
        setSelectedObservation(null);

        // Refresh data
        fetchObservations();

        // Callback
        if (onObservationUpdate) {
          onObservationUpdate(selectedObservation);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create response');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        clientLogger.error('Error creating response:', error);
      }
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create response',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get filtered observations
  const getFilteredObservations = () => {
    let filtered = [...observations];

    // Filter by tab
    switch (activeTab) {
      case 'open':
        filtered = filtered.filter(o => o.status === 'OPEN' || o.status === 'IN_PROGRESS');
        break;
      case 'resolved':
        filtered = filtered.filter(o => o.status === 'RESOLVED' || o.status === 'CLOSED');
        break;
      case 'escalated':
        filtered = filtered.filter(o => o.status === 'ESCALATED');
        break;
      case 'all':
        // Show all based on showResolved prop
        if (!showResolved) {
          filtered = filtered.filter(o => o.status !== 'RESOLVED' && o.status !== 'CLOSED');
        }
        break;
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(o =>
        o.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    const colors = {
      LOW: 'bg-gray-100 text-gray-800',
      MEDIUM: 'bg-blue-100 text-blue-800',
      HIGH: 'bg-orange-100 text-orange-800',
      CRITICAL: 'bg-red-100 text-red-800',
      BLOCKING: 'bg-red-200 text-red-900',
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors = {
      OPEN: 'bg-yellow-100 text-yellow-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      RESPONDED: 'bg-purple-100 text-purple-800',
      RESOLVED: 'bg-green-100 text-green-800',
      CLOSED: 'bg-gray-100 text-gray-800',
      ESCALATED: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Get response type color
  const getResponseTypeColor = (type: string) => {
    const colors = {
      ACKNOWLEDGMENT: 'bg-blue-100 text-blue-800',
      CLARIFICATION: 'bg-yellow-100 text-yellow-800',
      ACTION: 'bg-orange-100 text-orange-800',
      RESOLUTION: 'bg-green-100 text-green-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Check if observation is overdue
  const isOverdue = (observation: Observation) => {
    if (!observation.deadline || observation.status === 'RESOLVED' || observation.status === 'CLOSED') {
      return false;
    }
    return new Date(observation.deadline) < new Date();
  };

  useEffect(() => {
    fetchObservations();
  }, [fetchObservations]);

  const filteredObservations = getFilteredObservations();

  if (loading && !observations.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 mr-2" />
            <span>Loading observations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Observations & Responses
              </CardTitle>
              <CardDescription>
                Manage observations for case {caseId}
              </CardDescription>
            </div>
            {allowCreate && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Observation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Observation</DialogTitle>
                    <DialogDescription>
                      Record a new observation for this case
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input
                        value={observationData.title}
                        onChange={(e) => setObservationData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Brief title of the observation"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Textarea
                        value={observationData.description}
                        onChange={(e) => setObservationData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Detailed description of the observation"
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category *</Label>
                        <Input
                          value={observationData.category}
                          onChange={(e) => setObservationData(prev => ({ ...prev, category: e.target.value }))}
                          placeholder="e.g., Legal, Technical, Financial"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subcategory</Label>
                        <Input
                          value={observationData.subcategory}
                          onChange={(e) => setObservationData(prev => ({ ...prev, subcategory: e.target.value }))}
                          placeholder="More specific category"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select
                          value={observationData.priority}
                          onValueChange={(value: any) => setObservationData(prev => ({ ...prev, priority: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="CRITICAL">Critical</SelectItem>
                            <SelectItem value="BLOCKING">Blocking</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Deadline</Label>
                        <Input
                          type="datetime-local"
                          value={observationData.deadline}
                          onChange={(e) => setObservationData(prev => ({ ...prev, deadline: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Assigned To</Label>
                      <Input
                        value={observationData.assignedTo}
                        onChange={(e) => setObservationData(prev => ({ ...prev, assignedTo: e.target.value }))}
                        placeholder="User ID or email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tags</Label>
                      <Input
                        value={observationData.tags}
                        onChange={(e) => setObservationData(prev => ({ ...prev, tags: e.target.value }))}
                        placeholder="Comma-separated tags"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={createObservation}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Creating...' : 'Create Observation'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search observations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="BLOCKING">Blocking</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RESPONDED">Responded</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="open">Open ({observations.filter(o => o.status === 'OPEN' || o.status === 'IN_PROGRESS').length})</TabsTrigger>
              <TabsTrigger value="resolved">Resolved ({observations.filter(o => o.status === 'RESOLVED' || o.status === 'CLOSED').length})</TabsTrigger>
              <TabsTrigger value="escalated">Escalated ({observations.filter(o => o.status === 'ESCALATED').length})</TabsTrigger>
              <TabsTrigger value="all">All ({observations.length})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4 mt-6">
              {filteredObservations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No observations found</p>
                  {allowCreate && (
                    <p className="text-sm mt-2">Create an observation to get started</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredObservations.map((observation) => {
                    const overdue = isOverdue(observation);

                    return (
                      <Card
                        key={observation.id}
                        className={overdue ? 'border-red-200' : ''}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-3">
                              {/* Header */}
                              <div className="flex items-center gap-3">
                                <h3 className="font-medium">{observation.title}</h3>
                                <Badge className={getPriorityColor(observation.priority)}>
                                  {observation.priority}
                                </Badge>
                                <Badge className={getStatusColor(observation.status)}>
                                  {observation.status.replace('_', ' ')}
                                </Badge>
                                {overdue && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Overdue
                                  </Badge>
                                )}
                                {observation._count.responses > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    <MessageSquare className="h-3 w-3 mr-1" />
                                    {observation._count.responses} responses
                                  </Badge>
                                )}
                              </div>

                              {/* Description */}
                              <p className="text-sm text-gray-700">{observation.description}</p>

                              {/* Categories */}
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span><strong>Category:</strong> {observation.category}</span>
                                {observation.subcategory && (
                                  <span><strong>Subcategory:</strong> {observation.subcategory}</span>
                                )}
                                {observation.deadline && (
                                  <span className={overdue ? 'text-red-600' : ''}>
                                    <Calendar className="h-3 w-3 inline mr-1" />
                                    Deadline: {new Date(observation.deadline).toLocaleDateString()}
                                  </span>
                                )}
                              </div>

                              {/* Assignment */}
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <User className="h-3 w-3" />
                                <span>From: {observation.observer.firstName} {observation.observer.lastName}</span>
                                {observation.assignee && (
                                  <>
                                    <span>→</span>
                                    <span>To: {observation.assignee.firstName} {observation.assignee.lastName}</span>
                                  </>
                                )}
                              </div>

                              {/* Tags */}
                              {observation.tags && (
                                <div className="flex items-center gap-2">
                                  <Tag className="h-3 w-3 text-gray-400" />
                                  <div className="flex flex-wrap gap-1">
                                    {observation.tags.split(',').map((tag, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {tag.trim()}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Latest Response */}
                              {observation.responses.length > 0 && (
                                <div className="border-l-4 border-blue-200 pl-4 mt-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className={getResponseTypeColor(observation.responses[0]!.responseType)}>
                                      {observation.responses[0]!.responseType}
                                    </Badge>
                                    <span className="text-sm text-gray-500">
                                      by {observation.responses[0]!.user.firstName} {observation.responses[0]!.user.lastName}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      {new Date(observation.responses[0]!.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700">
                                    {observation.responses[0]!.response}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedObservation(observation)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Details
                              </Button>
                              {allowRespond && observation.status !== 'RESOLVED' && observation.status !== 'CLOSED' && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedObservation(observation);
                                    setIsResponseDialogOpen(true);
                                  }}
                                >
                                  <Reply className="h-3 w-3 mr-1" />
                                  Respond
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

      {/* Observation Details */}
      {selectedObservation && (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedObservation.title}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedObservation(null)}
              >
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Badge className={getStatusColor(selectedObservation.status)}>
                  {selectedObservation.status.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <Label>Priority</Label>
                <Badge className={getPriorityColor(selectedObservation.priority)}>
                  {selectedObservation.priority}
                </Badge>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <p className="text-sm text-gray-700 mt-1">{selectedObservation.description}</p>
            </div>

            {/* Responses */}
            {selectedObservation.responses.length > 0 && (
              <div className="space-y-3">
                <Label>Responses</Label>
                {selectedObservation.responses.map((response) => (
                  <div key={response.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getResponseTypeColor(response.responseType)}>
                          {response.responseType}
                        </Badge>
                        <span className="text-sm font-medium">
                          {response.user.firstName} {response.user.lastName}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(response.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{response.response}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Response Dialog */}
      <Dialog open={isResponseDialogOpen} onOpenChange={setIsResponseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Observation</DialogTitle>
            <DialogDescription>
              {selectedObservation && `Responding to: ${selectedObservation.title}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Response Type</Label>
              <Select
                value={responseData.responseType}
                onValueChange={(value: any) => setResponseData(prev => ({ ...prev, responseType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACKNOWLEDGMENT">Acknowledgment</SelectItem>
                  <SelectItem value="CLARIFICATION">Clarification</SelectItem>
                  <SelectItem value="ACTION">Action</SelectItem>
                  <SelectItem value="RESOLUTION">Resolution</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Response *</Label>
              <Textarea
                value={responseData.response}
                onChange={(e) => setResponseData(prev => ({ ...prev, response: e.target.value }))}
                placeholder="Enter your response..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResponseDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={createResponse}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Response
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}