import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import type {
  AssessmentFlowGraph,
  VideoSegment,
  FlowNode,
  FlowEdge,
  SegmentQuestion,
  CoachInsightTemplate,
  SkillBucket,
  SegmentTopic,
  FlowNodeType,
  EdgeConditionType,
  SegmentQuestionType,
  SegmentQuestionCategory,
  SegmentQuestionOption,
  SkillVerificationConfig,
  AudioConfig,
  EdgeConditionValue,
} from '@bassnotion/contracts';
import { SegmentAssessmentService } from './segment-assessment.service.js';
import { AdminGuard } from '../user/auth/guards/admin.guard.js';

// =============================================================================
// DTOs
// =============================================================================

interface CreateSegmentDto {
  videoLibraryId: string;
  videoId: string;
  name: string;
  slug: string;
  description?: string;
  durationSeconds?: number;
  topic: SegmentTopic;
  targetBuckets?: SkillBucket[];
  sortOrder?: number;
  isActive?: boolean;
}

interface UpdateSegmentDto {
  videoLibraryId?: string;
  videoId?: string;
  name?: string;
  slug?: string;
  description?: string;
  durationSeconds?: number;
  topic?: SegmentTopic;
  targetBuckets?: SkillBucket[];
  sortOrder?: number;
  isActive?: boolean;
}

interface CreateNodeDto {
  nodeId: string;
  nodeType: FlowNodeType;
  segmentId?: string;
  questionKey?: string;
  title?: string;
  description?: string;
  positionX?: number;
  positionY?: number;
  isActive?: boolean;
  isEntryPoint?: boolean;
}

interface UpdateNodeDto {
  nodeId?: string;
  nodeType?: FlowNodeType;
  segmentId?: string;
  questionKey?: string;
  title?: string;
  description?: string;
  positionX?: number;
  positionY?: number;
  isActive?: boolean;
  isEntryPoint?: boolean;
}

interface CreateEdgeDto {
  fromNodeId: string;
  toNodeId: string;
  conditionType: EdgeConditionType;
  conditionValue?: EdgeConditionValue;
  priority?: number;
  label?: string;
}

interface SaveFlowGraphDto {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface CreateQuestionDto {
  questionKey: string;
  questionText: string;
  description?: string;
  questionType: SegmentQuestionType;
  options?: SegmentQuestionOption[];
  verificationConfig?: SkillVerificationConfig;
  audioConfig?: AudioConfig;
  category: SegmentQuestionCategory;
  points?: number;
  sortOrder?: number;
  isActive?: boolean;
}

interface UpdateQuestionDto {
  questionKey?: string;
  questionText?: string;
  description?: string;
  questionType?: SegmentQuestionType;
  options?: SegmentQuestionOption[];
  verificationConfig?: SkillVerificationConfig;
  audioConfig?: AudioConfig;
  category?: SegmentQuestionCategory;
  points?: number;
  sortOrder?: number;
  isActive?: boolean;
}

interface CreateInsightDto {
  targetBucket: SkillBucket;
  targetGoal?: string;
  targetStruggle?: string;
  targetPracticeTime?: string;
  insightTitle: string;
  insightBody: string;
  coachName?: string;
  coachAvatarUrl?: string;
  skillCheckAcknowledgment?: string;
  day1Title?: string;
  day1Description?: string;
  day2Title?: string;
  day2Description?: string;
  day3Title?: string;
  day3Description?: string;
  ctaText?: string;
  ctaLink?: string;
  priority?: number;
  isActive?: boolean;
}

interface UpdateInsightDto {
  targetBucket?: SkillBucket;
  targetGoal?: string;
  targetStruggle?: string;
  targetPracticeTime?: string;
  insightTitle?: string;
  insightBody?: string;
  coachName?: string;
  coachAvatarUrl?: string;
  skillCheckAcknowledgment?: string;
  day1Title?: string;
  day1Description?: string;
  day2Title?: string;
  day2Description?: string;
  day3Title?: string;
  day3Description?: string;
  ctaText?: string;
  ctaLink?: string;
  priority?: number;
  isActive?: boolean;
}

// =============================================================================
// Admin Controller
// =============================================================================

/**
 * Admin endpoints for managing the segment-based assessment.
 * All endpoints require admin authentication.
 */
@Controller('api/v1/admin/assessment/v2')
@UseGuards(AdminGuard)
export class AdminSegmentAssessmentController {
  constructor(private readonly service: SegmentAssessmentService) {}

