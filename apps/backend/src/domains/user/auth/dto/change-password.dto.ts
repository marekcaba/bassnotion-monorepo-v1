import {
  changePasswordSchema,
  type ChangePasswordData,
} from '@bassnotion/contracts';

/**
 * Change password DTO using Zod validation from contracts
 */
export class ChangePasswordDto implements ChangePasswordData {
  currentPassword!: string;
  newPassword!: string;
  confirmPassword!: string;

  constructor(data: unknown) {
    const validated = changePasswordSchema.parse(data);
    Object.assign(this, validated);
  }

  static create(data: unknown): ChangePasswordDto {
    return new ChangePasswordDto(data);
  }

  static getSchema() {
    return changePasswordSchema;
  }

  /**
   * Validate that newPassword and confirmPassword match
   * This is already validated by the Zod schema, but provided for explicit validation if needed
   */
  validatePasswordMatch(): boolean {
    return this.newPassword === this.confirmPassword;
  }
}
