import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { AuthService } from '../auth.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../../shared/services/request-context.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly staticLogger = createStructuredLogger(AuthGuard.name);

  constructor(
    private readonly authService: AuthService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.debug('AuthGuard initialized', { correlationId });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Create logger directly to avoid initialization issues
    const logger = createStructuredLogger('AuthGuard.canActivate');
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    logger.debug('AuthGuard checking request', {
      url: request.url,
      headers: {
        authorization: request.headers.authorization?.substring(0, 50),
      },
    });

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      logger.error('No token provided in request');
      throw new UnauthorizedException('No token provided');
    }

    logger.debug('Token extracted', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 20),
    });

    try {
      const user = await this.authService.validateToken(token);
      (request as FastifyRequest & { user: unknown }).user = user;
      logger.debug('User authenticated successfully', { userId: user.id });
      return true;
    } catch (error) {
      logger.error('Token validation failed', error as Error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: FastifyRequest): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
