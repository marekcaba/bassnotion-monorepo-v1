import { signInSchema, SignInData } from '@bassnotion/contracts';

export class SignInDto implements SignInData {
  email: string;
  password: string;

  constructor(data: Partial<SignInData> = {}) {
    // Validate the input data with Zod schema
    const validated = signInSchema.parse(data);

    this.email = validated.email;
    this.password = validated.password;
  }

  /**
   * Static method to create and validate a SignInDto
   */
  static create(data: unknown): SignInDto {
    const validated = signInSchema.parse(data);
    return new SignInDto(validated);
  }

  /**
   * Get the Zod schema for this DTO
   */
  static getSchema() {
    return signInSchema;
  }
}
