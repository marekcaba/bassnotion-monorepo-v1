import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

import { Match } from '../../../../shared/decorators/match.decorator.js';

export class SignUpDto {
  constructor(data: Partial<SignUpDto> = {}) {
    this.email = data.email ?? '';
    this.password = data.password ?? '';
    this.confirmPassword = data.confirmPassword ?? '';
    this.displayName = data.displayName ?? '';
    this.bio = data.bio ?? '';
  }

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(8)
  @Match('password')
  confirmPassword: string;

  @IsString()
  @MinLength(2)
  displayName: string;

  @IsString()
  @IsOptional()
  bio: string;
}
