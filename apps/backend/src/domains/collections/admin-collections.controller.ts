import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { CollectionsRepository } from './repositories/collections.repository.js';
import { CollectionTutorialsRepository } from './repositories/collection-tutorials.repository.js';
import type {
  CreateCollectionInput,
  UpdateCollectionInput,
  AssignTutorialInput,
  CollectionAccessTier,
} from './types/collections.types.js';

// Folders are free or member only. A 'product'-tier folder can't resolve
// ownership (collections carry no productId), so it would lock permanently —
// packs surface as VIRTUAL folders (from product_contents) instead, never as a
// hand-made collection. Keeping 'product' out of the admin path prevents that
// dead-end state.
const VALID_TIERS: CollectionAccessTier[] = ['free', 'member'];

/**
 * Admin folder management — create/edit folders and assign tutorials to them.
 * All admin-gated; writes use the service-role client (via the repositories),
 * so the AdminGuard is the real boundary.
 *
 * NOTE: assigning a tutorial to a folder is PURELY organizational — it does NOT
 * mutate the tutorial's access_tier/product_id (unlike adding content to a
 * pack, which gates it). Folder access is governed by the folder's own
 * access_tier; tutorial access stays governed by product_contents. Keeping
 * these separate is what prevents two authorities from fighting over gating.
 */
@Controller('api/v1/admin/collections')
@UseGuards(AdminGuard)
export class AdminCollectionsController {
  constructor(
    private readonly collectionsRepository: CollectionsRepository,
    private readonly collectionTutorialsRepository: CollectionTutorialsRepository,
  ) {}

  /** List ALL folders (incl. inactive) for the admin table. */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list() {
    const collections = await this.collectionsRepository.findAll();
    return { collections };
  }

  /** One folder + its tutorial assignments (admin edit view). */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(@Param('id') id: string) {
    const collection = await this.collectionsRepository.findById(id);
    if (!collection) throw new NotFoundException('Collection not found');
    const tutorials =
      await this.collectionTutorialsRepository.findByCollectionId(id);
    return { collection, tutorials };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() input: CreateCollectionInput) {
    if (!input.slug?.trim()) throw new BadRequestException('slug is required');
    if (!input.title?.trim()) throw new BadRequestException('title is required');
    if (input.accessTier && !VALID_TIERS.includes(input.accessTier)) {
      throw new BadRequestException('Invalid accessTier');
    }
    const collection = await this.collectionsRepository.create(input);
    return { collection };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() patch: UpdateCollectionInput) {
    if (patch.accessTier && !VALID_TIERS.includes(patch.accessTier)) {
      throw new BadRequestException('Invalid accessTier');
    }
    const existing = await this.collectionsRepository.findById(id);
    if (!existing) throw new NotFoundException('Collection not found');
    const collection = await this.collectionsRepository.update(id, patch);
    return { collection };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    const existing = await this.collectionsRepository.findById(id);
    if (!existing) throw new NotFoundException('Collection not found');
    // collection_tutorials rows cascade via the FK.
    await this.collectionsRepository.delete(id);
    return { removed: true };
  }

  // ---- tutorial assignments ------------------------------------------------

  @Post(':id/tutorials')
  @HttpCode(HttpStatus.CREATED)
  async assignTutorial(
    @Param('id') collectionId: string,
    @Body() input: AssignTutorialInput,
  ) {
    if (!input.tutorialId) {
      throw new BadRequestException('tutorialId is required');
    }
    const collection = await this.collectionsRepository.findById(collectionId);
    if (!collection) throw new NotFoundException('Collection not found');

    const assignment = await this.collectionTutorialsRepository.add({
      collectionId,
      tutorialId: input.tutorialId,
      sortOrder: input.sortOrder ?? 0,
    });
    return { assignment };
  }

  @Delete('tutorials/:assignmentId')
  @HttpCode(HttpStatus.OK)
  async unassignTutorial(@Param('assignmentId') assignmentId: string) {
    await this.collectionTutorialsRepository.remove(assignmentId);
    return { removed: true };
  }
}
