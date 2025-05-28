import { registrationSchema, RegistrationData } from '@bassnotion/contracts';

export class RegisterUserDto implements RegistrationData {
  email: string;
  password: string;
  confirmPassword: string;

  constructor(data: Partial<RegistrationData> = {}) {
    // Validate the input data with Zod schema
    const validated = registrationSchema.parse(data);

    this.email = validated.email;
    this.password = validated.password;
    this.confirmPassword = validated.confirmPassword;
  }

  /**
   * Static method to create and validate a RegisterUserDto
   */
  static create(data: unknown): RegisterUserDto {
    const validated = registrationSchema.parse(data);
    return new RegisterUserDto(validated);
  }

  /**
   * Get the Zod schema for this DTO
   */
  static getSchema() {
    return registrationSchema;
  }
}
