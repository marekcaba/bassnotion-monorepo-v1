import { Controller, Get, UseGuards } from '@nestjs/common';

import { CollectionsService } from './collections.service.js';
import { OptionalAuthGuard } from '../user/auth/guards/optional-auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../user/auth/types/auth.types.js';
import { CollectionView } from './types/collections.types.js';

/**
 * Public sidebar-folder endpoint. OptionalAuthGuard so anonymous callers get
 * free folders (locked teasers for the rest) and authenticated callers get
 * their entitled folders + virtual folders for any packs they own.
 */
@Controller('collections')
@UseGuards(OptionalAuthGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<{ collections: CollectionView[] }> {
    const collections = await this.collectionsService.getVisibleCollections(
      user?.id ?? null,
    );
    return { collections };
  }
}
