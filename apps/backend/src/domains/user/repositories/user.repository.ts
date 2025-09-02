import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  IUserRepository,
  PaginatedResult,
  PaginationOptions } from './user.repository.interface.js';
import { User } from '../entities/user.entity.js';
import { Email } from '../value-objects/email.vo.js';
import { UserId } from '../value-objects/user-id.vo.js';
import { UserRole } from '../value-objects/user-role.vo.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  role: string;
  avatar_url?: string;
  last_login_at?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class UserRepository implements IUserRepository {
  private readonly staticLogger = createStructuredLogger(UserRepository.name);

  constructor(
    private readonly supabase: SupabaseClient,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async findById(id: UserId): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id.value)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data as UserRecord);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email.value)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data as UserRecord);
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<User>> {
    try {
      const offset = (options.page - 1) * options.limit;

      const { data, error, count } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + options.limit - 1);

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      const users = (data || []).map((record) =>
        this.mapToEntity(record as UserRecord),
      );

      return {
        items: users,
        total: count || 0,
        page: options.page,
        limit: options.limit };
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching all users:', error as Error, { correlationId });
      throw error;
    }
  }

  async findByRole(role: UserRole): Promise<User[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('role', role.value)
        .order('display_name', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch users by role: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as UserRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error fetching users by role ${role.value}:`, error as Error, { correlationId });
      throw error;
    }
  }

  async search(query: string): Promise<User[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
        .order('display_name', { ascending: true });

      if (error) {
        throw new Error(`Failed to search users: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as UserRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error searching users with query "${query}":`, error as Error, { correlationId });
      throw error;
    }
  }

  async save(user: User): Promise<void> {
    try {
      const data = user.toPersistence();
      const { error } = await this.supabase.from('users').insert({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString() });

      if (error) {
        throw new Error(`Failed to save user: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully saved user: ${user.id}`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error saving user:', error as Error, { correlationId });
      throw error;
    }
  }

  async update(user: User): Promise<void> {
    try {
      const data = user.toPersistence();
      const { error } = await this.supabase
        .from('users')
        .update({
          ...data,
          updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        throw new Error(`Failed to update user: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully updated user: ${user.id}`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error updating user ${user.id}:`, error as Error, { correlationId });
      throw error;
    }
  }

  async delete(id: UserId): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .delete()
      .eq('id', id.value);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  async exists(id: UserId): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('id', id.value);

    if (error) {
      throw new Error(`Failed to check user existence: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.value);

    if (error) {
      throw new Error(`Failed to check user existence: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  async findByIds(ids: UserId[]): Promise<User[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      const idValues = ids.map((id) => id.value);
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .in('id', idValues);

      if (error) {
        throw new Error(`Failed to fetch users by ids: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as UserRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching users by ids:', error as Error, { correlationId });
      throw error;
    }
  }

  async saveMany(users: User[]): Promise<void> {
    if (users.length === 0) return;

    try {
      const data = users.map((user) => ({
        ...user.toPersistence(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString() }));

      const { error } = await this.supabase.from('users').insert(data);

      if (error) {
        throw new Error(`Failed to save users batch: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully saved ${users.length} users in batch`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error saving users batch:', error as Error, { correlationId });
      throw error;
    }
  }

  async updateMany(users: User[]): Promise<void> {
    if (users.length === 0) return;

    try {
      // Supabase doesn't support bulk updates natively, so we use a transaction-like approach
      const updates = users.map((user) =>
        this.supabase
          .from('users')
          .update({
            ...user.toPersistence(),
            updated_at: new Date().toISOString() })
          .eq('id', user.id),
      );

      const results = await Promise.all(updates);

      const errors = results.filter((result) => result.error);
      if (errors.length > 0) {
        throw new Error(
          `Failed to update users batch: ${errors.map((e) => e.error?.message).join(', ')}`,
        );
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully updated ${users.length} users in batch`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error updating users batch:', error as Error, { correlationId });
      throw error;
    }
  }

  async deleteMany(ids: UserId[]): Promise<void> {
    if (ids.length === 0) return;

    try {
      const idValues = ids.map((id) => id.value);
      const { error } = await this.supabase
        .from('users')
        .delete()
        .in('id', idValues);

      if (error) {
        throw new Error(`Failed to delete users batch: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully deleted ${ids.length} users in batch`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error deleting users batch:', error as Error, { correlationId });
      throw error;
    }
  }

  private mapToEntity(data: UserRecord): User {
    return User.reconstitute(
      UserId.create(data.id),
      Email.create(data.email),
      UserRole.create(data.role),
      data.display_name,
      data.avatar_url,
      data.last_login_at ? new Date(data.last_login_at) : undefined,
    );
  }
}
