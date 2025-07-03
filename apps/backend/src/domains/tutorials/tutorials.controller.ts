import { Controller, Get, Param } from '@nestjs/common';
import { TutorialsService } from './tutorials.service.js';
import type {
  TutorialsResponse,
  TutorialResponse,
  TutorialExercisesResponse,
} from '@bassnotion/contracts';

@Controller('tutorials')
export class TutorialsController {
  constructor(private readonly tutorialsService: TutorialsService) {}

  @Get()
  async findAll(): Promise<TutorialsResponse> {
    return await this.tutorialsService.findAll();
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string): Promise<TutorialResponse> {
    const tutorial = await this.tutorialsService.findBySlug(slug);
    return { tutorial };
  }

  @Get(':slug/exercises')
  async findExercisesBySlug(
    @Param('slug') slug: string,
  ): Promise<TutorialExercisesResponse> {
    return await this.tutorialsService.findExercisesByTutorialSlug(slug);
  }
}
