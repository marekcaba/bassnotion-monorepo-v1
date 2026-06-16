import {
  recordRepResultSchema,
  type RecordRepResultData,
} from '@bassnotion/contracts';

/**
 * DTO for POST /api/v1/training-engine/rep-results.
 *
 * Validated by the global ZodValidationPipe, which reads the static
 * `getSchema()` off this class's metatype (the repo's DTO convention).
 */
export class RecordRepResultDto implements RecordRepResultData {
  goalEnrollmentId!: RecordRepResultData['goalEnrollmentId'];
  drillSessionId?: RecordRepResultData['drillSessionId'];
  blockId!: RecordRepResultData['blockId'];
  ladderLevel!: RecordRepResultData['ladderLevel'];
  tempoBpm?: RecordRepResultData['tempoBpm'];
  topicId?: RecordRepResultData['topicId'];
  signal!: RecordRepResultData['signal'];
  result!: RecordRepResultData['result'];
  achievedTier?: RecordRepResultData['achievedTier'];

  static getSchema() {
    return recordRepResultSchema;
  }
}
