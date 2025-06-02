import { z } from 'zod';

/**
 * Delete account DTO - requires password confirmation
 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required for account deletion'),
});

export type DeleteAccountData = z.infer<typeof deleteAccountSchema>;

export class DeleteAccountDto implements DeleteAccountData {
  password!: string;

  constructor(data: unknown) {
    const validated = deleteAccountSchema.parse(data);
    Object.assign(this, validated);
  }

  static create(data: unknown): DeleteAccountDto {
    return new DeleteAccountDto(data);
  }

  static getSchema() {
    return deleteAccountSchema;
  }
} 