import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignInDto {
  constructor(data: Partial<SignInDto> = {}) {
    this.email = data.email ?? '';
    this.password = data.password ?? '';
  }

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
