import { Controller, Post, Body, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { AudioSamplesService } from './audio-samples.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';

interface UploadSampleDto {
  path: string;
  buffer: string; // Base64 encoded
  contentType: string;
}

interface BatchUploadDto {
  samples: UploadSampleDto[];
}

@Controller('api/v1/audio-samples')
export class AudioSamplesController {
  private readonly staticLogger = createStructuredLogger(AudioSamplesController.name);

  constructor(private readonly audioSamplesService: AudioSamplesService) {}

  @Post('upload')
  @UseGuards(AuthGuard)
  async uploadSample(@Body() dto: UploadSampleDto) {
    try {
      const buffer = Buffer.from(dto.buffer, 'base64');

      if (buffer.length > 10 * 1024 * 1024) {
        // 10MB limit
        throw new HttpException(
          'File size exceeds 10MB limit',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.audioSamplesService.uploadSample(
        dto.path,
        buffer,
        dto.contentType,
      );

      return {
        success: true,
        ...result };
    } catch (error) {
      this.staticLogger.error(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new HttpException(
        error instanceof Error ? error.message : 'Upload failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('upload-batch')
  @UseGuards(AuthGuard)
  async uploadBatch(@Body() dto: BatchUploadDto) {
    try {
      const samples = dto.samples.map((sample) => ({
        path: sample.path,
        buffer: Buffer.from(sample.buffer, 'base64'),
        contentType: sample.contentType }));

      // Check total size
      const totalSize = samples.reduce((sum, s) => sum + s.buffer.length, 0);
      if (totalSize > 50 * 1024 * 1024) {
        // 50MB total limit
        throw new HttpException(
          'Total batch size exceeds 50MB limit',
          HttpStatus.BAD_REQUEST,
        );
      }

      const results = await this.audioSamplesService.uploadBatch(samples);

      return {
        success: true,
        results,
        summary: {
          total: results.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length } };
    } catch (error) {
      this.staticLogger.error(
        `Batch upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new HttpException(
        error instanceof Error ? error.message : 'Batch upload failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('metadata')
  @UseGuards(AuthGuard)
  async createMetadata(
    @Body() dto: { path: string; metadata: Record<string, any> },
  ) {
    try {
      await this.audioSamplesService.createMetadata(dto.path, dto.metadata);

      return {
        success: true,
        message: 'Metadata created successfully' };
    } catch (error) {
      this.staticLogger.error(
        `Metadata creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new HttpException(
        error instanceof Error ? error.message : 'Metadata creation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
