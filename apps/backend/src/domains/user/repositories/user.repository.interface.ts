import { User } from '../entities/user.entity.js';
import { Email } from '../value-objects/email.vo.js';
import { UserId } from '../value-objects/user-id.vo.js';
import { UserRole } from '../value-objects/user-role.vo.js';

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
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<User>>;
  findByRole(role: UserRole): Promise<User[]>;
  search(query: string): Promise<User[]>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  exists(id: UserId): Promise<boolean>;
  existsByEmail(email: Email): Promise<boolean>;
  findByIds(ids: UserId[]): Promise<User[]>;

  // Batch operations
  saveMany(users: User[]): Promise<void>;
  updateMany(users: User[]): Promise<void>;
  deleteMany(ids: UserId[]): Promise<void>;
}
