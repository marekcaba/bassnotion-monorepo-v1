import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { AuthService } from '../auth.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../../shared/services/request-context.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly staticLogger = createStructuredLogger(AuthGuard.name);

  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug('AuthGuard initialized', { correlationId });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const user = await this.authService.validateToken(token);
      (request as FastifyRequest & { user: unknown }).user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: FastifyRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
