import { signUpSchema, SignUpData } from '@bassnotion/contracts';
import { z } from 'zod';

export class SignUpDto implements SignUpData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  bio?: string;

  constructor(data: Partial<SignUpData> = {}) {
    // Validate the input data with Zod schema
    const validated = signUpSchema.parse(data);

    this.email = validated.email;
    this.password = validated.password;
    this.confirmPassword = validated.confirmPassword;
    this.displayName = validated.displayName;
    this.bio = validated.bio;
  }

  /**
   * Static method to create and validate a SignUpDto
   */
  static create(data: unknown): SignUpDto {
    const validated = signUpSchema.parse(data);
    return new SignUpDto(validated);
  }

  /**
   * Get the Zod schema for this DTO
   */
  static getSchema(): z.ZodSchema<SignUpData> {
    return signUpSchema;
  }
}
