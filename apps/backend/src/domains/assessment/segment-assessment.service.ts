import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  SkillBucket,
  VideoSegment,
  FlowNode,
  FlowEdge,
  AssessmentFlowGraph,
  SegmentQuestion,
  CoachInsightTemplate,
  AssessmentSession,
  SegmentAssessmentResult,
  EdgeConditionValue,
} from '@bassnotion/contracts';
import { SegmentAssessmentRepository } from './repositories/segment-assessment.repository.js';
import { AssessmentRepository } from './repositories/assessment.repository.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';

/**
 * Service for segment-based assessment system.
 * Handles graph navigation, bucket determination, insight matching,
 * and assessment completion.
 */
@Injectable()
export class SegmentAssessmentService {
  private readonly staticLogger = createStructuredLogger(
    SegmentAssessmentService.name,
  );

  constructor(
    private readonly segmentRepository: SegmentAssessmentRepository,
    private readonly legacyRepository: AssessmentRepository,
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  private get logger() {
    return this.requestContext?.getLogger() || this.staticLogger;
  }

  private get correlationId() {
    return this.requestContext?.getCorrelationId();
  }

  // ==========================================================================
  // Flow Graph
  // ==========================================================================

  /**
   * Get the complete assessment flow graph
   */
  async getFlowGraph(): Promise<AssessmentFlowGraph> {
    this.logger.debug('Getting flow graph', { correlationId: this.correlationId });
    return this.segmentRepository.getFlowGraph();
  }

  /**
   * Get the entry node for starting the assessment
   */
  async getEntryNode(): Promise<FlowNode> {
    const graph = await this.getFlowGraph();
    const entryNode = graph.nodes.find((n) => n.isEntryPoint);

    if (!entryNode) {
      throw new NotFoundException('No entry point configured for assessment');
    }

    return entryNode;
  }

  /**
   * Determine the next node based on current node and user's answer
   */
  async determineNextNode(
    currentNodeId: string,
    answers: Record<string, unknown>,
    determinedBucket?: SkillBucket,
    skillCheckPassed?: boolean,
  ): Promise<FlowNode | null> {
    this.logger.debug('Determining next node', {
      currentNodeId,
      determinedBucket,
      skillCheckPassed,
      correlationId: this.correlationId,
    });

    // Get outgoing edges from current node
    const edges = await this.segmentRepository.getOutgoingEdges(currentNodeId);

    if (edges.length === 0) {
      // No outgoing edges - this might be a result node
      return null;
    }

    // Sort by priority (lower = higher priority)
    const sortedEdges = [...edges].sort((a, b) => a.priority - b.priority);

    // Find first matching edge
    for (const edge of sortedEdges) {
      if (this.evaluateEdgeCondition(edge, answers, determinedBucket, skillCheckPassed)) {
        // Get the target node
        const targetNode = await this.segmentRepository.getFlowNodeById(edge.toNodeId);
        if (targetNode) {
          return targetNode;
        }
      }
    }

    // No matching edge found - try 'always' condition as fallback
    const alwaysEdge = sortedEdges.find((e) => e.conditionType === 'always');
    if (alwaysEdge) {
      return this.segmentRepository.getFlowNodeById(alwaysEdge.toNodeId);
    }

    this.logger.warn('No matching edge found for node', {
      currentNodeId,
      correlationId: this.correlationId,
    });
    return null;
  }

  /**
   * Evaluate if an edge's condition is satisfied
   */
  private evaluateEdgeCondition(
    edge: FlowEdge,
    answers: Record<string, unknown>,
    determinedBucket?: SkillBucket,
    skillCheckPassed?: boolean,
  ): boolean {
    const condition = edge.conditionValue as EdgeConditionValue | undefined;

    switch (edge.conditionType) {
      case 'always':
        return true;

      case 'answer_equals':
        if (!condition?.questionKey || condition.value === undefined) {
          return false;
        }
        return answers[condition.questionKey] === condition.value;

      case 'bucket_equals':
        if (!condition?.bucket) {
          return false;
        }
        return determinedBucket === condition.bucket;

      case 'skill_verified':
        return skillCheckPassed === true;

      case 'skill_failed':
        return skillCheckPassed === false;

      default:
        return false;
    }
  }

  // ==========================================================================
  // Video Segments
  // ==========================================================================

  /**
   * Get all video segments
   */
  async getSegments(): Promise<VideoSegment[]> {
    return this.segmentRepository.getSegments();
  }

  /**
   * Get a segment by ID
   */
  async getSegmentById(id: string): Promise<VideoSegment> {
    const segment = await this.segmentRepository.getSegmentById(id);
    if (!segment) {
      throw new NotFoundException(`Segment not found: ${id}`);
    }
    return segment;
  }

  /**
   * Get segments for a specific topic
   */
  async getSegmentsByTopic(topic: string): Promise<VideoSegment[]> {
    return this.segmentRepository.getSegmentsByTopic(topic);
  }

  /**
   * Create a new segment (admin)
   */
  async createSegment(
    segment: Omit<VideoSegment, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<VideoSegment> {
    this.logger.info('Creating segment', { name: segment.name, correlationId: this.correlationId });
    return this.segmentRepository.createSegment(segment);
  }

  /**
   * Update a segment (admin)
   */
  async updateSegment(id: string, updates: Partial<VideoSegment>): Promise<VideoSegment> {
    this.logger.info('Updating segment', { id, correlationId: this.correlationId });
    return this.segmentRepository.updateSegment(id, updates);
  }

  /**
   * Delete a segment (admin)
   */
  async deleteSegment(id: string): Promise<void> {
    this.logger.info('Deleting segment', { id, correlationId: this.correlationId });
    await this.segmentRepository.deleteSegment(id);
  }

  // ==========================================================================
  // Questions
  // ==========================================================================

  /**
   * Get all questions
   */
  async getQuestions(): Promise<SegmentQuestion[]> {
    return this.segmentRepository.getQuestions();
  }

  /**
   * Get a question by key
   */
  async getQuestionByKey(questionKey: string): Promise<SegmentQuestion> {
    const question = await this.segmentRepository.getQuestionByKey(questionKey);
    if (!question) {
      throw new NotFoundException(`Question not found: ${questionKey}`);
    }
    return question;
  }

  /**
   * Verify a skill check answer
   */
  async verifySkillCheckAnswer(
    questionKey: string,
    answer: string,
  ): Promise<{ isCorrect: boolean; feedback?: string }> {
    const question = await this.getQuestionByKey(questionKey);

    if (question.questionType !== 'skill-verification') {
      throw new BadRequestException('Question is not a skill verification type');
    }

    const config = question.verificationConfig;
    if (!config) {
      throw new BadRequestException('Question has no verification config');
    }

    const isCorrect = answer === config.correctAnswer;
    return {
      isCorrect,
      feedback: isCorrect ? undefined : config.wrongAnswerFeedback,
    };
  }

  /**
   * Create a question (admin)
   */
  async createQuestion(question: Omit<SegmentQuestion, 'id'>): Promise<SegmentQuestion> {
    this.logger.info('Creating question', { questionKey: question.questionKey, correlationId: this.correlationId });
    return this.segmentRepository.createQuestion(question);
  }

  /**
   * Update a question (admin)
   */
  async updateQuestion(id: string, updates: Partial<SegmentQuestion>): Promise<SegmentQuestion> {
    this.logger.info('Updating question', { id, correlationId: this.correlationId });
    return this.segmentRepository.updateQuestion(id, updates);
  }

  /**
   * Delete a question (admin)
   */
  async deleteQuestion(id: string): Promise<void> {
    this.logger.info('Deleting question', { id, correlationId: this.correlationId });
    await this.segmentRepository.deleteQuestion(id);
  }

  // ==========================================================================
  // Bucket Determination
  // ==========================================================================

  /**
   * Determine the user's skill bucket based on their answers
   */
  determineBucket(
    selfReportedLevel: string,
    skillCheckResults: { passed: boolean; score: number } | null,
  ): SkillBucket {
    this.logger.debug('Determining bucket', {
      selfReportedLevel,
      skillCheckResults,
      correlationId: this.correlationId,
    });

    // If user reported complete beginner, no skill check needed
    if (selfReportedLevel === 'complete_beginner') {
      return 'true_beginner';
    }

    // If user reported knowing basics
    if (selfReportedLevel === 'know_basics') {
      if (skillCheckResults?.passed) {
        return 'solid_beginner';
      }
      return 'true_beginner'; // Failed skill check
    }

    // If user reported intermediate
    if (selfReportedLevel === 'intermediate') {
      if (!skillCheckResults) {
        return 'beginner_with_gaps'; // No skill check taken
      }

      if (skillCheckResults.passed && skillCheckResults.score >= 80) {
        return 'solid_intermediate';
      } else if (skillCheckResults.passed) {
        return 'intermediate_theory_gaps';
      }
      return 'beginner_with_gaps'; // Failed skill check
    }

    // If user reported advanced, treat same as solid intermediate for now
    if (selfReportedLevel === 'advanced') {
      if (skillCheckResults?.passed && skillCheckResults.score >= 80) {
        return 'solid_intermediate';
      }
      return 'intermediate_theory_gaps';
    }

    // Default fallback
    return 'true_beginner';
  }

  // ==========================================================================
  // Coach Insights
  // ==========================================================================

  /**
   * Get all insight templates (admin)
   */
  async getInsightTemplates(): Promise<CoachInsightTemplate[]> {
    return this.segmentRepository.getInsightTemplates();
  }

  /**
   * Find the best matching coach insight for a user
   */
  async findMatchingInsight(
    bucket: SkillBucket,
    goal?: string,
    struggle?: string,
    practiceTime?: string,
  ): Promise<CoachInsightTemplate> {
    this.logger.debug('Finding matching insight', {
      bucket,
      goal,
      struggle,
      practiceTime,
      correlationId: this.correlationId,
    });

    const insight = await this.segmentRepository.findMatchingInsight(
      bucket,
      goal,
      struggle,
      practiceTime,
    );

    if (!insight) {
      throw new NotFoundException(`No coach insight found for bucket: ${bucket}`);
    }

    return insight;
  }

  /**
   * Create an insight template (admin)
   */
  async createInsightTemplate(
    template: Omit<CoachInsightTemplate, 'id'>,
  ): Promise<CoachInsightTemplate> {
    this.logger.info('Creating insight template', {
      bucket: template.targetBucket,
      correlationId: this.correlationId,
    });
    return this.segmentRepository.createInsightTemplate(template);
  }

  /**
   * Update an insight template (admin)
   */
  async updateInsightTemplate(
    id: string,
    updates: Partial<CoachInsightTemplate>,
  ): Promise<CoachInsightTemplate> {
    this.logger.info('Updating insight template', { id, correlationId: this.correlationId });
    return this.segmentRepository.updateInsightTemplate(id, updates);
  }

  /**
   * Delete an insight template (admin)
   */
  async deleteInsightTemplate(id: string): Promise<void> {
    this.logger.info('Deleting insight template', { id, correlationId: this.correlationId });
    await this.segmentRepository.deleteInsightTemplate(id);
  }

  // ==========================================================================
  // Sessions
  // ==========================================================================

  /**
   * Create a new assessment session
   */
  async createSession(userId?: string): Promise<AssessmentSession> {
    this.logger.info('Creating assessment session', { userId, correlationId: this.correlationId });
    return this.segmentRepository.createSession(userId);
  }

  /**
   * Get user's current in-progress session
   */
  async getCurrentSession(userId: string): Promise<AssessmentSession | null> {
    return this.segmentRepository.getCurrentSession(userId);
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<AssessmentSession> {
    const session = await this.segmentRepository.getSessionById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Update session progress
   */
  async updateSession(
    sessionId: string,
    updates: {
      currentNodeId?: string;
      answers?: Record<string, unknown>;
      visitedNodeIds?: string[];
      selfReportedLevel?: string;
      determinedBucket?: SkillBucket;
      skillCheckPassed?: boolean;
      skillCheckScore?: number;
    },
  ): Promise<AssessmentSession> {
    this.logger.debug('Updating session', { sessionId, correlationId: this.correlationId });
    return this.segmentRepository.updateSession(sessionId, updates);
  }

  // ==========================================================================
  // Assessment Completion
  // ==========================================================================

  /**
   * Complete the assessment and save results
   */
  async completeAssessment(
    userId: string,
    sessionId: string,
    bucket: SkillBucket,
    answers: Record<string, unknown>,
    skillCheckScore?: number,
  ): Promise<SegmentAssessmentResult> {
    this.logger.info('Completing assessment', {
      userId,
      sessionId,
      bucket,
      correlationId: this.correlationId,
    });

    // Extract goal and other values from answers
    const goal = answers.goal as string | undefined;
    const struggle = answers.struggle as string | undefined;
    const practiceTime = answers.practice_time as string | undefined;

    // Find matching coach insight
    const coachInsight = await this.findMatchingInsight(bucket, goal, struggle, practiceTime);

    // Mark session as complete
    await this.segmentRepository.completeSession(sessionId);

    // Update user's profile with bucket
    await this.segmentRepository.updateUserBucket(userId, bucket);

    // Also update the legacy assessment fields for compatibility
    await this.legacyRepository.saveResults(userId, {
      skillLevel: this.bucketToSkillLevel(bucket),
      assessmentScore: skillCheckScore ?? 0,
      primaryGoal: (goal as any) || 'jam_for_fun',
      preferredTechniques: [],
      preferredGenres: [],
    });

    // Assign learning journey based on bucket and goal
    const assignedJourneyId = await this.assignJourney(userId, bucket, goal);

    const result: SegmentAssessmentResult = {
      bucket,
      answers,
      skillCheckScore,
      coachInsight,
      assignedJourneyId: assignedJourneyId ?? undefined,
      completedAt: new Date().toISOString(),
    };

    this.logger.info('Assessment completed', {
      userId,
      bucket,
      assignedJourneyId,
      correlationId: this.correlationId,
    });

    return result;
  }

  /**
   * Convert bucket to legacy skill level
   */
  private bucketToSkillLevel(bucket: SkillBucket): 'beginner' | 'intermediate' | 'advanced' {
    switch (bucket) {
      case 'true_beginner':
      case 'solid_beginner':
      case 'beginner_with_gaps':
        return 'beginner';
      case 'intermediate_theory_gaps':
      case 'solid_intermediate':
        return 'intermediate';
      default:
        return 'beginner';
    }
  }

  /**
   * Assign a learning journey based on bucket and goal
   */
  private async assignJourney(
    userId: string,
    bucket: SkillBucket,
    goal?: string,
  ): Promise<string | null> {
    this.logger.debug('Assigning journey', { userId, bucket, goal, correlationId: this.correlationId });

    try {
      // Get all active journeys
      const { data: journeys, error: journeysError } = await this.supabaseService
        .getClient()
        .from('learning_journeys')
        .select('*')
        .eq('is_active', true);

      if (journeysError || !journeys || journeys.length === 0) {
        this.logger.warn('No active journeys found', { correlationId: this.correlationId });
        return null;
      }

      // Score each journey
      const skillLevel = this.bucketToSkillLevel(bucket);
      let bestJourney = journeys[0];
      let bestScore = 0;

      for (const journey of journeys) {
        let score = 0;

        // Skill level match (40 points)
        if (journey.target_skill_level === skillLevel) {
          score += 40;
        } else if (
          (journey.target_skill_level === 'beginner' && skillLevel === 'intermediate') ||
          (journey.target_skill_level === 'intermediate' && skillLevel === 'beginner')
        ) {
          score += 20; // Adjacent level
        }

        // Goal match (30 points)
        if (goal && journey.target_goals?.includes(goal)) {
          score += 30;
        }

        if (score > bestScore) {
          bestScore = score;
          bestJourney = journey;
        }
      }

      // Assign journey to user
      const { data: existingJourney } = await this.supabaseService
        .getClient()
        .from('user_journeys')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingJourney) {
        // Update existing
        await this.supabaseService
          .getClient()
          .from('user_journeys')
          .update({
            journey_id: bestJourney.id,
            status: 'active',
            current_milestone_index: 0,
            progress: 0,
            completed_milestones: [],
          })
          .eq('user_id', userId);
      } else {
        // Insert new
        await this.supabaseService
          .getClient()
          .from('user_journeys')
          .insert({
            user_id: userId,
            journey_id: bestJourney.id,
            status: 'active',
            current_milestone_index: 0,
          });
      }

      return bestJourney.id;
    } catch (error) {
      this.logger.error('Failed to assign journey', error instanceof Error ? error : undefined, { userId, correlationId: this.correlationId });
      return null;
    }
  }

  // ==========================================================================
  // Flow Graph Management (Admin)
  // ==========================================================================

  /**
   * Create a flow node (admin)
   */
  async createFlowNode(node: Omit<FlowNode, 'id'>): Promise<FlowNode> {
    this.logger.info('Creating flow node', { nodeId: node.nodeId, correlationId: this.correlationId });
    return this.segmentRepository.createFlowNode(node);
  }

  /**
   * Update a flow node (admin)
   */
  async updateFlowNode(id: string, updates: Partial<FlowNode>): Promise<FlowNode> {
    this.logger.info('Updating flow node', { id, correlationId: this.correlationId });
    return this.segmentRepository.updateFlowNode(id, updates);
  }

  /**
   * Delete a flow node (admin)
   */
  async deleteFlowNode(id: string): Promise<void> {
    this.logger.info('Deleting flow node', { id, correlationId: this.correlationId });
    await this.segmentRepository.deleteFlowNode(id);
  }

  /**
   * Create a flow edge (admin)
   */
  async createFlowEdge(edge: Omit<FlowEdge, 'id'>): Promise<FlowEdge> {
    this.logger.info('Creating flow edge', {
      from: edge.fromNodeId,
      to: edge.toNodeId,
      correlationId: this.correlationId,
    });
    return this.segmentRepository.createFlowEdge(edge);
  }

  /**
   * Delete a flow edge (admin)
   */
  async deleteFlowEdge(id: string): Promise<void> {
    this.logger.info('Deleting flow edge', { id, correlationId: this.correlationId });
    await this.segmentRepository.deleteFlowEdge(id);
  }

  /**
   * Bulk save flow graph (admin) - used by flow editor
   */
  async saveFlowGraph(nodes: FlowNode[], edges: FlowEdge[]): Promise<AssessmentFlowGraph> {
    this.logger.info('Saving flow graph', {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      correlationId: this.correlationId,
    });

    // Validate graph has exactly one entry point
    const entryNodes = nodes.filter((n) => n.isEntryPoint);
    if (entryNodes.length !== 1) {
      throw new BadRequestException('Flow graph must have exactly one entry point');
    }

    // Validate all edge references exist
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const edge of edges) {
      if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
        throw new BadRequestException(`Edge references non-existent node: ${edge.fromNodeId} -> ${edge.toNodeId}`);
      }
    }

    // Get existing nodes from database to find which ones to delete
    const existingGraph = await this.segmentRepository.getFlowGraph();
    const existingNodeIds = new Set(existingGraph.nodes.map((n) => n.id));
    const incomingNodeIds = new Set(nodes.map((n) => n.id));

    // Find nodes to delete (exist in DB but not in incoming list)
    const nodesToDelete = [...existingNodeIds].filter((id) => !incomingNodeIds.has(id));

    // Delete removed nodes (this will cascade delete their edges too)
    for (const nodeId of nodesToDelete) {
      this.logger.info('Deleting removed flow node', { nodeId, correlationId: this.correlationId });
      await this.segmentRepository.deleteFlowNode(nodeId);
    }

    // Update nodes
    await this.segmentRepository.bulkUpdateNodes(nodes);

    // Update edges per node
    const edgesByNode = new Map<string, FlowEdge[]>();
    for (const edge of edges) {
      const existing = edgesByNode.get(edge.fromNodeId) || [];
      existing.push(edge);
      edgesByNode.set(edge.fromNodeId, existing);
    }

    for (const [nodeId, nodeEdges] of edgesByNode) {
      await this.segmentRepository.bulkUpdateEdges(nodeId, nodeEdges);
    }

    // Clear edges for nodes with no outgoing edges
    for (const node of nodes) {
      if (!edgesByNode.has(node.id)) {
        await this.segmentRepository.bulkUpdateEdges(node.id, []);
      }
    }

    return this.getFlowGraph();
  }
}
