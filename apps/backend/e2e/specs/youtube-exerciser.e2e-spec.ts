import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeAll, beforeEach, afterAll, it, expect } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { TokenService } from '../../src/domains/learning/services/token.service.js';
import { AuthUser } from '../../src/domains/user/auth/types/index.js';
import { testDb } from '../database.js';
import { UserFactory } from '../factories/user.factory.js';

describe('YouTube Exerciser Widget (e2e)', () => {
  let app: NestFastifyApplication;
  let userFactory: UserFactory;
  let tokenService: TokenService;
  let testUser: AuthUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    userFactory = new UserFactory(testDb.getClient());
    tokenService = app.get(TokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create a test user with tokens
    testUser = await userFactory.create({
      email: 'test.user@example.com',
      password: 'TestPass123!',
      isConfirmed: true,
    });
  });

  describe('POST /api/widgets/youtube-exerciser/analyze', () => {
    const validYouTubeUrl = 'https://www.youtube.com/watch?v=validVideoId';
    const invalidYouTubeUrl = 'https://invalid-url.com';

    it('should analyze a valid YouTube URL and return exercises', async () => {
      // Verify user has tokens
      const tokenBalance = await tokenService.getTokenBalance(testUser.id);
      expect(tokenBalance.available).toBeGreaterThan(0);

      // Make the analysis request
      const response = await app.inject({
        method: 'POST',
        url: '/api/widgets/youtube-exerciser/analyze',
        headers: {
          Authorization: `Bearer ${testUser.id}`,
        },
        payload: {
          youtubeUrl: validYouTubeUrl,
        },
      });

      expect(response.statusCode).toBe(200);

      const result = JSON.parse(response.payload);
      expect(result).toMatchObject({
        success: true,
        videoId: expect.any(String),
        exercises: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            title: expect.any(String),
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            difficulty: expect.any(String),
            type: expect.any(String),
          }),
        ]),
        summary: expect.any(String),
        skillLevel: expect.any(String),
        genre: expect.any(String),
      });

      // Verify token was consumed
      const updatedBalance = await tokenService.getTokenBalance(testUser.id);
      expect(updatedBalance.available).toBe(tokenBalance.available - 1);
      expect(updatedBalance.consumed).toBe(tokenBalance.consumed + 1);
    });

    it('should return error for invalid YouTube URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/widgets/youtube-exerciser/analyze',
        headers: {
          Authorization: `Bearer ${testUser.id}`,
        },
        payload: {
          youtubeUrl: invalidYouTubeUrl,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.payload)).toMatchObject({
        success: false,
        error: 'Invalid YouTube URL',
      });

      // Verify no token was consumed
      const tokenBalance = await tokenService.getTokenBalance(testUser.id);
      expect(tokenBalance.available).toBe(5); // Initial free tokens
    });

    it('should return error when user has no tokens', async () => {
      // Consume all tokens
      await tokenService.consumeAllTokens(testUser.id);

      const response = await app.inject({
        method: 'POST',
        url: '/api/widgets/youtube-exerciser/analyze',
        headers: {
          Authorization: `Bearer ${testUser.id}`,
        },
        payload: {
          youtubeUrl: validYouTubeUrl,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload)).toMatchObject({
        success: false,
        error: 'No generation tokens available',
      });
    });

    it('should return cached results for previously analyzed videos', async () => {
      // First analysis
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/api/widgets/youtube-exerciser/analyze',
        headers: {
          Authorization: `Bearer ${testUser.id}`,
        },
        payload: {
          youtubeUrl: validYouTubeUrl,
        },
      });

      const firstResult = JSON.parse(firstResponse.payload);
      expect(firstResult.fromCache).toBe(false);

      const tokenBalanceAfterFirst = await tokenService.getTokenBalance(
        testUser.id,
      );

      // Second analysis of same video
      const secondResponse = await app.inject({
        method: 'POST',
        url: '/api/widgets/youtube-exerciser/analyze',
        headers: {
          Authorization: `Bearer ${testUser.id}`,
        },
        payload: {
          youtubeUrl: validYouTubeUrl,
        },
      });

      const secondResult = JSON.parse(secondResponse.payload);
      expect(secondResult.fromCache).toBe(true);

      // Verify no additional token was consumed
      const tokenBalanceAfterSecond = await tokenService.getTokenBalance(
        testUser.id,
      );
      expect(tokenBalanceAfterSecond).toEqual(tokenBalanceAfterFirst);
    });
  });

  describe('GET /api/widgets/youtube-exerciser/exercises/:videoId', () => {
    it('should return exercises for a specific video', async () => {
      // First analyze a video
      await app.inject({
        method: 'POST',
        url: '/api/widgets/youtube-exerciser/analyze',
        headers: {
          Authorization: `Bearer ${testUser.id}`,
        },
        payload: {
          youtubeUrl: 'https://www.youtube.com/watch?v=validVideoId',
        },
      });

      // Then fetch exercises for that video
      const response = await app.inject({
        method: 'GET',
        url: '/api/widgets/youtube-exerciser/exercises/validVideoId',
        headers: {
          Authorization: `Bearer ${testUser.id}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toMatchObject({
        exercises: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            title: expect.any(String),
            startTime: expect.any(Number),
            endTime: expect.any(Number),
          }),
        ]),
      });
    });

    it('should return 404 for non-existent video', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/widgets/youtube-exerciser/exercises/nonexistentVideoId',
        headers: {
          Authorization: `Bearer ${testUser.id}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toMatchObject({
        success: false,
        error: 'Video analysis not found',
      });
    });
  });

  describe('POST /api/widgets/youtube-exerciser/exercises/:exerciseId/progress', () => {
    it('should track user progress for an exercise', async () => {
      // First analyze a video and get an exercise ID
      const analysisResponse = await app.inject({
        method: 'POST',
        url: '/api/widgets/youtube-exerciser/analyze',
        headers: {
          Authorization: `Bearer ${testUser.id}`,
        },
        payload: {
          youtubeUrl: 'https://www.youtube.com/watch?v=validVideoId',
        },
      });

      const { exercises } = JSON.parse(analysisResponse.payload);
      const exerciseId = exercises[0].id;

      // Track progress for the exercise
      const response = await app.inject({
        method: 'POST',
        url: `/api/widgets/youtube-exerciser/exercises/${exerciseId}/progress`,
        headers: {
          Authorization: `Bearer ${testUser.id}`,
        },
        payload: {
          status: 'completed',
          rating: 4,
          notes: 'Great exercise for technique',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toMatchObject({
        success: true,
        progress: expect.objectContaining({
          exerciseId,
          userId: testUser.id,
          status: 'completed',
          rating: 4,
          notes: 'Great exercise for technique',
          completedAt: expect.any(String),
        }),
      });
    });
  });
});
