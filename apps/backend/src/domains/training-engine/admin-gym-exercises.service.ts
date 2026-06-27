import { Injectable, BadRequestException } from '@nestjs/common';
import {
  createGymExerciseSchema,
  updateGymExerciseSchema,
} from '@bassnotion/contracts';
import type {
  GymExercise,
  CreateGymExerciseInput,
  UpdateGymExerciseInput,
} from '@bassnotion/contracts';
import { GymExercisesRepository } from './repositories/gym-exercises.repository.js';

/**
 * AdminGymExercisesService — authoring CRUD for gym equipment exercises. Generic over
 * equipment (scale paths today, grooves later). DRAFT-FRIENDLY: create/update validate
 * only the envelope (kind/name/equipment), never the payload content — a half-authored
 * exercise saves fine. The AdminGuard on the controller is the real write boundary.
 */
@Injectable()
export class AdminGymExercisesService {
  constructor(private readonly repository: GymExercisesRepository) {}

  list(filters?: { equipment?: string; kind?: string }): Promise<GymExercise[]> {
    return this.repository.list(filters);
  }

  get(id: string): Promise<GymExercise | null> {
    return this.repository.findById(id);
  }

  async create(
    input: CreateGymExerciseInput,
    userId?: string,
  ): Promise<GymExercise> {
    const parsed = createGymExerciseSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    }
    const d = parsed.data;
    return this.repository.insert({
      kind: d.kind,
      name: d.name,
      description: d.description,
      equipment: d.equipment,
      scale_type: d.scaleType ?? null,
      payload: d.payload ?? {},
      created_by: userId ?? null,
    });
  }

  async update(
    id: string,
    patch: UpdateGymExerciseInput,
  ): Promise<GymExercise> {
    const parsed = updateGymExerciseSchema.safeParse(patch);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    }
    const p = parsed.data;
    const row: Record<string, unknown> = {};
    if (p.name !== undefined) row.name = p.name;
    if (p.description !== undefined) row.description = p.description;
    if (p.scaleType !== undefined) row.scale_type = p.scaleType;
    if (p.payload !== undefined) row.payload = p.payload;

    const updated = await this.repository.update(id, row);
    if (!updated) throw new BadRequestException('Gym exercise not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
