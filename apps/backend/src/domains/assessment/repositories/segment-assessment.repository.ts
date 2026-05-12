import { Injectable, Inject } from '@nestjs/common';
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
  EdgeConditionValue,
} from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

/**
 * Repository for segment-based assessment system.
 * Handles all database operations for video segments, flow graph, questions,
 * coach insights, and user sessions.
 */
@Injectable()
export class SegmentAssessmentRepository {
  private readonly staticLogger = createStructuredLogger(
    SegmentAssessmentRepository.name,
  );

  constructor(
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
  // Video Segments
  // ==========================================================================

  /**
   * Get all active video segments
   */
  async getSegments(): Promise<VideoSegment[]> {
    this.logger.debug('Getting all segments', { correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_segments')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error('Failed to get segments', error, { correlationId: this.correlationId });
      throw error;
    }

    return (data || []).map(this.mapSegmentFromDb);
  }

  /**
   * Get a single segment by ID
   */
  async getSegmentById(id: string): Promise<VideoSegment | null> {
    this.logger.debug('Getting segment by ID', { id, correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_segments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('Failed to get segment', error, { id, correlationId: this.correlationId });
      throw error;
    }

    return data ? this.mapSegmentFromDb(data) : null;
  }

  /**
   * Get segments by topic
   */
  async getSegmentsByTopic(topic: string): Promise<VideoSegment[]> {
    this.logger.debug('Getting segments by topic', { topic, correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_segments')
      .select('*')
      .eq('topic', topic)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error('Failed to get segments by topic', error, { topic, correlationId: this.correlationId });
      throw error;
    }

    return (data || []).map(this.mapSegmentFromDb);
  }

  /**
   * Create a new segment
   */
  async createSegment(segment: Omit<VideoSegment, 'id' | 'createdAt' | 'updatedAt'>): Promise<VideoSegment> {
    this.logger.info('Creating segment', { name: segment.name, correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_segments')
      .insert({
        video_library_id: segment.videoLibraryId,
        video_id: segment.videoId,
        name: segment.name,
        slug: segment.slug,
        description: segment.description,
        duration_seconds: segment.durationSeconds,
        topic: segment.topic,
        target_buckets: segment.targetBuckets,
        sort_order: segment.sortOrder,
        is_active: segment.isActive,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create segment', error, { correlationId: this.correlationId });
      throw error;
    }

    return this.mapSegmentFromDb(data);
  }

  /**
   * Update a segment
   */
  async updateSegment(id: string, updates: Partial<VideoSegment>): Promise<VideoSegment> {
    this.logger.info('Updating segment', { id, correlationId: this.correlationId });

    const updateData: Record<string, unknown> = {};
    if (updates.videoLibraryId !== undefined) updateData.video_library_id = updates.videoLibraryId;
    if (updates.videoId !== undefined) updateData.video_id = updates.videoId;
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.slug !== undefined) updateData.slug = updates.slug;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.durationSeconds !== undefined) updateData.duration_seconds = updates.durationSeconds;
    if (updates.topic !== undefined) updateData.topic = updates.topic;
    if (updates.targetBuckets !== undefined) updateData.target_buckets = updates.targetBuckets;
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_segments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update segment', error, { id, correlationId: this.correlationId });
      throw error;
    }

    return this.mapSegmentFromDb(data);
  }

  /**
   * Delete a segment
   */
  async deleteSegment(id: string): Promise<void> {
    this.logger.info('Deleting segment', { id, correlationId: this.correlationId });

    const { error } = await this.supabaseService
      .getClient()
      .from('assessment_segments')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error('Failed to delete segment', error, { id, correlationId: this.correlationId });
      throw error;
    }
  }

  // ==========================================================================
  // Flow Graph
  // ==========================================================================

  /**
   * Get the complete flow graph (nodes + edges)
   */
  async getFlowGraph(): Promise<AssessmentFlowGraph> {
    this.logger.debug('Getting flow graph', { correlationId: this.correlationId });

    // Get all active nodes
    const { data: nodesData, error: nodesError } = await this.supabaseService
      .getClient()
      .from('assessment_flow_nodes')
      .select('*')
      .eq('is_active', true);

    if (nodesError) {
      this.logger.error('Failed to get flow nodes', nodesError, { correlationId: this.correlationId });
      throw nodesError;
    }

    // Get all edges for active nodes
    const nodeIds = (nodesData || []).map((n) => n.id);
    const { data: edgesData, error: edgesError } = await this.supabaseService
      .getClient()
      .from('assessment_flow_edges')
      .select('*')
      .in('from_node_id', nodeIds);

    if (edgesError) {
      this.logger.error('Failed to get flow edges', edgesError, { correlationId: this.correlationId });
      throw edgesError;
    }

    const nodes = (nodesData || []).map(this.mapNodeFromDb);
    const edges = (edgesData || []).map(this.mapEdgeFromDb);

    // Find entry point
    const entryNode = nodes.find((n) => n.isEntryPoint);
    const entryNodeId = entryNode?.id || '';

    return { nodes, edges, entryNodeId };
  }

  /**
   * Get a single flow node by ID
   */
  async getFlowNodeById(id: string): Promise<FlowNode | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_flow_nodes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data ? this.mapNodeFromDb(data) : null;
  }

  /**
   * Get a flow node by node_id (human-readable ID)
   */
  async getFlowNodeByNodeId(nodeId: string): Promise<FlowNode | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_flow_nodes')
      .select('*')
      .eq('node_id', nodeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data ? this.mapNodeFromDb(data) : null;
  }

  /**
   * Get outgoing edges from a node
   */
  async getOutgoingEdges(nodeId: string): Promise<FlowEdge[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_flow_edges')
      .select('*')
      .eq('from_node_id', nodeId)
      .order('priority', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapEdgeFromDb);
  }

  /**
   * Create a flow node
   */
  async createFlowNode(node: Omit<FlowNode, 'id'>): Promise<FlowNode> {
    this.logger.info('Creating flow node', { nodeId: node.nodeId, correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_flow_nodes')
      .insert({
        node_id: node.nodeId,
        node_type: node.nodeType,
        segment_id: node.segmentId,
        question_key: node.questionKey,
        title: node.title,
        description: node.description,
        position_x: node.positionX,
        position_y: node.positionY,
        is_active: node.isActive,
        is_entry_point: node.isEntryPoint,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create flow node', error, { correlationId: this.correlationId });
      throw error;
    }

    return this.mapNodeFromDb(data);
  }

  /**
   * Update a flow node
   */
  async updateFlowNode(id: string, updates: Partial<FlowNode>): Promise<FlowNode> {
    this.logger.info('Updating flow node', { id, correlationId: this.correlationId });

    const updateData: Record<string, unknown> = {};
    if (updates.nodeId !== undefined) updateData.node_id = updates.nodeId;
    if (updates.nodeType !== undefined) updateData.node_type = updates.nodeType;
    if (updates.segmentId !== undefined) updateData.segment_id = updates.segmentId;
    if (updates.questionKey !== undefined) updateData.question_key = updates.questionKey;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.positionX !== undefined) updateData.position_x = updates.positionX;
    if (updates.positionY !== undefined) updateData.position_y = updates.positionY;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.isEntryPoint !== undefined) updateData.is_entry_point = updates.isEntryPoint;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_flow_nodes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update flow node', error, { id, correlationId: this.correlationId });
      throw error;
    }

    return this.mapNodeFromDb(data);
  }

  /**
   * Delete a flow node
   */
  async deleteFlowNode(id: string): Promise<void> {
    this.logger.info('Deleting flow node', { id, correlationId: this.correlationId });

    const { error } = await this.supabaseService
      .getClient()
      .from('assessment_flow_nodes')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error('Failed to delete flow node', error, { id, correlationId: this.correlationId });
      throw error;
    }
  }

  /**
   * Create a flow edge
   */
  async createFlowEdge(edge: Omit<FlowEdge, 'id'>): Promise<FlowEdge> {
    this.logger.info('Creating flow edge', {
      from: edge.fromNodeId,
      to: edge.toNodeId,
      correlationId: this.correlationId
    });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_flow_edges')
      .insert({
        from_node_id: edge.fromNodeId,
        to_node_id: edge.toNodeId,
        condition_type: edge.conditionType,
        condition_value: edge.conditionValue,
        priority: edge.priority,
        label: edge.label,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create flow edge', error, { correlationId: this.correlationId });
      throw error;
    }

    return this.mapEdgeFromDb(data);
  }

  /**
   * Delete a flow edge
   */
  async deleteFlowEdge(id: string): Promise<void> {
    this.logger.info('Deleting flow edge', { id, correlationId: this.correlationId });

    const { error } = await this.supabaseService
      .getClient()
      .from('assessment_flow_edges')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error('Failed to delete flow edge', error, { id, correlationId: this.correlationId });
      throw error;
    }
  }

  /**
   * Bulk update nodes (for flow editor save)
   */
  async bulkUpdateNodes(nodes: FlowNode[]): Promise<void> {
    this.logger.info('Bulk updating flow nodes', { count: nodes.length, correlationId: this.correlationId });

    // Check if any node is being set as entry point
    const newEntryPoint = nodes.find((n) => n.isEntryPoint);

    if (newEntryPoint) {
      // First, clear any existing entry points that are NOT the new entry point
      const { error: clearError } = await this.supabaseService
        .getClient()
        .from('assessment_flow_nodes')
        .update({ is_entry_point: false })
        .eq('is_entry_point', true)
        .neq('id', newEntryPoint.id);

      if (clearError) {
        this.logger.error('Failed to clear existing entry points', clearError, { correlationId: this.correlationId });
        throw clearError;
      }
    }

    // Use upsert for each node
    for (const node of nodes) {
      const { error } = await this.supabaseService
        .getClient()
        .from('assessment_flow_nodes')
        .upsert({
          id: node.id,
          node_id: node.nodeId,
          node_type: node.nodeType,
          segment_id: node.segmentId,
          question_key: node.questionKey,
          title: node.title,
          description: node.description,
          position_x: node.positionX,
          position_y: node.positionY,
          is_active: node.isActive,
          is_entry_point: node.isEntryPoint,
        });

      if (error) {
        this.logger.error('Failed to upsert flow node', error, { nodeId: node.nodeId, correlationId: this.correlationId });
        throw error;
      }
    }
  }

  /**
   * Bulk update edges (for flow editor save)
   */
  async bulkUpdateEdges(nodeId: string, edges: FlowEdge[]): Promise<void> {
    this.logger.info('Bulk updating flow edges', { nodeId, count: edges.length, correlationId: this.correlationId });

    // Delete existing edges from this node
    const { error: deleteError } = await this.supabaseService
      .getClient()
      .from('assessment_flow_edges')
      .delete()
      .eq('from_node_id', nodeId);

    if (deleteError) {
      this.logger.error('Failed to delete existing edges', deleteError, { nodeId, correlationId: this.correlationId });
      throw deleteError;
    }

    // Insert new edges
    if (edges.length > 0) {
      const edgesToInsert = edges.map((e) => ({
        from_node_id: e.fromNodeId,
        to_node_id: e.toNodeId,
        condition_type: e.conditionType,
        condition_value: e.conditionValue,
        priority: e.priority,
        label: e.label,
      }));

      const { error: insertError } = await this.supabaseService
        .getClient()
        .from('assessment_flow_edges')
        .insert(edgesToInsert);

      if (insertError) {
        this.logger.error('Failed to insert edges', insertError, { nodeId, correlationId: this.correlationId });
        throw insertError;
      }
    }
  }

  // ==========================================================================
  // Questions
  // ==========================================================================

  /**
   * Get all active questions
   */
  async getQuestions(): Promise<SegmentQuestion[]> {
    this.logger.debug('Getting all questions', { correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_questions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      this.logger.error('Failed to get questions', error, { correlationId: this.correlationId });
      throw error;
    }

    return (data || []).map(this.mapQuestionFromDb);
  }

  /**
   * Get a question by key
   */
  async getQuestionByKey(questionKey: string): Promise<SegmentQuestion | null> {
    this.logger.debug('Getting question by key', { questionKey, correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_questions')
      .select('*')
      .eq('question_key', questionKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('Failed to get question', error, { questionKey, correlationId: this.correlationId });
      throw error;
    }

    return data ? this.mapQuestionFromDb(data) : null;
  }

  /**
   * Create a question
   */
  async createQuestion(question: Omit<SegmentQuestion, 'id'>): Promise<SegmentQuestion> {
    this.logger.info('Creating question', { questionKey: question.questionKey, correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_questions')
      .insert({
        question_key: question.questionKey,
        question_text: question.questionText,
        description: question.description,
        question_type: question.questionType,
        options: question.options,
        verification_config: question.verificationConfig,
        audio_config: question.audioConfig,
        category: question.category,
        points: question.points,
        sort_order: question.sortOrder,
        is_active: question.isActive,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create question', error, { correlationId: this.correlationId });
      throw error;
    }

    return this.mapQuestionFromDb(data);
  }

  /**
   * Update a question
   */
  async updateQuestion(id: string, updates: Partial<SegmentQuestion>): Promise<SegmentQuestion> {
    this.logger.info('Updating question', { id, correlationId: this.correlationId });

    const updateData: Record<string, unknown> = {};
    if (updates.questionKey !== undefined) updateData.question_key = updates.questionKey;
    if (updates.questionText !== undefined) updateData.question_text = updates.questionText;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.questionType !== undefined) updateData.question_type = updates.questionType;
    if (updates.options !== undefined) updateData.options = updates.options;
    if (updates.verificationConfig !== undefined) updateData.verification_config = updates.verificationConfig;
    if (updates.audioConfig !== undefined) updateData.audio_config = updates.audioConfig;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.points !== undefined) updateData.points = updates.points;
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_questions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update question', error, { id, correlationId: this.correlationId });
      throw error;
    }

    return this.mapQuestionFromDb(data);
  }

  /**
   * Delete a question
   */
  async deleteQuestion(id: string): Promise<void> {
    this.logger.info('Deleting question', { id, correlationId: this.correlationId });

    const { error } = await this.supabaseService
      .getClient()
      .from('assessment_questions')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error('Failed to delete question', error, { id, correlationId: this.correlationId });
      throw error;
    }
  }

  // ==========================================================================
  // Coach Insight Templates
  // ==========================================================================

  /**
   * Get all active coach insight templates
   */
  async getInsightTemplates(): Promise<CoachInsightTemplate[]> {
    this.logger.debug('Getting all insight templates', { correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('coach_insight_templates')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      this.logger.error('Failed to get insight templates', error, { correlationId: this.correlationId });
      throw error;
    }

    return (data || []).map(this.mapInsightFromDb);
  }

  /**
   * Find best matching coach insight template
   */
  async findMatchingInsight(
    bucket: SkillBucket,
    goal?: string,
    struggle?: string,
    practiceTime?: string,
  ): Promise<CoachInsightTemplate | null> {
    this.logger.debug('Finding matching insight', { bucket, goal, struggle, practiceTime, correlationId: this.correlationId });

    // Get all templates for this bucket, ordered by priority
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coach_insight_templates')
      .select('*')
      .eq('target_bucket', bucket)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      this.logger.error('Failed to find matching insight', error, { correlationId: this.correlationId });
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Score each template based on matching criteria
    let bestMatch = data[0];
    let bestScore = 0;

    for (const template of data) {
      let score = template.priority || 0;

      // Exact goal match
      if (goal && template.target_goal === goal) {
        score += 100;
      } else if (template.target_goal && template.target_goal !== goal) {
        score -= 50; // Penalty for mismatched goal requirement
      }

      // Exact struggle match
      if (struggle && template.target_struggle === struggle) {
        score += 100;
      } else if (template.target_struggle && template.target_struggle !== struggle) {
        score -= 50;
      }

      // Exact practice time match
      if (practiceTime && template.target_practice_time === practiceTime) {
        score += 50;
      } else if (template.target_practice_time && template.target_practice_time !== practiceTime) {
        score -= 25;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = template;
      }
    }

    return this.mapInsightFromDb(bestMatch);
  }

  /**
   * Create an insight template
   */
  async createInsightTemplate(template: Omit<CoachInsightTemplate, 'id'>): Promise<CoachInsightTemplate> {
    this.logger.info('Creating insight template', { bucket: template.targetBucket, correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('coach_insight_templates')
      .insert({
        target_bucket: template.targetBucket,
        target_goal: template.targetGoal,
        target_struggle: template.targetStruggle,
        target_practice_time: template.targetPracticeTime,
        insight_title: template.insightTitle,
        insight_body: template.insightBody,
        coach_name: template.coachName,
        coach_avatar_url: template.coachAvatarUrl,
        skill_check_acknowledgment: template.skillCheckAcknowledgment,
        day1_title: template.day1Title,
        day1_description: template.day1Description,
        day2_title: template.day2Title,
        day2_description: template.day2Description,
        day3_title: template.day3Title,
        day3_description: template.day3Description,
        cta_text: template.ctaText,
        cta_link: template.ctaLink,
        priority: template.priority,
        is_active: template.isActive,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create insight template', error, { correlationId: this.correlationId });
      throw error;
    }

    return this.mapInsightFromDb(data);
  }

  /**
   * Update an insight template
   */
  async updateInsightTemplate(id: string, updates: Partial<CoachInsightTemplate>): Promise<CoachInsightTemplate> {
    this.logger.info('Updating insight template', { id, correlationId: this.correlationId });

    const updateData: Record<string, unknown> = {};
    if (updates.targetBucket !== undefined) updateData.target_bucket = updates.targetBucket;
    if (updates.targetGoal !== undefined) updateData.target_goal = updates.targetGoal;
    if (updates.targetStruggle !== undefined) updateData.target_struggle = updates.targetStruggle;
    if (updates.targetPracticeTime !== undefined) updateData.target_practice_time = updates.targetPracticeTime;
    if (updates.insightTitle !== undefined) updateData.insight_title = updates.insightTitle;
    if (updates.insightBody !== undefined) updateData.insight_body = updates.insightBody;
    if (updates.coachName !== undefined) updateData.coach_name = updates.coachName;
    if (updates.coachAvatarUrl !== undefined) updateData.coach_avatar_url = updates.coachAvatarUrl;
    if (updates.skillCheckAcknowledgment !== undefined) updateData.skill_check_acknowledgment = updates.skillCheckAcknowledgment;
    if (updates.day1Title !== undefined) updateData.day1_title = updates.day1Title;
    if (updates.day1Description !== undefined) updateData.day1_description = updates.day1Description;
    if (updates.day2Title !== undefined) updateData.day2_title = updates.day2Title;
    if (updates.day2Description !== undefined) updateData.day2_description = updates.day2Description;
    if (updates.day3Title !== undefined) updateData.day3_title = updates.day3Title;
    if (updates.day3Description !== undefined) updateData.day3_description = updates.day3Description;
    if (updates.ctaText !== undefined) updateData.cta_text = updates.ctaText;
    if (updates.ctaLink !== undefined) updateData.cta_link = updates.ctaLink;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('coach_insight_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update insight template', error, { id, correlationId: this.correlationId });
      throw error;
    }

    return this.mapInsightFromDb(data);
  }

  /**
   * Delete an insight template
   */
  async deleteInsightTemplate(id: string): Promise<void> {
    this.logger.info('Deleting insight template', { id, correlationId: this.correlationId });

    const { error } = await this.supabaseService
      .getClient()
      .from('coach_insight_templates')
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error('Failed to delete insight template', error, { id, correlationId: this.correlationId });
      throw error;
    }
  }

  // ==========================================================================
  // User Sessions
  // ==========================================================================

  /**
   * Create a new assessment session
   */
  async createSession(userId?: string): Promise<AssessmentSession> {
    this.logger.info('Creating assessment session', { userId, correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_assessment_sessions')
      .insert({
        user_id: userId,
        answers: {},
        visited_node_ids: [],
        status: 'in_progress',
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create session', error, { correlationId: this.correlationId });
      throw error;
    }

    return this.mapSessionFromDb(data);
  }

  /**
   * Get user's current (in-progress) session
   */
  async getCurrentSession(userId: string): Promise<AssessmentSession | null> {
    this.logger.debug('Getting current session', { userId, correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_assessment_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('Failed to get current session', error, { userId, correlationId: this.correlationId });
      throw error;
    }

    return data ? this.mapSessionFromDb(data) : null;
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<AssessmentSession | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_assessment_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data ? this.mapSessionFromDb(data) : null;
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

    const updateData: Record<string, unknown> = {
      last_activity_at: new Date().toISOString(),
    };

    if (updates.currentNodeId !== undefined) updateData.current_node_id = updates.currentNodeId;
    if (updates.answers !== undefined) updateData.answers = updates.answers;
    if (updates.visitedNodeIds !== undefined) updateData.visited_node_ids = updates.visitedNodeIds;
    if (updates.selfReportedLevel !== undefined) updateData.self_reported_level = updates.selfReportedLevel;
    if (updates.determinedBucket !== undefined) updateData.determined_bucket = updates.determinedBucket;
    if (updates.skillCheckPassed !== undefined) updateData.skill_check_passed = updates.skillCheckPassed;
    if (updates.skillCheckScore !== undefined) updateData.skill_check_score = updates.skillCheckScore;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_assessment_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update session', error, { sessionId, correlationId: this.correlationId });
      throw error;
    }

    return this.mapSessionFromDb(data);
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string): Promise<AssessmentSession> {
    this.logger.info('Completing session', { sessionId, correlationId: this.correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_assessment_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to complete session', error, { sessionId, correlationId: this.correlationId });
      throw error;
    }

    return this.mapSessionFromDb(data);
  }

  /**
   * Update user's profile with assessment bucket
   */
  async updateUserBucket(userId: string, bucket: SkillBucket): Promise<void> {
    this.logger.info('Updating user bucket', { userId, bucket, correlationId: this.correlationId });

    const { error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .update({
        level_bucket: bucket,
      })
      .eq('id', userId);

    if (error) {
      this.logger.error('Failed to update user bucket', error, { userId, correlationId: this.correlationId });
      throw error;
    }
  }

  // ==========================================================================
  // Mappers
  // ==========================================================================

  private mapSegmentFromDb(data: Record<string, unknown>): VideoSegment {
    return {
      id: data.id as string,
      videoLibraryId: data.video_library_id as string,
      videoId: data.video_id as string,
      name: data.name as string,
      slug: data.slug as string,
      description: data.description as string | undefined,
      durationSeconds: data.duration_seconds as number | undefined,
      topic: data.topic as VideoSegment['topic'],
      targetBuckets: (data.target_buckets || []) as SkillBucket[],
      sortOrder: data.sort_order as number,
      isActive: data.is_active as boolean,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private mapNodeFromDb(data: Record<string, unknown>): FlowNode {
    return {
      id: data.id as string,
      nodeId: data.node_id as string,
      nodeType: data.node_type as FlowNode['nodeType'],
      segmentId: data.segment_id as string | undefined,
      questionKey: data.question_key as string | undefined,
      title: data.title as string | undefined,
      description: data.description as string | undefined,
      positionX: data.position_x as number,
      positionY: data.position_y as number,
      isActive: data.is_active as boolean,
      isEntryPoint: data.is_entry_point as boolean,
    };
  }

  private mapEdgeFromDb(data: Record<string, unknown>): FlowEdge {
    return {
      id: data.id as string,
      fromNodeId: data.from_node_id as string,
      toNodeId: data.to_node_id as string,
      conditionType: data.condition_type as FlowEdge['conditionType'],
      conditionValue: data.condition_value as EdgeConditionValue | undefined,
      priority: data.priority as number,
      label: data.label as string | undefined,
    };
  }

  private mapQuestionFromDb(data: Record<string, unknown>): SegmentQuestion {
    return {
      id: data.id as string,
      questionKey: data.question_key as string,
      questionText: data.question_text as string,
      description: data.description as string | undefined,
      questionType: data.question_type as SegmentQuestion['questionType'],
      options: data.options as SegmentQuestion['options'],
      verificationConfig: data.verification_config as SegmentQuestion['verificationConfig'],
      audioConfig: data.audio_config as SegmentQuestion['audioConfig'],
      category: data.category as SegmentQuestion['category'],
      points: data.points as number | undefined,
      sortOrder: data.sort_order as number,
      isActive: data.is_active as boolean,
    };
  }

  private mapInsightFromDb(data: Record<string, unknown>): CoachInsightTemplate {
    return {
      id: data.id as string,
      targetBucket: data.target_bucket as SkillBucket,
      targetGoal: data.target_goal as string | undefined,
      targetStruggle: data.target_struggle as string | undefined,
      targetPracticeTime: data.target_practice_time as string | undefined,
      insightTitle: data.insight_title as string,
      insightBody: data.insight_body as string,
      coachName: data.coach_name as string,
      coachAvatarUrl: data.coach_avatar_url as string | undefined,
      skillCheckAcknowledgment: data.skill_check_acknowledgment as string | undefined,
      day1Title: data.day1_title as string | undefined,
      day1Description: data.day1_description as string | undefined,
      day2Title: data.day2_title as string | undefined,
      day2Description: data.day2_description as string | undefined,
      day3Title: data.day3_title as string | undefined,
      day3Description: data.day3_description as string | undefined,
      ctaText: data.cta_text as string,
      ctaLink: data.cta_link as string | undefined,
      priority: data.priority as number,
      isActive: data.is_active as boolean,
    };
  }

  private mapSessionFromDb(data: Record<string, unknown>): AssessmentSession {
    return {
      id: data.id as string,
      userId: data.user_id as string | undefined,
      currentNodeId: data.current_node_id as string | undefined,
      answers: (data.answers || {}) as Record<string, unknown>,
      visitedNodeIds: (data.visited_node_ids || []) as string[],
      selfReportedLevel: data.self_reported_level as string | undefined,
      determinedBucket: data.determined_bucket as SkillBucket | undefined,
      skillCheckPassed: data.skill_check_passed as boolean | undefined,
      skillCheckScore: data.skill_check_score as number | undefined,
      startedAt: data.started_at as string,
      lastActivityAt: data.last_activity_at as string,
      completedAt: data.completed_at as string | undefined,
      status: data.status as AssessmentSession['status'],
    };
  }
}
