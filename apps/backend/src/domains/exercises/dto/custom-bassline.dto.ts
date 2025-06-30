import {
  CustomBasslineSchema,
  SaveCustomBasslineRequestSchema,
  GetCustomBasslinesResponseSchema,
  type CustomBasslineInput,
  type SaveCustomBasslineRequestInput,
} from '@bassnotion/contracts';

// Custom Bassline DTOs
export type CustomBasslineDto = CustomBasslineInput;
export type SaveCustomBasslineDto = SaveCustomBasslineRequestInput;

export interface CustomBasslinesResponseDto {
  basslines: CustomBasslineDto[];
  total: number;
}

// Validation functions using contracts schemas
export const validateSaveCustomBassline = (
  data: unknown,
): SaveCustomBasslineDto => {
  return SaveCustomBasslineRequestSchema.parse(data);
};

export const validateCustomBassline = (data: unknown): CustomBasslineDto => {
  return CustomBasslineSchema.parse(data);
};

export const validateCustomBasslinesResponse = (data: unknown) => {
  return GetCustomBasslinesResponseSchema.parse(data);
};
