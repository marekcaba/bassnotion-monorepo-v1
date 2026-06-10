/**
 * Grooves Controller — REST API for the reusable groove library.
 *
 * Public: list active grooves + get one (so the admin block-editor picker and
 * the public tutorial fetch can read them). Admin-only: create + update.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { GroovesService } from './grooves.service.js';
import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { OptionalAuthGuard } from '../user/auth/guards/optional-auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../user/auth/types/auth.types.js';
import { EntitlementService } from '../billing/services/entitlement.service.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { createStructuredLogger, isFeatureKey } from '@bassnotion/contracts';
import type { FeatureKey } from '@bassnotion/contracts';
import type {
  CreateGrooveInput,
  UpdateGrooveInput,
} from '@bassnotion/contracts';

/** Signed-URL TTL for premium basslines (seconds). Short — access-controlled at
 *  issuance, not DRM; playback uses the decoded buffer, so a short window is
 *  plenty for a cold fetch and limits reshare. */
const BASSLINE_URL_TTL_SECONDS = 600; // 10 minutes

@Controller('api/v1/grooves')
export class GroovesController {
  private readonly logger = createStructuredLogger(GroovesController.name);

  constructor(
    private readonly groovesService: GroovesService,
    private readonly entitlementService: EntitlementService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /** GET /api/v1/grooves/library — list grooves (active by default). */
  @Get('library')
  @UseGuards(AuthGuard)
  async listGrooves(@Query('includeInactive') includeInactive?: string) {
    return this.groovesService.listGrooves(includeInactive === 'true');
  }

  /** GET /api/v1/grooves/library/:id — fetch a single groove. */
  @Get('library/:id')
  async getGroove(@Param('id') id: string) {
    const groove = await this.groovesService.getGrooveById(id);
    return { groove };
  }

  /**
   * GET /api/v1/grooves/library/:id/bassline-url?variantId=X — mint a short-lived
   * signed URL for a premium bassline variant ("Lines & Fills").
   *
   * Gates on BOTH (AND-ed), per the validated design:
   *   1. CONTENT — the user must be able to open THIS groove at all
   *      (entitlementService.canAccessContent on the groove's own tier), so a
   *      free user on a member/product-gated groove can't fetch its files even
   *      if they hold the feature.
   *   2. FEATURE — the user must own the feature that unlocks the variant
   *      (default `linesAndFills`), so a member without Bass College can't use
   *      premium basslines on a free groove.
   * Either failing → 403. Then sign from the PRIVATE premium-basslines bucket.
   */
  @Get('library/:id/bassline-url')
  @UseGuards(OptionalAuthGuard)
  async getBasslineUrl(
    @Param('id') grooveId: string,
    @Query('variantId') variantId: string | undefined,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<{ url: string; expiresAt: string }> {
    if (!variantId) {
      throw new BadRequestException('variantId is required');
    }

    const gate = await this.groovesService.resolveBasslineGate(
      grooveId,
      variantId,
    );

    // 1. Content gate — can this user open this groove at all?
    const canOpenGroove = await this.entitlementService.canAccessContent(
      user?.id ?? null,
      {
        accessTier: gate.accessTier,
        productId: gate.productId,
        contentRef:
          gate.accessTier === 'product'
            ? { type: 'groove', id: grooveId }
            : undefined,
      },
    );
    if (!canOpenGroove) {
      throw new ForbiddenException({
        message: 'You do not have access to this groove',
        requiredTier: gate.accessTier,
      });
    }

    // 2. Feature gate — does this user own the feature that unlocks the variant?
    const featureKey: FeatureKey = isFeatureKey(gate.feature)
      ? gate.feature
      : 'linesAndFills';
    const granted = await this.entitlementService.getGrantedFeatures(
      user?.id ?? null,
    );
    if (!granted.includes(featureKey)) {
      throw new ForbiddenException({
        message: 'This bassline is a premium feature',
        requiredFeature: featureKey,
      });
    }

    // Both checks passed → mint a short-lived signed read URL from the private
    // bucket. (gate.bucket is whatever the variant URL pointed at — typically
    // premium-basslines; createSignedReadUrl works for any bucket via service
    // role.)
    return this.supabaseService.createSignedReadUrl(
      gate.bucket,
      gate.objectPath,
      BASSLINE_URL_TTL_SECONDS,
    );
  }

  /** POST /api/v1/grooves/library — create a groove (admin). */
  @Post('library')
  @UseGuards(AdminGuard)
  async createGroove(@Body() input: CreateGrooveInput) {
    this.logger.info('Creating groove', { name: input.name });
    const groove = await this.groovesService.createGroove(input);
    return { groove };
  }

  /** PATCH /api/v1/grooves/library/:id — update a groove (admin). */
  @Patch('library/:id')
  @UseGuards(AdminGuard)
  async updateGroove(
    @Param('id') id: string,
    @Body() input: UpdateGrooveInput,
  ) {
    const groove = await this.groovesService.updateGroove(id, input);
    return { groove };
  }
}