  // --------------------------------------------------------------------------
  // Segments
  // --------------------------------------------------------------------------

  /**
   * Get all video segments.
   */
  @Get('segments')
  async getSegments(): Promise<{ segments: VideoSegment[] }> {
    const segments = await this.service.getSegments();
    return { segments };
  }

  /**
   * Get a segment by ID.
   */
  @Get('segments/:id')
  async getSegment(
    @Param('id') id: string,
  ): Promise<{ segment: VideoSegment }> {
    const segment = await this.service.getSegmentById(id);
    return { segment };
  }

  /**
   * Create a new segment.
   */
  @Post('segments')
  async createSegment(
    @Body() body: CreateSegmentDto,
  ): Promise<{ segment: VideoSegment }> {
    const segment = await this.service.createSegment({
      videoLibraryId: body.videoLibraryId,
      videoId: body.videoId,
      name: body.name,
      slug: body.slug,
      description: body.description,
      durationSeconds: body.durationSeconds,
      topic: body.topic,
      targetBuckets: body.targetBuckets || [],
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true,
    });
    return { segment };
  }

  /**
   * Update a segment.
   */
  @Put('segments/:id')
  async updateSegment(
    @Param('id') id: string,
    @Body() body: UpdateSegmentDto,
  ): Promise<{ segment: VideoSegment }> {
    const segment = await this.service.updateSegment(id, body);
    return { segment };
  }

  /**
   * Delete a segment.
   */
  @Delete('segments/:id')
  async deleteSegment(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.deleteSegment(id);
    return { success: true };
  }

  // --------------------------------------------------------------------------
  // Flow Graph
  // --------------------------------------------------------------------------

  /**
   * Get the complete flow graph.
   */
  @Get('flow')
  async getFlowGraph(): Promise<{ flow: AssessmentFlowGraph }> {
    const flow = await this.service.getFlowGraph();
    return { flow };
  }

  /**
   * Save the complete flow graph (bulk update).
   */
  @Put('flow')
  async saveFlowGraph(
    @Body() body: SaveFlowGraphDto,
  ): Promise<{ flow: AssessmentFlowGraph }> {
    const flow = await this.service.saveFlowGraph(body.nodes, body.edges);
    return { flow };
  }

  /**
   * Create a flow node.
   */
  @Post('flow/nodes')
  async createNode(@Body() body: CreateNodeDto): Promise<{ node: FlowNode }> {
    const node = await this.service.createFlowNode({
      nodeId: body.nodeId,
      nodeType: body.nodeType,
      segmentId: body.segmentId,
      questionKey: body.questionKey,
      title: body.title,
      description: body.description,
      positionX: body.positionX ?? 0,
      positionY: body.positionY ?? 0,
      isActive: body.isActive ?? true,
      isEntryPoint: body.isEntryPoint ?? false,
    });
    return { node };
  }

  /**
   * Update a flow node.
   */
  @Put('flow/nodes/:id')
  async updateNode(
    @Param('id') id: string,
    @Body() body: UpdateNodeDto,
  ): Promise<{ node: FlowNode }> {
    const node = await this.service.updateFlowNode(id, body);
    return { node };
  }

  /**
   * Delete a flow node.
   */
  @Delete('flow/nodes/:id')
  async deleteNode(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.deleteFlowNode(id);
    return { success: true };
  }

