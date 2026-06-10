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

  /**
   * GET /api/v1/grooves/bassline-url?path=… — sign a premium bassline by its
   * STORAGE PATH, gated on the `linesAndFills` FEATURE only.
   *
   * For INLINE groove-card blocks (the common authoring path) there is no
   * groove_library row to resolve — the variant lives in the tutorial's block
   * config. So the player passes the variant's storage path directly. We gate on
   * the feature grant (still protects the premium file: a non-member can't sign
   * it), and HARD-RESTRICT to the private `premium-basslines` bucket + a safe
   * path shape so this can't be abused to sign arbitrary objects.
   */
  @Get('bassline-url')
  @UseGuards(OptionalAuthGuard)
  async getBasslineUrlByPath(
    @Query('path') path: string | undefined,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<{ url: string; expiresAt: string }> {
    if (!path) {
      throw new BadRequestException('path is required');
    }
    // Accept either a bare object path (grooves/<slug>/<id>.ogg) or a full
    // storage URL/ref; normalise to the object path within premium-basslines.
    const objectPath = this.normalisePremiumBasslinePath(path);
    if (!objectPath) {
      throw new BadRequestException('invalid bassline path');
    }

    // Feature gate (inline blocks aren't separately content-gated; the TUTORIAL
    // that contains them governs page access).
    const granted = await this.entitlementService.getGrantedFeatures(
      user?.id ?? null,
    );
    if (!granted.includes('linesAndFills')) {
      throw new ForbiddenException({
        message: 'This bassline is a premium feature',
        requiredFeature: 'linesAndFills',
      });
    }

    return this.supabaseService.createSignedReadUrl(
      'premium-basslines',
      objectPath,
      BASSLINE_URL_TTL_SECONDS,
    );
  }

  /**
   * Extract a safe object path WITHIN the premium-basslines bucket from a path
   * or full storage URL. Returns null if it's not a premium-basslines path or
   * contains traversal — so we can NEVER sign an arbitrary object. Strips any
   * `?token=…` from a previously-signed ref.
   */
  private normalisePremiumBasslinePath(input: string): string | null {
    let p = input.trim();
    // Full storage URL/ref → take the part after the bucket name.
    const m = p.match(
      /\/storage\/v1\/object\/(?:public|sign)\/premium-basslines\/([^?]+)/,
    );
    if (m) {
      p = m[1];
    } else if (p.startsWith('premium-basslines/')) {
      p = p.slice('premium-basslines/'.length);
    }
    p = decodeURIComponent(p.split('?')[0]);
    // Safe shape: grooves/<segment>/<file>.ogg, no traversal, no leading slash.
    if (!/^grooves\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.ogg$/.test(p)) {
      return null;
    }
    return p;
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
