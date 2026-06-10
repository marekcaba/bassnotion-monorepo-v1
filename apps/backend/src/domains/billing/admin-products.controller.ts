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

  /**
   * Hard-delete a product. Pre-production action (no real purchases yet), but
   * written to be safe regardless of data: the only FK with ON DELETE CASCADE
   * is `product_contents`; every OTHER reference to products.id must be cleared
   * FIRST or Postgres rejects the delete. In order:
   *   1. Un-gate every bundled content item (tutorials / grooves / videos go
   *      back to access_tier='free', product_id=null) — so they aren't left
   *      stranded at the 'product' tier (inaccessible to everyone) pointing at
   *      a product that no longer exists. Mirrors removeContent's un-gating.
   *   2. NULL out purchases.product_id (nullable FK — preserves the purchase
   *      row / payment history, just detaches it from the deleted product).
   *   3. DELETE accelerator_enrollments for this product (its product_id is
   *      NOT NULL, so it can't be nulled — the enrollment is meaningless once
   *      the product is gone). No-op when empty (the pre-production norm).
   *   4. Delete the product row (product_contents cascades).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new NotFoundException('Product not found');

    // 1. Un-gate bundled content back to free so nothing is orphaned.
    const contents = await this.productContentsRepository.findByProductId(id);
    for (const row of contents) {
      // Only un-gate if this item isn't ALSO bundled in another product.
      const stillBundled = await this.productContentsRepository.findByContent(
        row.contentType,
        row.contentId,
      );
      const elsewhere = stillBundled.filter((r) => r.productId !== id);
      if (elsewhere.length === 0) {
        await this.ungateContent(row.contentType, row.contentId);
      }
    }

    const client = this.supabaseService.getClient();

    // 2. Detach purchases (nullable FK) — keep the rows, drop the product link.
    const { error: purchaseErr } = await client
      .from('purchases')
      .update({ product_id: null })
      .eq('product_id', id);
    if (purchaseErr) {
      this.logger.error(
        `Failed to detach purchases from product ${id}: ${purchaseErr.message}`,
      );
      throw new BadRequestException('Failed to detach purchases');
    }

    // 3. Remove accelerator enrollments (NOT NULL FK — must delete, not null).
    const { error: enrollErr } = await client
      .from('accelerator_enrollments')
      .delete()
      .eq('product_id', id);
    if (enrollErr) {
      this.logger.error(
        `Failed to remove enrollments for product ${id}: ${enrollErr.message}`,
      );
      throw new BadRequestException('Failed to remove enrollments');
    }

    // 4. Delete the product (product_contents cascades).
    await this.productRepository.delete(id);
    this.logger.log(`Deleted product ${id} (${existing.name})`);
    return { deleted: true };
  }

  // ---- product contents (the bundle) --------------------------------------

  @Post(':id/contents')
  @HttpCode(HttpStatus.CREATED)
  async addContent(
    @Param('id') productId: string,
    @Body() input: AddProductContentInput,
  ) {
    if (
      !['tutorial', 'groove', 'video', 'exercise'].includes(input.contentType)
    ) {
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

    // Bundling content into a pack gates it: flip the source row to the
    // 'product' tier + point it at this product, so the entitlement resolver
    // locks it for non-owners. One admin action does the whole gating.
    await this.gateContentToProduct(
      input.contentType,
      input.contentId,
      productId,
    );

    return { content };
  }

  /** Set a content item's access_tier='product' + product_id (the table varies
   *  by content type). No-op for unknown types. */
  private async gateContentToProduct(
    contentType: AddProductContentInput['contentType'],
    contentId: string,
    productId: string,
  ): Promise<void> {
    const table =
      contentType === 'tutorial'
        ? 'tutorials'
        : contentType === 'groove'
          ? 'groove_library'
          : contentType === 'video'
            ? 'videos'
            : null; // exercises have no access_tier column (yet)
    if (!table) return;

    const { error } = await this.supabaseService
      .getClient()
      .from(table)
      .update({ access_tier: 'product', product_id: productId })
      .eq('id', contentId);
    if (error) {
      this.logger.warn(
        `Failed to gate ${contentType} ${contentId}: ${error.message}`,
      );
    }
  }

  @Delete('contents/:contentRowId')
  @HttpCode(HttpStatus.OK)
  async removeContent(@Param('contentRowId') contentRowId: string) {
    // Look up the row first so we can un-gate the content after removing it.
    const row = await this.productContentsRepository.findById(contentRowId);
    await this.productContentsRepository.remove(contentRowId);

    // If this content isn't bundled in ANY other product, return it to 'free'
    // so it isn't left orphaned at 'product' tier (inaccessible to everyone).
    if (row) {
      const stillBundled = await this.productContentsRepository.findByContent(
        row.contentType,
        row.contentId,
      );
      if (stillBundled.length === 0) {
        await this.ungateContent(row.contentType, row.contentId);
      }
    }
    return { removed: true };
  }

  /** Reset a content item back to the 'free' tier (clears product_id). */
  private async ungateContent(
    contentType: AddProductContentInput['contentType'],
    contentId: string,
  ): Promise<void> {
    const table =
      contentType === 'tutorial'
        ? 'tutorials'
        : contentType === 'groove'
          ? 'groove_library'
          : contentType === 'video'
            ? 'videos'
            : null;
    if (!table) return;
    const { error } = await this.supabaseService
      .getClient()
      .from(table)
      .update({ access_tier: 'free', product_id: null })
      .eq('id', contentId);
    if (error) {
      this.logger.warn(
        `Failed to un-gate ${contentType} ${contentId}: ${error.message}`,
      );
    }
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
    const validMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
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

    await this.productRepository.update(productId, {
      coverImageUrl: publicUrl,
    });
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
