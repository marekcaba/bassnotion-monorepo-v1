import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  Matches,
} from 'class-validator';

import { Match } from '../../../../shared/decorators/match.decorator.js';

export class RegisterUserDto {
  constructor(data: Partial<RegisterUserDto> = {}) {
    this.email = data.email ?? '';
    this.password = data.password ?? '';
    this.confirmPassword = data.confirmPassword ?? '';
  }

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9!@#$%^&*])/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number or special character',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @Match('password')
  confirmPassword: string;
}
