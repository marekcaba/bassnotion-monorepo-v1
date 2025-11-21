import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AuthService } from '../auth.service.js';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../../shared/services/request-context.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { FastifyRequest } from 'fastify';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly staticLogger = createStructuredLogger(AdminGuard.name);

  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    @Inject(SupabaseService)
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug('AdminGuard initialized', { correlationId });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Extract token
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Validate token and get user
    let user: any;
    try {
      user = await this.authService.validateToken(token);
      (request as FastifyRequest & { user: unknown }).user = user;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    // Check if user has admin role
    const { data: profile, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      throw new ForbiddenException('Unable to verify admin status');
    }

    if (profile.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }

  private extractTokenFromHeader(request: FastifyRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}