import type { User } from '@bassnotion/contracts';
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Get,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { AuthGuard } from './guards/auth.guard.js';
import { AuthResponse } from './types/auth.types.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {
    this.logger.debug('AuthController constructor called');
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() signUpDto: SignUpDto): Promise<AuthResponse> {
    this.logger.debug(`Signup request received for email: ${signUpDto.email}`);
    return this.authService.registerUser(signUpDto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(@Body() signInDto: SignInDto): Promise<AuthResponse> {
    this.logger.debug(`Signin request received for email: ${signInDto.email}`);
    return this.authService.authenticateUser(signInDto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(): Promise<User> {
    this.logger.debug('Get current user request received');
    return this.authService.getCurrentUser();
  }
}
