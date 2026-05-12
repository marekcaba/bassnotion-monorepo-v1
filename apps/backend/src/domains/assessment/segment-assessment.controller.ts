import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import type {
  AssessmentFlowGraph,
  VideoSegment,
  SegmentQuestion,
  CoachInsightTemplate,
  AssessmentSession,
  SegmentAssessmentResult,
  SkillBucket,
} from '@bassnotion/contracts';
import { SegmentAssessmentService } from './segment-assessment.service.js';
import { AuthGuard } from '../user/auth/guards/auth.guard.js';

// =============================================================================
// DTOs
// =============================================================================

interface UpdateSessionDto {
  currentNodeId: string;
  answers: Record<string, unknown>;
  visitedNodeIds?: string[];
  determinedBucket?: SkillBucket;
  skillCheckPassed?: boolean;
}

interface MatchInsightDto {
  bucket: SkillBucket;
  goal?: string;
  struggle?: string;
  practiceTime?: string;
}

interface CompleteAssessmentDto {
  sessionId: string;
  bucket: SkillBucket;
  answers: Record<string, unknown>;
  skillCheckScore?: number;
}

interface VerifySkillCheckDto {
  questionKey: string;
  answer: string;
}

// =============================================================================
// Public Controller
// =============================================================================

/**
 * Public endpoints for the segment-based assessment.
 * Most endpoints require authentication.
 */
@Controller('api/v1/assessment/v2')
export class SegmentAssessmentController {
  constructor(private readonly service: SegmentAssessmentService) {}

  // --------------------------------------------------------------------------
  // Flow Graph
  // --------------------------------------------------------------------------

  /**
   * Get the complete assessment flow graph.
   * Public - needed to navigate the assessment.
   */
  @Get('flow')
  async getFlowGraph(): Promise<{ flow: AssessmentFlowGraph }> {
    const flow = await this.service.getFlowGraph();
    return { flow };
  }

  /**
   * Get the entry node for the assessment.
   */
  @Get('flow/entry')
  async getEntryNode(): Promise<{ node: import('@bassnotion/contracts').FlowNode }> {
    const node = await this.service.getEntryNode();
    return { node };
  }

  // --------------------------------------------------------------------------
  // Segments
  // --------------------------------------------------------------------------

  /**
   * Get a video segment by ID.
   */
  @Get('segments/:id')
  async getSegment(@Param('id') id: string): Promise<{ segment: VideoSegment }> {
    const segment = await this.service.getSegmentById(id);
    return { segment };
  }

  // --------------------------------------------------------------------------
  // Questions
  // --------------------------------------------------------------------------

  /**
   * Get a question by key.
   */
  @Get('questions/:key')
  async getQuestion(@Param('key') key: string): Promise<{ question: SegmentQuestion }> {
    const question = await this.service.getQuestionByKey(key);
    return { question };
  }

  /**
   * Verify a skill check answer.
   */
  @Post('questions/verify')
  async verifySkillCheck(
    @Body() body: VerifySkillCheckDto,
  ): Promise<{ isCorrect: boolean; feedback?: string }> {
    return this.service.verifySkillCheckAnswer(body.questionKey, body.answer);
  }

  // --------------------------------------------------------------------------
  // Sessions
  // --------------------------------------------------------------------------

  /**
   * Create a new assessment session.
   * Works for both authenticated and anonymous users.
   */
  @Post('sessions')
  async createSession(
    @Request() req: any,
  ): Promise<{ session: AssessmentSession }> {
    // Try to get user ID from request if authenticated
    const userId = req.user?.sub || req.user?.id;
    const session = await this.service.createSession(userId);
    return { session };
  }

  /**
   * Get the current user's in-progress session.
   */
  @Get('sessions/current')
  @UseGuards(AuthGuard)
  async getCurrentSession(
    @Request() req: any,
  ): Promise<{ session: AssessmentSession | null }> {
    const userId = req.user.sub || req.user.id;
    const session = await this.service.getCurrentSession(userId);
    return { session };
  }

  /**
   * Get a session by ID.
   */
  @Get('sessions/:id')
  async getSessionById(
    @Param('id') id: string,
  ): Promise<{ session: AssessmentSession }> {
    const session = await this.service.getSessionById(id);
    return { session };
  }

  /**
   * Update session progress.
   */
  @Patch('sessions/:id')
  async updateSession(
    @Param('id') id: string,
    @Body() body: UpdateSessionDto,
  ): Promise<{ session: AssessmentSession }> {
    const session = await this.service.updateSession(id, {
      currentNodeId: body.currentNodeId,
      answers: body.answers,
      visitedNodeIds: body.visitedNodeIds,
      determinedBucket: body.determinedBucket,
      skillCheckPassed: body.skillCheckPassed,
    });
    return { session };
  }

  // --------------------------------------------------------------------------
  // Coach Insights
  // --------------------------------------------------------------------------

  /**
   * Find matching coach insight template.
   */
  @Post('insights/match')
  async matchInsight(
    @Body() body: MatchInsightDto,
  ): Promise<{ insight: CoachInsightTemplate }> {
    const insight = await this.service.findMatchingInsight(
      body.bucket,
      body.goal,
      body.struggle,
      body.practiceTime,
    );
    return { insight };
  }

  // --------------------------------------------------------------------------
  // Completion
  // --------------------------------------------------------------------------

  /**
   * Complete the assessment.
   * Requires authentication to save results.
   */
  @Post('complete')
  @UseGuards(AuthGuard)
  async completeAssessment(
    @Request() req: any,
    @Body() body: CompleteAssessmentDto,
  ): Promise<{ success: boolean; result: SegmentAssessmentResult }> {
    const userId = req.user.sub || req.user.id;
    const result = await this.service.completeAssessment(
      userId,
      body.sessionId,
      body.bucket,
      body.answers,
      body.skillCheckScore,
    );
    return { success: true, result };
  }
}
