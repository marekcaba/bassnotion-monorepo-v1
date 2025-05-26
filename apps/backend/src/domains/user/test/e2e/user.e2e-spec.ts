import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest';

import { AppModule } from '../../../../app.module.js';
import { User } from '../../entities/user.entity.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { Email } from '../../value-objects/email.vo.js';
import { UserId } from '../../value-objects/user-id.vo.js';

describe('User E2E Tests', () => {
  let app: NestFastifyApplication;
  let userRepository: UserRepository;
  let testUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    userRepository = moduleFixture.get<UserRepository>(UserRepository);
  });

  beforeEach(async () => {
    // Create test user
    testUser = User.create(
      UserId.create('test-user-id'),
      Email.create('test@example.com'),
      'Test User',
    );
    await userRepository.save(testUser);
  });

  afterEach(async () => {
    // Clean up test user
    await userRepository.delete(UserId.create(testUser.id));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users/:id', () => {
    it('should return user by id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/users/${testUser.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toBeDefined();
      expect(body.id).toBe(testUser.id);
      expect(body.email).toBe(testUser.email);
      expect(body.displayName).toBe(testUser.displayName);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user profile', async () => {
      const updateData = {
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/users/${testUser.id}`,
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.displayName).toBe(updateData.displayName);
      expect(body.avatarUrl).toBe(updateData.avatarUrl);

      // Verify in database
      const updated = await userRepository.findById(UserId.create(testUser.id));
      if (!updated) {
        throw new Error('Updated user not found');
      }
      expect(updated.displayName).toBe(updateData.displayName);
      expect(updated.avatarUrl).toBe(updateData.avatarUrl);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/users/non-existent-id',
        payload: { displayName: 'Test' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/users/${testUser.id}`,
      });

      expect(response.statusCode).toBe(204);

      // Verify user is deleted
      const deleted = await userRepository.findById(UserId.create(testUser.id));
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/users/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
