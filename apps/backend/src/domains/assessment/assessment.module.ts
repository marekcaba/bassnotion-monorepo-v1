import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AssessmentController } from './assessment.controller.js';
import { AdminAssessmentController } from './admin-assessment.controller.js';
import { AssessmentService } from './assessment.service.js';
import { AssessmentRepository } from './repositories/assessment.repository.js';
import { SegmentAssessmentController } from './segment-assessment.controller.js';
import { AdminSegmentAssessmentController } from './admin-segment-assessment.controller.js';
import { SegmentAssessmentService } from './segment-assessment.service.js';
import { SegmentAssessmentRepository } from './repositories/segment-assessment.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { AuthModule } from '../user/auth/auth.module.js';

@Module({
  imports: [ConfigModule, SupabaseModule, forwardRef(() => AuthModule)],
  controllers: [
    AssessmentController,
    AdminAssessmentController,
    SegmentAssessmentController,
    AdminSegmentAssessmentController,
  ],
  providers: [
    AssessmentService,
    AssessmentRepository,
    SegmentAssessmentService,
    SegmentAssessmentRepository,
  ],
  exports: [
    AssessmentService,
    AssessmentRepository,
    SegmentAssessmentService,
    SegmentAssessmentRepository,
  ],
})
export class AssessmentModule {}
