import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FounderCardConfig,
  founderCardConfigSchema,
} from '@bassnotion/contracts';
import type { FastifyRequest } from 'fastify';

import { FounderMemberRepository } from './repositories/founder-member.repository.js';
import { FounderCardConfigRepository } from './repositories/founder-card-config.repository.js';
import {
  AdminFunnelsService,
  FunnelStats,
} from './services/admin-funnels.service.js';
import { StripeService } from './services/stripe.service.js';
import { AdminGuard } from '../user/auth/guards/admin.guard.js';

const FOUNDER_TOTAL_SPOTS = 100;
const FOUNDER_RESERVED_SPOTS_DEFAULT = 13;

function getReservedSpots(): number {
  const raw = process.env.FOUNDER_RESERVED_SPOTS;
  if (raw === undefined) return FOUNDER_RESERVED_SPOTS_DEFAULT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0)
    return FOUNDER_RESERVED_SPOTS_DEFAULT;
  return Math.min(parsed, FOUNDER_TOTAL_SPOTS);
}

export interface WelcomeContext {
  firstName: string | null;
  paid: boolean;
}

@Controller('api/v1/founders')
export class FoundersController {
  private readonly logger = new Logger(FoundersController.name);

  constructor(
    private readonly founderMemberRepository: FounderMemberRepository,
    private readonly adminFunnelsService: AdminFunnelsService,
    private readonly stripeService: StripeService,
    private readonly founderCardConfigRepository: FounderCardConfigRepository,
  ) {}

  /**
   * Public counter for the "X of 100 spots claimed" UI on the marketing
   * waitlist. Returns the live-mode count only (test purchases aren't
   * shown to visitors). Bounded by FOUNDER_TOTAL_SPOTS so a runaway count
   * can never render over 100.
   *
   * Adds a fixed reserved-spots floor (FOUNDER_RESERVED_SPOTS env var,
   * default 13) for private-funding allocations that don't exist as
   * `founder_members` rows. The bar starts at `reserved` and ticks up as
   * real public sales land — 13 private + 87 public = 100 total.
   *
   * On error, we degrade gracefully and return the reserved floor via
   * the `error` flag so the frontend can choose to keep showing the
   * previous number rather than flicker to zero.
   */
  @Get('count')
  async getFounderCount(): Promise<{
    claimed: number;
    total: number;
    error: false | string;
  }> {
    const reserved = getReservedSpots();
    try {
      const realCount = await this.founderMemberRepository.countByMode('live');
      return {
        claimed: Math.min(realCount + reserved, FOUNDER_TOTAL_SPOTS),
        total: FOUNDER_TOTAL_SPOTS,
        error: false,
      };
    } catch (err) {
      this.logger.error('Failed to read founder count', {
        err: err instanceof Error ? err.message : String(err),
      });
      return {
        claimed: Math.min(reserved, FOUNDER_TOTAL_SPOTS),
        total: FOUNDER_TOTAL_SPOTS,
        error: 'count_unavailable',
      };
    }
  }

  /**
   * Admin-only funnel stats for /admin/funnels. Aggregate counts + top
   * UTM sources/campaigns. Returns no PII — just totals and top-N lists.
   * Gated by the existing AdminGuard (Bearer token → profiles.role='admin').
   */
  @Get('admin/funnels')
  @UseGuards(AdminGuard)
  async getFunnelStats(): Promise<FunnelStats> {
    return this.adminFunnelsService.getStats();
  }

  /**
   * Light personalization context for the /founders/welcome page. The page
   * is reached via Stripe's post-payment redirect, which appends
   * ?session_id=cs_xxx to the URL. We fetch the session server-side (the
   * Stripe secret key never reaches the browser) and return ONLY the
   * first name + a paid boolean.
   *
   * Returns paid=false (and no name) for any session that isn't a
   * completed founder payment — covers the bookmarked-page case, stale
   * URLs, or anyone fishing.
   */
  @Get('welcome-context')
  async getWelcomeContext(
    @Query('session_id') sessionId?: string,
  ): Promise<WelcomeContext> {
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return { firstName: null, paid: false };
    }
    try {
      const session = await this.stripeService.getCheckoutSession(sessionId);
      if (session.payment_status !== 'paid') {
        return { firstName: null, paid: false };
      }
      const fullName = session.customer_details?.name ?? null;
      const firstName = fullName?.split(/\s+/)[0]?.slice(0, 80) ?? null;
      return { firstName, paid: true };
    } catch (err) {
      this.logger.warn('Failed to load welcome context', {
        sessionId,
        err: err instanceof Error ? err.message : String(err),
      });
      return { firstName: null, paid: false };
    }
  }

  /**
   * Public read of the founder-card config. Served to every homepage
   * request (SSR) so the waitlist page can render with the admin's
   * latest copy + sizes without a client-side flash of default text.
   *
   * Repository falls back to in-code defaults if the row is missing or
   * the stored JSON fails Zod validation, so this endpoint never 500s
   * the homepage.
   */
  @Get('card-config')
  async getCardConfig(): Promise<FounderCardConfig> {
    return this.founderCardConfigRepository.loadConfig();
  }

  /**
   * Admin-only write of the founder-card config. Body is validated against
   * the FounderCardConfig Zod schema; any field out of range (e.g. a font
   * size below 8px) returns 400. Records auth.uid() as updated_by so we
   * can see who made the last edit.
   */
  @Put('card-config')
  @UseGuards(AdminGuard)
  async updateCardConfig(
    @Body() body: unknown,
    @Req() req: FastifyRequest & { user?: { id?: string } },
  ): Promise<FounderCardConfig> {
    const parsed = founderCardConfigSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid founder-card config',
        issues: parsed.error.flatten(),
      });
    }
    const updatedBy = req.user?.id ?? null;
    return this.founderCardConfigRepository.saveConfig(parsed.data, updatedBy);
  }
}
