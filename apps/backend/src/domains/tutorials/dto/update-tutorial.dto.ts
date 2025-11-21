import { PartialType } from '@nestjs/mapped-types';
import { CreateTutorialDto } from './create-tutorial.dto.js';

export class UpdateTutorialDto extends PartialType(CreateTutorialDto) {}