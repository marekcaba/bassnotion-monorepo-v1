import { Injectable, BadRequestException } from '@nestjs/common';
import {
  updateScaleBlueprintSchema,
  scaleTypeIdSchema,
} from '@bassnotion/contracts';
import type {
  ScaleBlueprintRecord,
  ScaleTypeId,
  UpdateScaleBlueprintInput,
} from '@bassnotion/contracts';
import { ScaleBlueprintsRepository } from './repositories/scale-blueprints.repository.js';

/**
 * AdminScaleBlueprintsService — authoring for the gym Scales tool's box shapes +
 * practice rhythm (`scale_blueprints`). The /admin/scales editor PATCHes a whole
 * scale's shape; validation is via the shared Zod schema. The backend client is
 * service-role — the AdminGuard on the controller is the real boundary.
 *
 * Editing a blueprint is safe anytime: the runtime reads the stored shape live
 * (no frozen snapshot needed — a scale shape isn't an in-flight commitment).
 */
@Injectable()
export class AdminScaleBlueprintsService {
  constructor(private readonly repository: ScaleBlueprintsRepository) {}

  /** All blueprints (the admin editor lists every scale type). */
  list(): Promise<ScaleBlueprintRecord[]> {
    return this.repository.listAll();
  }

  /** Update one scale's positions and/or rhythm. Validates the scale type + body. */
  async update(
    scaleType: string,
    patch: UpdateScaleBlueprintInput,
  ): Promise<ScaleBlueprintRecord> {
    const typeParse = scaleTypeIdSchema.safeParse(scaleType);
    if (!typeParse.success) {
      throw new BadRequestException(`Unknown scale type "${scaleType}"`);
    }
    const bodyParse = updateScaleBlueprintSchema.safeParse(patch);
    if (!bodyParse.success) {
      throw new BadRequestException(
        bodyParse.error.issues.map((i) => i.message).join('; '),
      );
    }
    // Position numbers must be 1-based and contiguous (the box picker assumes it).
    if (bodyParse.data.positions) {
      this.validatePositions(bodyParse.data.positions);
    }
    return this.repository.upsert(typeParse.data as ScaleTypeId, bodyParse.data);
  }

  private validatePositions(
    positions: { positionNumber: number }[],
  ): void {
    const numbers = positions.map((p) => p.positionNumber).sort((a, b) => a - b);
    const contiguous = numbers.every((n, i) => n === i + 1);
    if (!contiguous) {
      throw new BadRequestException(
        'positionNumber must be 1-based and contiguous (1, 2, 3, …)',
      );
    }
  }
}
