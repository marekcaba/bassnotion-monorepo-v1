import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

import { AuthCredentials } from '../types/auth.types.js';

export class LoginUserDto implements AuthCredentials {
  constructor(data: Partial<LoginUserDto> = {}) {
    this.email = data.email ?? '';
    this.password = data.password ?? '';
  }

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