  /**
   * Create a flow edge.
   */
  @Post('flow/edges')
  async createEdge(@Body() body: CreateEdgeDto): Promise<{ edge: FlowEdge }> {
    const edge = await this.service.createFlowEdge({
      fromNodeId: body.fromNodeId,
      toNodeId: body.toNodeId,
      conditionType: body.conditionType,
      conditionValue: body.conditionValue,
      priority: body.priority ?? 0,
      label: body.label,
    });
    return { edge };
  }

  /**
   * Delete a flow edge.
   */
  @Delete('flow/edges/:id')
  async deleteEdge(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.deleteFlowEdge(id);
    return { success: true };
  }

  // --------------------------------------------------------------------------
  // Questions
  // --------------------------------------------------------------------------

  /**
   * Get all questions.
   */
  @Get('questions')
  async getQuestions(): Promise<{ questions: SegmentQuestion[] }> {
    const questions = await this.service.getQuestions();
    return { questions };
  }

  /**
   * Get a question by key.
   */
  @Get('questions/:key')
  async getQuestion(
    @Param('key') key: string,
  ): Promise<{ question: SegmentQuestion }> {
    const question = await this.service.getQuestionByKey(key);
    return { question };
  }

  /**
   * Create a question.
   */
  @Post('questions')
  async createQuestion(
    @Body() body: CreateQuestionDto,
  ): Promise<{ question: SegmentQuestion }> {
    const question = await this.service.createQuestion({
      questionKey: body.questionKey,
      questionText: body.questionText,
      description: body.description,
      questionType: body.questionType,
      options: body.options,
      verificationConfig: body.verificationConfig,
      audioConfig: body.audioConfig,
      category: body.category,
      points: body.points,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true,
    });
    return { question };
  }

  /**
   * Update a question.
   */
  @Put('questions/:id')
  async updateQuestion(
    @Param('id') id: string,
    @Body() body: UpdateQuestionDto,
  ): Promise<{ question: SegmentQuestion }> {
    const question = await this.service.updateQuestion(id, body);
    return { question };
  }

  /**
   * Delete a question.
   */
  @Delete('questions/:id')
  async deleteQuestion(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.deleteQuestion(id);
    return { success: true };
  }

  // --------------------------------------------------------------------------
  // Coach Insights
  // --------------------------------------------------------------------------

  /**
   * Get all insight templates.
   */
  @Get('insights')
  async getInsights(): Promise<{ insights: CoachInsightTemplate[] }> {
    const insights = await this.service.getInsightTemplates();
    return { insights };
  }

  /**
   * Create an insight template.
   */
  @Post('insights')
  async createInsight(
    @Body() body: CreateInsightDto,
  ): Promise<{ insight: CoachInsightTemplate }> {
    const insight = await this.service.createInsightTemplate({
      targetBucket: body.targetBucket,
      targetGoal: body.targetGoal,
      targetStruggle: body.targetStruggle,
      targetPracticeTime: body.targetPracticeTime,
      insightTitle: body.insightTitle,
      insightBody: body.insightBody,
      coachName: body.coachName ?? 'Coach',
      coachAvatarUrl: body.coachAvatarUrl,
      skillCheckAcknowledgment: body.skillCheckAcknowledgment,
      day1Title: body.day1Title,
      day1Description: body.day1Description,
      day2Title: body.day2Title,
      day2Description: body.day2Description,
      day3Title: body.day3Title,
      day3Description: body.day3Description,
      ctaText: body.ctaText ?? 'Save Your Plan',
      ctaLink: body.ctaLink,
      priority: body.priority ?? 0,
      isActive: body.isActive ?? true,
    });
    return { insight };
  }

  /**
   * Update an insight template.
   */
  @Put('insights/:id')
  async updateInsight(
    @Param('id') id: string,
    @Body() body: UpdateInsightDto,
  ): Promise<{ insight: CoachInsightTemplate }> {
    const insight = await this.service.updateInsightTemplate(id, body);
    return { insight };
  }

  /**
   * Delete an insight template.
   */
  @Delete('insights/:id')
  async deleteInsight(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.deleteInsightTemplate(id);
    return { success: true };
  }
}
