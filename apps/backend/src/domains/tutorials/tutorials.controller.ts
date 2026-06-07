import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { TutorialsService } from './tutorials.service.js';
import { OptionalAuthGuard } from '../user/auth/guards/optional-auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../user/auth/types/auth.types.js';
import { EntitlementService } from '../billing/services/entitlement.service.js';
import type {
  TutorialsResponse,
  TutorialResponse,
  TutorialExercisesResponse,
} from '@bassnotion/contracts';

@Controller('tutorials')
@UseGuards(OptionalAuthGuard)
export class TutorialsController {
  constructor(
    private readonly tutorialsService: TutorialsService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<TutorialsResponse> {
    // Hide tutorials the caller can't access (gated ones won't appear in the
    // sidebar/list); free tutorials always show; admins see all.
    return await this.tutorialsService.findAll(user?.id ?? null);
  }

  @Get(':slug')
  async findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<TutorialResponse> {
    await this.assertCanAccess(slug, user);
    const tutorial = await this.tutorialsService.findBySlug(slug);
    return { tutorial };
  }

  @Get(':slug/exercises')
  async findExercisesBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<TutorialExercisesResponse> {
    await this.assertCanAccess(slug, user);
    return await this.tutorialsService.findExercisesByTutorialSlug(slug);
  }

  /**
   * Gate a tutorial by its access tier:
   *   free    → anyone
   *   member  → active subscription / founder / accelerator owner
   *   product → owns a product (pack/accelerator) that bundles this tutorial
   * Resolved via EntitlementService (the single authority). Unregistered/legacy
   * tutorials default to free, so nothing breaks until one is curated.
   */
  private async assertCanAccess(
    slug: string,
    user: AuthUser | undefined,
  ): Promise<void> {
    const info = await this.tutorialsService.getAccessInfo(slug);
    if (!info || info.accessTier === 'free') return; // free / unknown → open

    const allowed = await this.entitlementService.canAccessContent(
      user?.id ?? null,
      {
        accessTier: info.accessTier,
        productId: info.productId,
        // product-tier: resolve via product_contents (tutorial may be in many packs)
        contentRef:
          info.accessTier === 'product'
            ? { type: 'tutorial', id: info.id }
            : undefined,
      },
    );

    if (!allowed) {
      throw new ForbiddenException({
        message: 'You do not have access to this tutorial',
        requiredTier: info.accessTier,
        productId: info.productId ?? undefined,
      });
    }
  }
}
