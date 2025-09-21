// Repository interfaces
export type {
  IUserRepository,
  PaginationOptions,
  PaginatedResult,
} from './user.repository.interface';

// Repository implementations
export { UserRepository } from './user.repository';
export { CachedUserRepository } from './cached-user.repository';
export { ResultUserRepository } from './result-user.repository';

// Entities
export { User } from '../entities/user.entity';

// Value Objects
export { UserId } from '../value-objects/user-id.vo';
export { Email } from '../value-objects/email.vo';
export { UserRole, type UserRoleType } from '../value-objects/user-role.vo';

// Store integration
export {
  useUserRepositoryStore,
  useCurrentUser,
  useUserRepository,
  useUserLoading,
  useUserError,
} from '../stores/user.repository.store';

// Factory function for creating the repository stack
import { IUserRepository } from './user.repository.interface';
import { UserRepository } from './user.repository';
import { CachedUserRepository } from './cached-user.repository';
import { ResultUserRepository } from './result-user.repository';

export function createUserRepository(): IUserRepository {
  const baseRepository = new UserRepository();
  const cachedRepository = new CachedUserRepository(baseRepository);
  const resultRepository = new ResultUserRepository(cachedRepository);
  return resultRepository;
}
