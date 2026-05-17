'use client';

/**
 * Admin Flow Editor Page
 *
 * Visual editor for the assessment flow graph.
 * Allows creating and connecting nodes to define the assessment path.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Plus,
  Save,
  Trash,
  ArrowRight,
  Video,
  HelpCircle,
  GitBranch,
  Award,
  CheckCircle,
  Settings,
} from 'lucide-react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { apiClient } from '@/lib/api-client';
import type {
  AssessmentFlowGraph,
  FlowNode,
  FlowEdge,
  FlowNodeType,
  EdgeConditionType,
  VideoSegment,
  SegmentQuestion,
  SkillBucket,
} from '@bassnotion/contracts';

// Generate a UUID v4-like string
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const NODE_TYPES: { value: FlowNodeType; label: string; icon: typeof Video }[] =
  [
    { value: 'segment', label: 'Video Segment', icon: Video },
    { value: 'question', label: 'Question', icon: HelpCircle },
    {
      value: 'skill_verification',
      label: 'Skill Verification',
      icon: CheckCircle,
    },
    { value: 'branch', label: 'Branch', icon: GitBranch },
    { value: 'result', label: 'Result', icon: Award },
  ];

const EDGE_CONDITIONS: { value: EdgeConditionType; label: string }[] = [
  { value: 'always', label: 'Always (default)' },
  { value: 'answer_equals', label: 'Answer Equals' },
  { value: 'bucket_equals', label: 'Bucket Equals' },
  { value: 'skill_verified', label: 'Skill Check Passed' },
  { value: 'skill_failed', label: 'Skill Check Failed' },
];

const SKILL_BUCKETS: { value: SkillBucket; label: string }[] = [
  { value: 'true_beginner', label: 'True Beginner' },
  { value: 'solid_beginner', label: 'Solid Beginner' },
  { value: 'beginner_with_gaps', label: 'Beginner with Gaps' },
  { value: 'intermediate_theory_gaps', label: 'Intermediate (Theory)' },
  { value: 'solid_intermediate', label: 'Solid Intermediate' },
];

export default function AdminFlowEditorPage() {
  const router = useRouter();
  const { logger } = useCorrelation('AdminFlowEditorPage');
  const { isReady, isAuthenticated } = useAuth();

  // Flow data
  const [flowGraph, setFlowGraph] = useState<AssessmentFlowGraph | null>(null);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [questions, setQuestions] = useState<SegmentQuestion[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Dialogs
  const [isNodeDialogOpen, setIsNodeDialogOpen] = useState(false);
  const [isEdgeDialogOpen, setIsEdgeDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null);
  const [editingEdge, setEditingEdge] = useState<FlowEdge | null>(null);

  // Node form
  const [nodeForm, setNodeForm] = useState({
    nodeId: '',
    nodeType: 'segment' as FlowNodeType,
    segmentId: '',
    questionKey: '',
    title: '',
    description: '',
    positionX: 0,
    positionY: 0,
    isActive: true,
    isEntryPoint: false,
  });

  // Edge form
  const [edgeForm, setEdgeForm] = useState({
    fromNodeId: '',
    toNodeId: '',
    conditionType: 'always' as EdgeConditionType,
    conditionQuestionKey: '',
    conditionValue: '',
    conditionBucket: '' as SkillBucket | '',
    priority: 0,
    label: '',
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [flowResult, segmentsResult, questionsResult] = await Promise.all([
        apiClient.get<{ flow: AssessmentFlowGraph }>(
          '/api/v1/admin/assessment/v2/flow',
        ),
        apiClient.get<{ segments: VideoSegment[] }>(
          '/api/v1/admin/assessment/v2/segments',
        ),
        apiClient.get<{ questions: SegmentQuestion[] }>(
          '/api/v1/admin/assessment/v2/questions',
        ),
      ]);

      setFlowGraph(flowResult.flow);
      setSegments(segmentsResult.segments || []);
      setQuestions(questionsResult.questions || []);
    } catch (err) {
      logger.error('Failed to load flow data', err);
      setError('Failed to load flow data');
    } finally {
      setIsLoading(false);
    }
  }, [logger]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      loadData();
    } else if (isReady && !isAuthenticated) {
      router.push('/login');
    }
  }, [isReady, isAuthenticated, loadData, router]);

  // Save entire flow
  const handleSaveFlow = async () => {
    if (!flowGraph) return;

    try {
      setIsSaving(true);
      await apiClient.put('/api/v1/admin/assessment/v2/flow', {
        nodes: flowGraph.nodes,
        edges: flowGraph.edges,
      });
      setHasChanges(false);
    } catch (err) {
      logger.error('Failed to save flow', err);
      setError('Failed to save flow');
    } finally {
      setIsSaving(false);
    }
  };

  // Node operations
  const handleNewNode = () => {
    setEditingNode(null);
    setNodeForm({
      nodeId: `node_${Date.now()}`,
      nodeType: 'segment',
      segmentId: '',
      questionKey: '',
      title: '',
      description: '',
      positionX: (flowGraph?.nodes.length || 0) * 50,
      positionY: (flowGraph?.nodes.length || 0) * 50,
      isActive: true,
      isEntryPoint: flowGraph?.nodes.length === 0,
    });
    setIsNodeDialogOpen(true);
  };

  const handleEditNode = (node: FlowNode) => {
    setEditingNode(node);
    setNodeForm({
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      segmentId: node.segmentId || '',
      questionKey: node.questionKey || '',
      title: node.title || '',
      description: node.description || '',
      positionX: node.positionX,
      positionY: node.positionY,
      isActive: node.isActive,
      isEntryPoint: node.isEntryPoint,
    });
    setIsNodeDialogOpen(true);
  };

  const handleSaveNode = () => {
    if (!flowGraph) return;

    const newNode: FlowNode = {
      id: editingNode?.id || generateUUID(),
      nodeId: nodeForm.nodeId,
      nodeType: nodeForm.nodeType,
      segmentId: nodeForm.segmentId || undefined,
      questionKey: nodeForm.questionKey || undefined,
      title: nodeForm.title || undefined,
      description: nodeForm.description || undefined,
      positionX: nodeForm.positionX,
      positionY: nodeForm.positionY,
      isActive: nodeForm.isActive,
      isEntryPoint: nodeForm.isEntryPoint,
    };

    let updatedNodes: FlowNode[];
    if (editingNode) {
      updatedNodes = flowGraph.nodes.map((n) =>
        n.id === editingNode.id ? newNode : n,
      );
    } else {
      updatedNodes = [...flowGraph.nodes, newNode];
    }

    // If this is entry point, unset others
    if (nodeForm.isEntryPoint) {
      updatedNodes = updatedNodes.map((n) => ({
        ...n,
        isEntryPoint: n.nodeId === nodeForm.nodeId,
      }));
    }

    setFlowGraph({
      ...flowGraph,
      nodes: updatedNodes,
      entryNodeId: nodeForm.isEntryPoint ? newNode.id : flowGraph.entryNodeId,
    });
    setHasChanges(true);
    setIsNodeDialogOpen(false);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!flowGraph) return;
    if (!confirm('Delete this node and all its edges?')) return;

    setFlowGraph({
      ...flowGraph,
      nodes: flowGraph.nodes.filter((n) => n.id !== nodeId),
      edges: flowGraph.edges.filter(
        (e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId,
      ),
    });
    setHasChanges(true);
  };

  // Edge operations
  const handleNewEdge = () => {
    setEditingEdge(null);
    setEdgeForm({
      fromNodeId: flowGraph?.nodes[0]?.id || '',
      toNodeId: '',
      conditionType: 'always',
      conditionQuestionKey: '',
      conditionValue: '',
      conditionBucket: '',
      priority: 0,
      label: '',
    });
    setIsEdgeDialogOpen(true);
  };

  const handleSaveEdge = () => {
    if (!flowGraph) return;

    const conditionValue: Record<string, unknown> = {};
    if (edgeForm.conditionType === 'answer_equals') {
      conditionValue.questionKey = edgeForm.conditionQuestionKey;
      conditionValue.value = edgeForm.conditionValue;
    } else if (edgeForm.conditionType === 'bucket_equals') {
      conditionValue.bucket = edgeForm.conditionBucket;
    }

    const newEdge: FlowEdge = {
      id: editingEdge?.id || generateUUID(),
      fromNodeId: edgeForm.fromNodeId,
      toNodeId: edgeForm.toNodeId,
      conditionType: edgeForm.conditionType,
      conditionValue:
        Object.keys(conditionValue).length > 0 ? conditionValue : undefined,
      priority: edgeForm.priority,
      label: edgeForm.label || undefined,
    };

    let updatedEdges: FlowEdge[];
    if (editingEdge) {
      updatedEdges = flowGraph.edges.map((e) =>
        e.id === editingEdge.id ? newEdge : e,
      );
    } else {
      updatedEdges = [...flowGraph.edges, newEdge];
    }

    setFlowGraph({ ...flowGraph, edges: updatedEdges });
    setHasChanges(true);
    setIsEdgeDialogOpen(false);
  };

  const handleDeleteEdge = (edgeId: string) => {
    if (!flowGraph) return;
    setFlowGraph({
      ...flowGraph,
      edges: flowGraph.edges.filter((e) => e.id !== edgeId),
    });
    setHasChanges(true);
  };

  // Get node label
  const getNodeLabel = (node: FlowNode): string => {
    if (node.title) return node.title;
    if (node.segmentId) {
      const segment = segments.find((s) => s.id === node.segmentId);
      return segment?.name || node.segmentId;
    }
    if (node.questionKey) {
      const question = questions.find(
        (q) => q.questionKey === node.questionKey,
      );
      return question?.questionText.slice(0, 30) || node.questionKey;
    }
    return node.nodeId;
  };

  // Get node icon
  const NodeIcon = ({ type }: { type: FlowNodeType }) => {
    const config = NODE_TYPES.find((t) => t.value === type);
    const Icon = config?.icon || HelpCircle;
    return <Icon className="w-4 h-4" />;
  };

  if (!isReady || isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flow Editor</h1>
          <p className="text-gray-500 mt-1">
            Design the assessment flow by creating nodes and connecting them
            with edges
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge
              variant="outline"
              className="text-orange-500 border-orange-500"
            >
              Unsaved Changes
            </Badge>
          )}
          <Button onClick={handleNewNode} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Node
          </Button>
          <Button onClick={handleNewEdge} variant="outline">
            <ArrowRight className="w-4 h-4 mr-2" />
            Add Edge
          </Button>
          <Button onClick={handleSaveFlow} disabled={isSaving || !hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Flow'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Nodes Card */}
        <Card>
          <CardHeader>
            <CardTitle>Nodes ({flowGraph?.nodes.length || 0})</CardTitle>
            <CardDescription>
              Video segments, questions, and branch points
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!flowGraph?.nodes.length ? (
              <div className="text-center py-8 text-gray-500">
                <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No nodes yet. Add your first node to start.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {flowGraph.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <NodeIcon type={node.nodeType} />

                    <Badge variant="outline" className="text-xs">
                      {NODE_TYPES.find((t) => t.value === node.nodeType)?.label}
                    </Badge>

                    {node.isEntryPoint && (
                      <Badge className="bg-green-500 text-xs">Entry</Badge>
                    )}

                    <span className="flex-1 truncate font-medium">
                      {getNodeLabel(node)}
                    </span>

                    <span className="text-xs text-gray-400 font-mono">
                      {node.nodeId}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditNode(node)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      onClick={() => handleDeleteNode(node.id)}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edges Card */}
        <Card>
          <CardHeader>
            <CardTitle>Edges ({flowGraph?.edges.length || 0})</CardTitle>
            <CardDescription>
              Connections with conditions that define the flow
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!flowGraph?.edges.length ? (
              <div className="text-center py-8 text-gray-500">
                <ArrowRight className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No edges yet. Connect nodes with edges.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {flowGraph.edges.map((edge) => {
                  const fromNode = flowGraph.nodes.find(
                    (n) => n.id === edge.fromNodeId,
                  );
                  const toNode = flowGraph.nodes.find(
                    (n) => n.id === edge.toNodeId,
                  );
                  return (
                    <div
                      key={edge.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm truncate max-w-[100px]">
                        {fromNode ? getNodeLabel(fromNode) : edge.fromNodeId}
                      </span>

                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

                      <span className="text-sm truncate max-w-[100px]">
                        {toNode ? getNodeLabel(toNode) : edge.toNodeId}
                      </span>

                      <Badge
                        variant="outline"
                        className="text-xs flex-shrink-0"
                      >
                        {
                          EDGE_CONDITIONS.find(
                            (c) => c.value === edge.conditionType,
                          )?.label
                        }
                      </Badge>

                      {edge.label && (
                        <span className="text-xs text-gray-400 truncate">
                          {edge.label}
                        </span>
                      )}

                      <span className="flex-1" />

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        onClick={() => handleDeleteEdge(edge.id)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Node Dialog */}
      <Dialog open={isNodeDialogOpen} onOpenChange={setIsNodeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNode ? 'Edit Node' : 'Add Node'}</DialogTitle>
            <DialogDescription>Configure a flow node</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Node ID</Label>
                <Input
                  value={nodeForm.nodeId}
                  onChange={(e) =>
                    setNodeForm({ ...nodeForm, nodeId: e.target.value })
                  }
                  placeholder="intro_video"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={nodeForm.nodeType}
                  onValueChange={(value) =>
                    setNodeForm({
                      ...nodeForm,
                      nodeType: value as FlowNodeType,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NODE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {nodeForm.nodeType === 'segment' && (
              <div>
                <Label>Video Segment</Label>
                <Select
                  value={nodeForm.segmentId}
                  onValueChange={(value) =>
                    setNodeForm({ ...nodeForm, segmentId: value })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((segment) => (
                      <SelectItem key={segment.id} value={segment.id}>
                        {segment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(nodeForm.nodeType === 'question' ||
              nodeForm.nodeType === 'skill_verification') && (
              <div>
                <Label>Question</Label>
                <Select
                  value={nodeForm.questionKey}
                  onValueChange={(value) =>
                    setNodeForm({ ...nodeForm, questionKey: value })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a question" />
                  </SelectTrigger>
                  <SelectContent>
                    {questions.map((q) => (
                      <SelectItem key={q.questionKey} value={q.questionKey}>
                        {q.questionText.slice(0, 50)}...
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Title (optional)</Label>
              <Input
                value={nodeForm.title}
                onChange={(e) =>
                  setNodeForm({ ...nodeForm, title: e.target.value })
                }
                placeholder="Displayed in editor"
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={nodeForm.isEntryPoint}
                  onChange={(e) =>
                    setNodeForm({ ...nodeForm, isEntryPoint: e.target.checked })
                  }
                />
                <span className="text-sm">Entry Point</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={nodeForm.isActive}
                  onChange={(e) =>
                    setNodeForm({ ...nodeForm, isActive: e.target.checked })
                  }
                />
                <span className="text-sm">Active</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNodeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveNode}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edge Dialog */}
      <Dialog open={isEdgeDialogOpen} onOpenChange={setIsEdgeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEdge ? 'Edit Edge' : 'Add Edge'}</DialogTitle>
            <DialogDescription>
              Create a connection between nodes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Node</Label>
                <Select
                  value={edgeForm.fromNodeId}
                  onValueChange={(value) =>
                    setEdgeForm({ ...edgeForm, fromNodeId: value })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {flowGraph?.nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {getNodeLabel(node)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>To Node</Label>
                <Select
                  value={edgeForm.toNodeId}
                  onValueChange={(value) =>
                    setEdgeForm({ ...edgeForm, toNodeId: value })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {flowGraph?.nodes
                      .filter((n) => n.id !== edgeForm.fromNodeId)
                      .map((node) => (
                        <SelectItem key={node.id} value={node.id}>
                          {getNodeLabel(node)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Condition Type</Label>
              <Select
                value={edgeForm.conditionType}
                onValueChange={(value) =>
                  setEdgeForm({
                    ...edgeForm,
                    conditionType: value as EdgeConditionType,
                  })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDGE_CONDITIONS.map((cond) => (
                    <SelectItem key={cond.value} value={cond.value}>
                      {cond.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {edgeForm.conditionType === 'answer_equals' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Question Key</Label>
                  <Select
                    value={edgeForm.conditionQuestionKey}
                    onValueChange={(value) =>
                      setEdgeForm({ ...edgeForm, conditionQuestionKey: value })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {questions.map((q) => (
                        <SelectItem key={q.questionKey} value={q.questionKey}>
                          {q.questionKey}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Answer Value</Label>
                  <Input
                    value={edgeForm.conditionValue}
                    onChange={(e) =>
                      setEdgeForm({
                        ...edgeForm,
                        conditionValue: e.target.value,
                      })
                    }
                    placeholder="beginner"
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {edgeForm.conditionType === 'bucket_equals' && (
              <div>
                <Label>Bucket</Label>
                <Select
                  value={edgeForm.conditionBucket}
                  onValueChange={(value) =>
                    setEdgeForm({
                      ...edgeForm,
                      conditionBucket: value as SkillBucket,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_BUCKETS.map((bucket) => (
                      <SelectItem key={bucket.value} value={bucket.value}>
                        {bucket.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority (lower = higher)</Label>
                <Input
                  type="number"
                  value={edgeForm.priority}
                  onChange={(e) =>
                    setEdgeForm({
                      ...edgeForm,
                      priority: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Label (optional)</Label>
                <Input
                  value={edgeForm.label}
                  onChange={(e) =>
                    setEdgeForm({ ...edgeForm, label: e.target.value })
                  }
                  placeholder="e.g., 'Yes'"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEdgeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdge}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
