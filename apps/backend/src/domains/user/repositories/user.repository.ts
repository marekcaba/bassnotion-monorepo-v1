import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { IUserRepository } from './user.repository.interface.js';
import { User } from '../entities/user.entity.js';
import { Email } from '../value-objects/email.vo.js';
import { UserId } from '../value-objects/user-id.vo.js';
import { UserRole } from '../value-objects/user-role.vo.js';

interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  role: string;
  avatar_url?: string;
  last_login_at?: string;
}

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly supabase: SupabaseClient) {}

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

  async save(user: User): Promise<void> {
    const { error } = await this.supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      role: user.role,
      avatar_url: user.avatarUrl,
      last_login_at: user.lastLoginAt,
    });

    if (error) {
      throw new Error(`Failed to save user: ${error.message}`);
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

  private mapToEntity(data: UserRecord): User {
    return User.create(
      UserId.create(data.id),
      Email.create(data.email),
      data.display_name,
      UserRole.create(data.role),
      data.avatar_url,
    );
  }
}
