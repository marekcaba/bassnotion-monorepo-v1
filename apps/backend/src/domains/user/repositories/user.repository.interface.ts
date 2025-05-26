import { User } from '../entities/user.entity.js';
import { Email } from '../value-objects/email.vo.js';
import { UserId } from '../value-objects/user-id.vo.js';

export interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  exists(id: UserId): Promise<boolean>;
  existsByEmail(email: Email): Promise<boolean>;
}
