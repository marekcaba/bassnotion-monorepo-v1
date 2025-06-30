import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

/**
 * Validation pipe that uses Zod schemas for request validation
 * Replaces the class-validator ValidationPipe
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema?: ZodSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    // Skip validation for non-body parameters
    if (metadata.type !== 'body') {
      return value;
    }

    // If no schema provided, try to get it from the metatype
    let schema = this.schema;
    if (!schema && metadata.metatype) {
      // Check if the metatype has a getSchema static method (our DTOs)
      if (
        typeof metadata.metatype === 'function' &&
        'getSchema' in metadata.metatype &&
        typeof metadata.metatype.getSchema === 'function'
      ) {
        schema = metadata.metatype.getSchema();
      }
    }

    if (!schema) {
      return value;
    }

    try {
      return schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        });
        throw new BadRequestException({
          message: 'Validation failed',
          errors: errorMessages,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}

/**
 * Factory function to create a ZodValidationPipe with a specific schema
 */
export function createZodValidationPipe(schema: ZodSchema) {
  return new ZodValidationPipe(schema);
}
