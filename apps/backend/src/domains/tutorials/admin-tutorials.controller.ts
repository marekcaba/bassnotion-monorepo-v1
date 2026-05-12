import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AdminTutorialsService } from './admin-tutorials.service.js';
import { CreateTutorialDto } from './dto/create-tutorial.dto.js';
import { CreatorsService } from '../creators/creators.service.js';
import { UpdateTutorialDto } from './dto/update-tutorial.dto.js';
import { SaveTutorialWithExercisesDto } from './dto/save-tutorial-with-exercises.dto.js';
import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../user/auth/types/auth.types.js';
import { CorrelationId } from '../../shared/decorators/correlation-id.decorator.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';

@Controller('api/v1/tutorials')
export class AdminTutorialsController {
  private readonly logger = new Logger(AdminTutorialsController.name);

  constructor(
    private readonly tutorialsService: AdminTutorialsService,
    private readonly creatorsService: CreatorsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding all tutorials`, {
      correlationId,
      page,
      limit,
      search,
    });

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    if (pageNum < 1 || limitNum < 1) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    return await this.tutorialsService.findAll({
      page: pageNum,
      limit: limitNum,
      search,
    });
  }

  @Get('published')
  async findPublished(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding published tutorials`, { correlationId });

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return await this.tutorialsService.findPublished({
      page: pageNum,
      limit: limitNum,
    });
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding tutorial by ID: ${id}`, { correlationId });

    const tutorial = await this.tutorialsService.findById(id);
    if (!tutorial) {
      throw new NotFoundException(`Tutorial with ID ${id} not found`);
    }

    return tutorial;
  }

  @Get('slug/:slug')
  async findBySlug(
    @Param('slug') slug: string,
    @Query('includeExercises') includeExercises?: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding tutorial by slug: ${slug}`, {
      correlationId,
      includeExercises: includeExercises === 'true',
    });

    const tutorial = await this.tutorialsService.findBySlug(slug);
    if (!tutorial) {
      throw new NotFoundException(`Tutorial with slug ${slug} not found`);
    }

    // OPTIMIZATION: Batch fetch exercises with tutorial to reduce API calls
    if (includeExercises === 'true') {
      const exercises = await this.tutorialsService.findExercisesByTutorialId(
        tutorial.id,
      );
      return { tutorial, exercises };
    }

    return tutorial;
  }

  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createTutorialDto: CreateTutorialDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Creating new tutorial`, {
      correlationId,
      userId: user.id,
      title: createTutorialDto.title,
    });

    return await this.tutorialsService.create({
      ...createTutorialDto,
      created_by: user.id,
    });
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() updateTutorialDto: UpdateTutorialDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Updating tutorial: ${id}`, {
      correlationId,
      userId: user.id,
    });

    const tutorial = await this.tutorialsService.update(id, updateTutorialDto);
    if (!tutorial) {
      throw new NotFoundException(`Tutorial with ID ${id} not found`);
    }

    return tutorial;
  }

  /**
   * Batch save endpoint - atomically saves tutorial + exercises
   * FAANG-level pattern: Single API call for complex operations
   */
  @Put(':id/save-with-exercises')
  @UseGuards(AdminGuard)
  async saveWithExercises(
    @Param('id') id: string,
    @Body() dto: SaveTutorialWithExercisesDto,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Batch saving tutorial with exercises: ${id}`, {
      correlationId,
      userId: user.id,
      exerciseCount: dto.exercises.length,
    });

    // Validate that the ID in the URL matches the ID in the DTO
    if (dto.id !== id) {
      throw new BadRequestException('Tutorial ID mismatch');
    }

    const result = await this.tutorialsService.saveWithExercises(dto, user.id);
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Deleting tutorial: ${id}`, {
      correlationId,
    });

    const result = await this.tutorialsService.delete(id);
    if (!result) {
      throw new NotFoundException(`Tutorial with ID ${id} not found`);
    }
  }

  @Post(':id/publish')
  @UseGuards(AdminGuard)
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Publishing tutorial: ${id}`, {
      correlationId,
      userId: user.id,
    });

    const tutorial = await this.tutorialsService.publish(id);
    if (!tutorial) {
      throw new NotFoundException(`Tutorial with ID ${id} not found`);
    }

    return tutorial;
  }

  @Post(':id/unpublish')
  @UseGuards(AdminGuard)
  async unpublish(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Unpublishing tutorial: ${id}`, {
      correlationId,
      userId: user.id,
    });

    const tutorial = await this.tutorialsService.unpublish(id);
    if (!tutorial) {
      throw new NotFoundException(`Tutorial with ID ${id} not found`);
    }

    return tutorial;
  }

  @Get(':id/related')
  async findRelated(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding related tutorials for: ${id}`, { correlationId });

    const limitNum = limit ? parseInt(limit, 10) : 5;
    return await this.tutorialsService.findRelated(id, limitNum);
  }

  @Post('batch')
  async findByIds(
    @Body('ids') ids: string[],
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Finding tutorials by IDs`, {
      correlationId,
      count: ids.length,
    });

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('Invalid IDs array');
    }

    return await this.tutorialsService.findByIds(ids);
  }

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('level') level?: string,
    @Query('tags') tags?: string,
    @Query('active') active?: string,
    @Query('published') published?: string,
    @Query('author') author?: string,
    @Query('durationMin') durationMin?: string,
    @Query('durationMax') durationMax?: string,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Searching tutorials`, {
      correlationId,
      query,
      filters: { level, tags, active, published, author },
    });

    if (!query) {
      throw new BadRequestException('Search query is required');
    }

    return await this.tutorialsService.search({
      query,
      level,
      tags: tags?.split(','),
      isActive: active === 'true',
      isPublished: published === 'true',
      author,
      durationMin: durationMin ? parseInt(durationMin, 10) : undefined,
      durationMax: durationMax ? parseInt(durationMax, 10) : undefined,
    });
  }

  /**
   * Upload tutorial thumbnail image
   * POST /api/v1/tutorials/:id/upload-thumbnail
   *
   * Uploads a custom thumbnail image for a tutorial.
   * Uses service role key to bypass storage RLS policies.
   */
  @Post(':id/upload-thumbnail')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  async uploadThumbnail(
    @Param('id') tutorialId: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log('Uploading tutorial thumbnail', {
      correlationId,
      tutorialId,
      userId: user.id,
    });

    // Verify tutorial exists
    const tutorial = await this.tutorialsService.findById(tutorialId);
    if (!tutorial) {
      throw new NotFoundException(`Tutorial with ID ${tutorialId} not found`);
    }

    // Get the multipart file from Fastify request
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    const { file, filename, mimetype } = data;

    // Read file buffer from stream
    const chunks: Buffer[] = [];
    for await (const chunk of file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const fileSize = buffer.length;

    this.logger.log('Thumbnail file received', {
      filename,
      fileSize,
      mimetype,
      correlationId,
    });

    // Validation: file size (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (fileSize > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large: ${fileSize} bytes (max ${MAX_FILE_SIZE} bytes)`,
      );
    }

    // Validation: file type (must be an image)
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimeTypes.includes(mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${mimetype} (must be JPEG, PNG, WebP, or GIF)`,
      );
    }

    // Generate unique filename
    const fileExt = filename.split('.').pop() || 'jpg';
    const uniqueFilename = `${tutorialId}-${Date.now()}.${fileExt}`;
    const filePath = `tutorials/${tutorialId}/${uniqueFilename}`;

    try {
      // Upload using service role (bypasses RLS)
      const publicUrl = await this.supabaseService.uploadFile(
        'tutorial-thumbnails',
        filePath,
        buffer,
        mimetype,
      );

      this.logger.log('Successfully uploaded tutorial thumbnail', {
        tutorialId,
        filePath,
        publicUrl,
        correlationId,
      });

      // Update the tutorial's thumbnail_url in the database
      await this.tutorialsService.update(tutorialId, {
        thumbnail_url: publicUrl,
      });

      this.logger.log('Updated tutorial thumbnail_url in database', {
        tutorialId,
        publicUrl,
        correlationId,
      });

      return {
        publicUrl,
        filePath,
        filename,
        fileSize,
      };
    } catch (error: any) {
      this.logger.error('Failed to upload tutorial thumbnail', error, {
        tutorialId,
        filename,
        correlationId,
      });
      throw new BadRequestException('Failed to upload thumbnail: ' + error.message);
    }
  }

  @Post('fetch-youtube-channel-info')
  @UseGuards(AdminGuard)
  async fetchYouTubeChannelInfo(
    @Body() body: { youtubeUrl?: string; channelUrl?: string },
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ) {
    this.logger.log(`Fetching YouTube channel info`, {
      correlationId,
      userId: user.id,
      youtubeUrl: body.youtubeUrl,
      channelUrl: body.channelUrl,
    });

    try {
      let channelId: string | null = null;

      // Extract channel ID from YouTube video URL or channel URL
      if (body.youtubeUrl) {
        // Extract video ID from YouTube URL
        const videoIdMatch = body.youtubeUrl.match(
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        );

        if (videoIdMatch) {
          const videoId = videoIdMatch[1];
          // Fetch video details to get channel ID
          const apiKey =
            process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;

          if (!apiKey) {
            throw new BadRequestException('YouTube API key not configured');
          }

          const videoResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`,
          );

          if (!videoResponse.ok) {
            throw new BadRequestException('Failed to fetch video details');
          }

          const videoData = await videoResponse.json();
          if (videoData.items && videoData.items[0]) {
            channelId = videoData.items[0].snippet.channelId;
          }
        }
      } else if (body.channelUrl) {
        // Extract channel ID from channel URL
        const channelMatch = body.channelUrl.match(
          /(?:youtube\.com\/channel\/|youtube\.com\/@|youtube\.com\/c\/|youtube\.com\/user\/)([^\/\?]+)/,
        );

        if (channelMatch) {
          const channelIdentifier = channelMatch[1];

          // If it starts with UC, it's a channel ID
          if (channelIdentifier.startsWith('UC')) {
            channelId = channelIdentifier;
          } else {
            // It's a username or handle, need to search for it
            const apiKey =
              process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;

            if (!apiKey) {
              throw new BadRequestException('YouTube API key not configured');
            }

            // Search for channel by handle or username
            const searchResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${channelIdentifier}&key=${apiKey}`,
            );

            if (!searchResponse.ok) {
              throw new BadRequestException('Failed to search for channel');
            }

            const searchData = await searchResponse.json();
            if (searchData.items && searchData.items[0]) {
              channelId = searchData.items[0].snippet.channelId;
            }
          }
        }
      }

      if (!channelId) {
        throw new BadRequestException('Could not extract channel information');
      }

      // Fetch channel details
      const channelStats = await this.creatorsService.fetchYouTubeChannelStats([
        channelId,
      ]);

      if (!channelStats.items || channelStats.items.length === 0) {
        throw new NotFoundException('Channel not found');
      }

      const channel = channelStats.items[0];

      return {
        creatorName: channel.snippet.title,
        creatorChannelUrl: `https://www.youtube.com/channel/${channel.id}`,
        creatorAvatarUrl:
          channel.snippet.thumbnails.high?.url ||
          channel.snippet.thumbnails.medium?.url ||
          channel.snippet.thumbnails.default?.url,
        subscriberCount: parseInt(channel.statistics.subscriberCount, 10),
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error('Error fetching YouTube channel info:', error);
      throw new BadRequestException(
        'Failed to fetch YouTube channel information',
      );
    }
  }
}
