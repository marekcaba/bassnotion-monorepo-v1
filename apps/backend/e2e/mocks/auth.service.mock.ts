import { Injectable } from '@nestjs/common';

import { SignInDto } from '../../src/domains/user/auth/dto/sign-in.dto.js';
import { SignUpDto } from '../../src/domains/user/auth/dto/sign-up.dto.js';
import { AuthResponse } from '../../src/domains/user/auth/types/auth.types.js';

import { mockAuthResponse, mockUser, mockSession } from '../test-utils.js';

@Injectable()
export class MockAuthService {
  async registerUser(signUpDto: SignUpDto): Promise<AuthResponse> {
    // Simulate validation
    if (!signUpDto.email.includes('@')) {
      return mockAuthResponse(false, 'Invalid email format');
    }
    if (signUpDto.password.length < 8) {
      return mockAuthResponse(
        false,
        'Password must be at least 8 characters long',
      );
    }
    if (signUpDto.email === 'existing@example.com') {
      return mockAuthResponse(false, 'User already exists');
    }

    return mockAuthResponse(true, 'Registration successful', {
      user: { ...mockUser, email: signUpDto.email },
      session: mockSession,
    });
  }

  async loginUser(signInDto: SignInDto): Promise<AuthResponse> {
    // Simulate validation
    if (!signInDto.email.includes('@')) {
      return mockAuthResponse(false, 'Invalid email format');
    }
    if (signInDto.password.length < 8) {
      return mockAuthResponse(false, 'Invalid credentials');
    }
    if (signInDto.email === 'nonexistent@example.com') {
      return mockAuthResponse(false, 'Invalid credentials');
    }

    return mockAuthResponse(true, 'Login successful', {
      user: { ...mockUser, email: signInDto.email },
      session: mockSession,
    });
  }
}
