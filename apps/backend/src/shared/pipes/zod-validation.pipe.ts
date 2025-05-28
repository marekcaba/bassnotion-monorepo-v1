import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation pipe that uses Zod schemas for request validation
 * Replaces the class-validator ValidationPipe
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors to match NestJS validation error format
        const formattedErrors = this.formatZodErrors(error);
        throw new BadRequestException({
          message: 'Validation failed',
          error: 'Bad Request',
          statusCode: 400,
          details: formattedErrors,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }

  /**
   * Format Zod errors to be consistent with class-validator error format
   */
  private formatZodErrors(error: ZodError) {
    return error.errors.map((err) => ({
      property: err.path.join('.'),
      constraints: {
        [err.code]: err.message,
      },
    }));
  }
}

/**
 * Factory function to create a ZodValidationPipe with a specific schema
 */
export function createZodValidationPipe(schema: ZodSchema) {
  return new ZodValidationPipe(schema);
}
