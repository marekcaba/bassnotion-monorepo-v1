import { apiClient } from '@/shared/api/client';
import { supabase } from '@/infrastructure/supabase/client';
import { 
  IUserRepository, 
  PaginatedResult, 
  PaginationOptions 
} from './user.repository.interface';
import { User } from '../entities/user.entity';
import { Email } from '../value-objects/email.vo';
import { UserId } from '../value-objects/user-id.vo';
import { UserRole } from '../value-objects/user-role.vo';
import { createStructuredLogger } from '@bassnotion/contracts';

interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatarUrl?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class UserRepository implements IUserRepository {
  private readonly logger = createStructuredLogger('UserRepository');

  async findById(id: UserId): Promise<User | null> {
    try {
      const response = await apiClient.get<UserDTO>(`/api/users/${id.value}`);
      return this.mapToEntity(response);
    } catch (error) {
      this.logger.error('Failed to find user by id', error as Error);
      return null;
    }
  }

  async findByEmail(email: Email): Promise<User | null> {
    try {
      const response = await apiClient.get<UserDTO>(`/api/users/by-email/${email.value}`);
      return this.mapToEntity(response);
    } catch (error) {
      this.logger.error('Failed to find user by email', error as Error);
      return null;
    }
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<User>> {
    try {
      const response = await apiClient.get<{
        items: UserDTO[];
        total: number;
        page: number;
        limit: number;
      }>('/api/users', {
        headers: {
          'x-page': options.page.toString(),
          'x-limit': options.limit.toString(),
        },
      });

      return {
        items: response.items.map(dto => this.mapToEntity(dto)),
        total: response.total,
        page: response.page,
        limit: response.limit,
      };
    } catch (error) {
      this.logger.error('Failed to fetch all users', error as Error);
      throw error;
    }
  }

  async findByRole(role: UserRole): Promise<User[]> {
    try {
      const response = await apiClient.get<UserDTO[]>(`/api/users/by-role/${role.value}`);
      return response.map(dto => this.mapToEntity(dto));
    } catch (error) {
      this.logger.error('Failed to find users by role', error as Error);
      return [];
    }
  }

  async search(query: string): Promise<User[]> {
    try {
      const response = await apiClient.get<UserDTO[]>('/api/users/search', {
        headers: { 'x-query': query },
      });
      return response.map(dto => this.mapToEntity(dto));
    } catch (error) {
      this.logger.error('Failed to search users', error as Error);
      return [];
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      // First check Supabase auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;

      // Then fetch full user profile from API
      const response = await apiClient.get<UserDTO>('/api/users/me');
      return this.mapToEntity(response);
    } catch (error) {
      this.logger.error('Failed to get current user', error as Error);
      return null;
    }
  }

  async save(user: User): Promise<void> {
    try {
      await apiClient.post('/api/users', user.toJSON());
    } catch (error) {
      this.logger.error('Failed to save user', error as Error);
      throw error;
    }
  }

  async update(user: User): Promise<void> {
    try {
      await apiClient.put(`/api/users/${user.id}`, user.toJSON());
    } catch (error) {
      this.logger.error('Failed to update user', error as Error);
      throw error;
    }
  }

  async delete(id: UserId): Promise<void> {
    try {
      await apiClient.delete(`/api/users/${id.value}`);
    } catch (error) {
      this.logger.error('Failed to delete user', error as Error);
      throw error;
    }
  }

  async exists(id: UserId): Promise<boolean> {
    try {
      await apiClient.get(`/api/users/${id.value}/exists`);
      return true;
    } catch {
      return false;
    }
  }

  async existsByEmail(email: Email): Promise<boolean> {
    try {
      await apiClient.get(`/api/users/by-email/${email.value}/exists`);
      return true;
    } catch {
      return false;
    }
  }

  async findByIds(ids: UserId[]): Promise<User[]> {
    try {
      const response = await apiClient.post<UserDTO[]>('/api/users/batch', {
        ids: ids.map(id => id.value),
      });
      return response.map(dto => this.mapToEntity(dto));
    } catch (error) {
      this.logger.error('Failed to find users by ids', error as Error);
      return [];
    }
  }

  async saveMany(users: User[]): Promise<void> {
    try {
      await apiClient.post('/api/users/batch', {
        users: users.map(user => user.toJSON()),
      });
    } catch (error) {
      this.logger.error('Failed to save many users', error as Error);
      throw error;
    }
  }

  async updateMany(users: User[]): Promise<void> {
    try {
      await apiClient.put('/api/users/batch', {
        users: users.map(user => user.toJSON()),
      });
    } catch (error) {
      this.logger.error('Failed to update many users', error as Error);
      throw error;
    }
  }

  async deleteMany(ids: UserId[]): Promise<void> {
    try {
      await apiClient.delete('/api/users/batch', {
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: ids.map(id => id.value),
        }),
      });
    } catch (error) {
      this.logger.error('Failed to delete many users', error as Error);
      throw error;
    }
  }

  async refreshCurrentUser(): Promise<User | null> {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;

      // Force refresh from API
      const response = await apiClient.get<UserDTO>('/api/users/me', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      return this.mapToEntity(response);
    } catch (error) {
      this.logger.error('Failed to refresh current user', error as Error);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      this.logger.error('Failed to logout', error as Error);
      throw error;
    }
  }

  // Private helper methods
  private mapToEntity(dto: UserDTO): User {
    return User.reconstitute(
      UserId.create(dto.id),
      Email.create(dto.email),
      UserRole.create(dto.role),
      dto.displayName,
      dto.avatarUrl,
      dto.lastLoginAt ? new Date(dto.lastLoginAt) : undefined,
    );
  }
}