import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { User } from '../../../entities/user.entity.js';
import { UserRepository } from '../../../repositories/user.repository.js';
import { Email } from '../../../value-objects/email.vo.js';
import { UserId } from '../../../value-objects/user-id.vo.js';

describe('UserRepository Integration Tests', () => {
  let supabase: SupabaseClient;
  let repository: UserRepository;
  let testUser: User;

  beforeEach(async () => {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase client with test credentials
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    repository = new UserRepository(supabase);

    // Create test user
    testUser = User.create(
      UserId.create('test-user-id'),
      Email.create('test@example.com'),
      'Test User',
    );

    // Clean up any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  async function cleanupTestData() {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('email', 'test@example.com');

    if (error) {
      console.error('Error cleaning up test data:', error);
    }
  }

  describe('save', () => {
    it('should save a new user', async () => {
      await repository.save(testUser);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', testUser.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (!data) {
        throw new Error('User data not found');
      }
      expect(data.email).toBe(testUser.email);
      expect(data.display_name).toBe(testUser.displayName);
    });

    it('should update an existing user', async () => {
      await repository.save(testUser);

      const updatedDisplayName = 'Updated Test User';
      testUser.updateProfile(updatedDisplayName);
      await repository.save(testUser);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', testUser.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (!data) {
        throw new Error('User data not found');
      }
      expect(data.display_name).toBe(updatedDisplayName);
    });
  });

  describe('findById', () => {
    it('should find a user by id', async () => {
      await repository.save(testUser);

      const found = await repository.findById(UserId.create(testUser.id));

      expect(found).toBeDefined();
      if (!found) {
        throw new Error('User not found');
      }
      expect(found.id).toBe(testUser.id);
      expect(found.email).toBe(testUser.email);
    });

    it('should return null for non-existent user', async () => {
      const found = await repository.findById(UserId.create('non-existent-id'));
      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      await repository.save(testUser);

      const found = await repository.findByEmail(Email.create(testUser.email));

      expect(found).toBeDefined();
      if (!found) {
        throw new Error('User not found');
      }
      expect(found.id).toBe(testUser.id);
      expect(found.email).toBe(testUser.email);
    });

    it('should return null for non-existent email', async () => {
      const found = await repository.findByEmail(
        Email.create('nonexistent@example.com'),
      );
      expect(found).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      await repository.save(testUser);
      await repository.delete(UserId.create(testUser.id));

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', testUser.id)
        .single();

      expect(data).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing user id', async () => {
      await repository.save(testUser);
      const exists = await repository.exists(UserId.create(testUser.id));
      expect(exists).toBe(true);
    });

    it('should return false for non-existent user id', async () => {
      const exists = await repository.exists(UserId.create('non-existent-id'));
      expect(exists).toBe(false);
    });
  });

  describe('existsByEmail', () => {
    it('should return true for existing email', async () => {
      await repository.save(testUser);
      const exists = await repository.existsByEmail(
        Email.create(testUser.email),
      );
      expect(exists).toBe(true);
    });

    it('should return false for non-existent email', async () => {
      const exists = await repository.existsByEmail(
        Email.create('nonexistent@example.com'),
      );
      expect(exists).toBe(false);
    });
  });
});
