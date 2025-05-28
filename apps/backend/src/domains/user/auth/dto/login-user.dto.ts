import { loginSchema, LoginData } from '@bassnotion/contracts';
import { AuthCredentials } from '../types/auth.types.js';

export class LoginUserDto implements AuthCredentials, LoginData {
  email: string;
  password: string;

  constructor(data: Partial<LoginData> = {}) {
    // Validate the input data with Zod schema
    const validated = loginSchema.parse(data);

    this.email = validated.email;
    this.password = validated.password;
  }

  /**
   * Static method to create and validate a LoginUserDto
   */
  static create(data: unknown): LoginUserDto {
    const validated = loginSchema.parse(data);
    return new LoginUserDto(validated);
  }

  /**
   * Get the Zod schema for this DTO
   */
  static getSchema() {
    return loginSchema;
  }
}
