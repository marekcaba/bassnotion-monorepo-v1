import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

import { AuthService } from '../auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly authService: AuthService) {
    // Defensive check for AuthService
    if (!this.authService) {
      this.logger.error('AuthService is undefined in AuthGuard constructor!');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Defensive check for AuthService - fail closed for security
    if (!this.authService) {
      this.logger.error(
        'AuthService is undefined - denying access for security',
      );
      throw new UnauthorizedException('Authentication service unavailable');
    }

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
