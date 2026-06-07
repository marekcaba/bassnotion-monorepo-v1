import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { ProductRepository } from './repositories/product.repository.js';
import { ProductContentsRepository } from './repositories/product-contents.repository.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  AddProductContentInput,
  ProductType,
} from './types/billing.types.js';

const VALID_TYPES: ProductType[] = [
  'membership',
  'groove_pack',
  'accelerator',
  'course',
];

/**
 * Admin product management — create/edit products (Groove Packs, Accelerator),
 * manage which content they bundle, and upload cover images. All admin-gated.
 *
 * Writes use the service-role Supabase client (via the repositories), bypassing
 * RLS — the AdminGuard is the real boundary.
 */
@Controller('api/v1/billing/admin/products')
@UseGuards(AdminGuard)
export class AdminProductsController {
  private readonly logger = new Logger(AdminProductsController.name);

  constructor(
    private readonly productRepository: ProductRepository,
    private readonly productContentsRepository: ProductContentsRepository,
    private readonly supabaseService: SupabaseService,
  ) {}

  /** List ALL products (incl. inactive) for the admin table. */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list() {
    const products = await this.productRepository.findAll();
    return { products };
  }

  /** One product + its bundled contents (admin edit view). */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(@Param('id') id: string) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    const contents = await this.productContentsRepository.findByProductId(id);
    return { product, contents };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() input: CreateProductInput) {
    this.validate(input);
    const product = await this.productRepository.create(input);
    return { product };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() patch: UpdateProductInput) {
    if (patch.type && !VALID_TYPES.includes(patch.type)) {
      throw new BadRequestException('Invalid product type');
    }
    if (patch.priceInCents !== undefined && patch.priceInCents < 0) {
      throw new BadRequestException('priceInCents must be >= 0');
    }
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new NotFoundException('Product not found');
    const product = await this.productRepository.update(id, patch);
    return { product };
  }

  // ---- product contents (the bundle) --------------------------------------

  @Post(':id/contents')
  @HttpCode(HttpStatus.CREATED)
  async addContent(
    @Param('id') productId: string,
    @Body() input: AddProductContentInput,
  ) {
    if (!['groove', 'video', 'exercise'].includes(input.contentType)) {
      throw new BadRequestException('Invalid contentType');
    }
    if (!input.contentId) {
      throw new BadRequestException('contentId is required');
    }
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    const content = await this.productContentsRepository.add({
      productId,
      contentType: input.contentType,
      contentId: input.contentId,
      unlockDay: input.unlockDay ?? 0,
      sortOrder: input.sortOrder ?? 0,
      note: input.note,
    });
    return { content };
  }

  @Delete('contents/:contentRowId')
  @HttpCode(HttpStatus.OK)
  async removeContent(@Param('contentRowId') contentRowId: string) {
    await this.productContentsRepository.remove(contentRowId);
    return { removed: true };
  }

  // ---- cover image upload (mirrors admin tutorial thumbnail upload) --------

  @Post(':id/upload-cover')
  @HttpCode(HttpStatus.OK)
  async uploadCover(
    @Param('id') productId: string,
    @Req() req: FastifyRequest,
  ) {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    const data = await req.file();
    if (!data) throw new BadRequestException('No file uploaded');

    const { file, filename, mimetype } = data;
    const chunks: Buffer[] = [];
    for await (const chunk of file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large (max 5MB)');
    }
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimeTypes.includes(mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${mimetype} (must be JPEG, PNG, WebP, or GIF)`,
      );
    }

    const fileExt = filename.split('.').pop() || 'jpg';
    const filePath = `products/${productId}/${productId}-${Date.now()}.${fileExt}`;

    // Reuse the public tutorial-thumbnails bucket (marketing imagery; no new
    // bucket + RLS to set up). Cover images are intentionally public.
    const publicUrl = await this.supabaseService.uploadFile(
      'tutorial-thumbnails',
      filePath,
      buffer,
      mimetype,
    );

    await this.productRepository.update(productId, { coverImageUrl: publicUrl });
    this.logger.log(`Uploaded product cover: ${productId}`);

    return { publicUrl };
  }

  // ---- validation ----------------------------------------------------------

  private validate(input: CreateProductInput): void {
    if (!input.slug) throw new BadRequestException('slug is required');
    if (!input.name) throw new BadRequestException('name is required');
    if (!VALID_TYPES.includes(input.type)) {
      throw new BadRequestException('Invalid product type');
    }
    if (input.priceInCents === undefined || input.priceInCents < 0) {
      throw new BadRequestException('priceInCents must be >= 0');
    }
  }
}
