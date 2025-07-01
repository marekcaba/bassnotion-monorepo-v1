import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import {
  SavedBasslineSchema,
  SaveBasslineRequestSchema,
  AutoSaveRequestSchema,
  RenameBasslineRequestSchema,
  DuplicateBasslineRequestSchema,
  BasslineListFiltersSchema,
  type SavedBasslineInput,
  type SavedBasslinesResponseInput,
  type SaveBasslineResponseInput,
  type AutoSaveResponseInput,
} from '@bassnotion/contracts';

@Injectable()
export class UserBasslinesService {
  private readonly logger = new Logger(UserBasslinesService.name);

  constructor(private readonly supabaseService: SupabaseService) {
    this.logger.debug('🔧 UserBasslinesService constructor called');
  }

  /**
   * Save a bassline with full metadata support
   */
  async saveBassline(
    userId: string,
    requestData: unknown,
  ): Promise<SaveBasslineResponseInput> {
    try {
      this.logger.debug(`Saving bassline for user: ${userId}`);

      // Validate input data
      const validatedData = SaveBasslineRequestSchema.parse(requestData);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Check for name conflicts if not overwriting
      if (!validatedData.overwriteExisting) {
        const { data: existing } = await supabase
          .from('custom_basslines')
          .select('id')
          .eq('user_id', userId)
          .eq('name', validatedData.name)
          .is('deleted_at', null)
          .single();

        if (existing) {
          throw new ConflictException(
            `A bassline with the name "${validatedData.name}" already exists`,
          );
        }
      }

      // Prepare bassline data
      const basslineData = {
        user_id: userId,
        name: validatedData.name,
        description: validatedData.description,
        notes: validatedData.notes,
        metadata: validatedData.metadata,
        version: 1,
      };

      let result;

      if (validatedData.overwriteExisting) {
        // Update existing bassline
        const { data, error } = await supabase
          .from('custom_basslines')
          .update({
            description: basslineData.description,
            notes: basslineData.notes,
            metadata: basslineData.metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('name', validatedData.name)
          .is('deleted_at', null)
          .select()
          .single();

        if (error) {
          this.logger.error('Error updating bassline:', error);
          throw new InternalServerErrorException('Failed to update bassline');
        }

        result = data;
      } else {
        // Create new bassline
        const { data, error } = await supabase
          .from('custom_basslines')
          .insert(basslineData)
          .select()
          .single();

        if (error) {
          this.logger.error('Error creating bassline:', error);
          throw new InternalServerErrorException('Failed to create bassline');
        }

        result = data;
      }

      // Transform to response format
      const savedBassline = this.transformToBassline(result);

      this.logger.debug(`Successfully saved bassline: ${savedBassline.id}`);

      return {
        bassline: savedBassline,
        message: validatedData.overwriteExisting
          ? 'Bassline updated successfully'
          : 'Bassline saved successfully',
      };
    } catch (error) {
      this.logger.error(`Error saving bassline for user ${userId}:`, error);
      if (
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to save bassline');
    }
  }

  /**
   * Auto-save functionality for work-in-progress basslines
   */
  async autoSave(
    userId: string,
    requestData: unknown,
  ): Promise<AutoSaveResponseInput> {
    try {
      this.logger.debug(`Auto-saving bassline for user: ${userId}`);

      // Validate input data
      const validatedData = AutoSaveRequestSchema.parse(requestData);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Use database function for auto-save
      const { data, error } = await supabase.rpc('auto_save_bassline', {
        p_user_id: userId,
        p_name: validatedData.name,
        p_notes: validatedData.notes,
        p_bassline_id: validatedData.basslineId || null,
        p_metadata: validatedData.metadata,
      });

      if (error) {
        this.logger.error('Error in auto-save:', error);
        throw new InternalServerErrorException('Auto-save failed');
      }

      const basslineId = data as string;
      const now = new Date().toISOString();

      this.logger.debug(`Auto-saved bassline: ${basslineId}`);

      return {
        basslineId,
        lastSaved: now,
        message: 'Auto-save completed',
      };
    } catch (error) {
      this.logger.error(`Error in auto-save for user ${userId}:`, error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Auto-save failed');
    }
  }

  /**
   * Get user's saved basslines with filtering and pagination
   */
  async getUserBasslines(
    userId: string,
    filters: unknown = {},
  ): Promise<SavedBasslinesResponseInput> {
    try {
      this.logger.debug(`Fetching basslines for user: ${userId}`);

      // Validate filters
      const validatedFilters = BasslineListFiltersSchema.parse(filters);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        throw new InternalServerErrorException('Database service unavailable');
      }

      let query = supabase
        .from('custom_basslines')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .is('deleted_at', null);

      // Apply filters
      if (validatedFilters.search) {
        query = query.ilike('name', `%${validatedFilters.search}%`);
      }

      if (validatedFilters.difficulty) {
        query = query.eq('metadata->>difficulty', validatedFilters.difficulty);
      }

      if (validatedFilters.tags && validatedFilters.tags.length > 0) {
        query = query.contains('metadata->tags', validatedFilters.tags);
      }

      // Apply sorting
      const sortColumn =
        validatedFilters.sortBy === 'name' ? 'name' : validatedFilters.sortBy;
      query = query.order(sortColumn, {
        ascending: validatedFilters.sortOrder === 'asc',
      });

      // Apply pagination
      const offset = (validatedFilters.page - 1) * validatedFilters.limit;
      query = query.range(offset, offset + validatedFilters.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('Error fetching basslines:', error);
        throw new InternalServerErrorException('Failed to fetch basslines');
      }

      // Transform results
      const basslines = (data || []).map((item) =>
        this.transformToBassline(item),
      );

      this.logger.debug(
        `Found ${basslines.length} basslines (total: ${count})`,
      );

      return {
        basslines,
        total: count || 0,
        page: validatedFilters.page,
        limit: validatedFilters.limit,
      };
    } catch (error) {
      this.logger.error(`Error fetching basslines for user ${userId}:`, error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch basslines');
    }
  }

  /**
   * Get a specific bassline by ID
   */
  async getBasslineById(
    userId: string,
    basslineId: string,
  ): Promise<SavedBasslineInput> {
    try {
      this.logger.debug(`Fetching bassline ${basslineId} for user: ${userId}`);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        throw new InternalServerErrorException('Database service unavailable');
      }

      const { data, error } = await supabase
        .from('custom_basslines')
        .select('*')
        .eq('id', basslineId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundException('Bassline not found');
        }
        this.logger.error('Error fetching bassline:', error);
        throw new InternalServerErrorException('Failed to fetch bassline');
      }

      return this.transformToBassline(data);
    } catch (error) {
      this.logger.error(`Error fetching bassline ${basslineId}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch bassline');
    }
  }

  /**
   * Rename a bassline
   */
  async renameBassline(
    userId: string,
    basslineId: string,
    requestData: unknown,
  ): Promise<SavedBasslineInput> {
    try {
      const validatedData = RenameBasslineRequestSchema.parse(requestData);

      this.logger.debug(
        `Renaming bassline ${basslineId} to: ${validatedData.newName}`,
      );

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Check for name conflicts
      const { data: existing } = await supabase
        .from('custom_basslines')
        .select('id')
        .eq('user_id', userId)
        .eq('name', validatedData.newName)
        .neq('id', basslineId)
        .is('deleted_at', null)
        .single();

      if (existing) {
        throw new ConflictException(
          `A bassline with the name "${validatedData.newName}" already exists`,
        );
      }

      const { data, error } = await supabase
        .from('custom_basslines')
        .update({ name: validatedData.newName })
        .eq('id', basslineId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        this.logger.error('Error renaming bassline:', error);
        throw new InternalServerErrorException('Failed to rename bassline');
      }

      if (!data) {
        throw new NotFoundException('Bassline not found');
      }

      return this.transformToBassline(data);
    } catch (error) {
      this.logger.error(`Error renaming bassline ${basslineId}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to rename bassline');
    }
  }

  /**
   * Duplicate a bassline
   */
  async duplicateBassline(
    userId: string,
    basslineId: string,
    requestData: unknown,
  ): Promise<SavedBasslineInput> {
    try {
      const validatedData = DuplicateBasslineRequestSchema.parse(requestData);

      this.logger.debug(
        `Duplicating bassline ${basslineId} as: ${validatedData.newName}`,
      );

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Use database function for duplication
      const { data, error } = await supabase.rpc('duplicate_bassline', {
        p_user_id: userId,
        p_bassline_id: basslineId,
        p_new_name: validatedData.newName,
        p_include_description: validatedData.includeDescription,
      });

      if (error) {
        this.logger.error('Error duplicating bassline:', error);
        throw new InternalServerErrorException('Failed to duplicate bassline');
      }

      const newBasslineId = data as string;

      // Fetch the newly created bassline
      return this.getBasslineById(userId, newBasslineId);
    } catch (error) {
      this.logger.error(`Error duplicating bassline ${basslineId}:`, error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to duplicate bassline');
    }
  }

  /**
   * Delete a bassline (soft delete)
   */
  async deleteBassline(userId: string, basslineId: string): Promise<void> {
    try {
      this.logger.debug(`Deleting bassline ${basslineId} for user: ${userId}`);

      const supabase = this.supabaseService.getClient();

      if (!this.supabaseService.isReady()) {
        throw new InternalServerErrorException('Database service unavailable');
      }

      // Use database function for soft delete
      const { data, error } = await supabase.rpc('soft_delete_bassline', {
        p_user_id: userId,
        p_bassline_id: basslineId,
      });

      if (error) {
        this.logger.error('Error deleting bassline:', error);
        throw new InternalServerErrorException('Failed to delete bassline');
      }

      if (!data) {
        throw new NotFoundException('Bassline not found');
      }

      this.logger.debug(`Successfully deleted bassline: ${basslineId}`);
    } catch (error) {
      this.logger.error(`Error deleting bassline ${basslineId}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete bassline');
    }
  }

  /**
   * Transform database row to SavedBassline interface
   */
  private transformToBassline(data: any): SavedBasslineInput {
    try {
      return SavedBasslineSchema.parse({
        id: data.id,
        userId: data.user_id,
        name: data.name,
        description: data.description,
        notes: data.notes,
        metadata: data.metadata,
        version: data.version,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
    } catch (validationError) {
      this.logger.warn(
        `Bassline ${data.id} failed validation:`,
        validationError,
      );
      // Return as-is for backward compatibility
      return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        description: data.description,
        notes: data.notes || [],
        metadata: data.metadata || {},
        version: data.version || 1,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }
  }
}
