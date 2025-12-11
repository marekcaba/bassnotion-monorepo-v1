import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';

/**
 * Optional authentication guard that allows both authenticated and unauthenticated requests.
 * If a valid token is provided, it will attach the user to the request.
 * If no token or an invalid token is provided, the request continues without a user.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly authGuard: AuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Try to authenticate but don't fail if it doesn't work
      await this.authGuard.canActivate(context);
    } catch (error) {
      // Authentication failed, but that's okay for optional auth
      // The request will continue without a user
    }

    // Always return true to allow the request to continue
    return true;
  }
}
