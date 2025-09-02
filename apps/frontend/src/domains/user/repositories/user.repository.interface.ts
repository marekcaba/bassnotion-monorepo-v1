import { User } from '../entities/user.entity';
import { Email } from '../value-objects/email.vo';
import { UserId } from '../value-objects/user-id.vo';
import { UserRole } from '../value-objects/user-role.vo';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IUserRepository {
  // Read operations
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<User>>;
  findByRole(role: UserRole): Promise<User[]>;
  search(query: string): Promise<User[]>;
  getCurrentUser(): Promise<User | null>;
  
  // Write operations
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  
  // Validation operations
  exists(id: UserId): Promise<boolean>;
  existsByEmail(email: Email): Promise<boolean>;
  
  // Batch operations
  findByIds(ids: UserId[]): Promise<User[]>;
  saveMany(users: User[]): Promise<void>;
  updateMany(users: User[]): Promise<void>;
  deleteMany(ids: UserId[]): Promise<void>;
  
  // Frontend-specific operations
  refreshCurrentUser(): Promise<User | null>;
  logout(): Promise<void>;
}