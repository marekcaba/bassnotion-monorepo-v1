import { beforeEach, describe, expect, it } from 'vitest';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseService } from './infrastructure/database/database.service.js';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;
  let databaseService: DatabaseService;

  beforeEach(() => {
    appService = new AppService();

    // Mock DatabaseService
    databaseService = {
      isReady: () => true,
    } as DatabaseService;

    appController = new AppController(appService, databaseService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('ok');
      expect(result.message).toBe('BassNotion Backend is running');
      expect(result.database).toBe('connected');
      expect(result.timestamp).toBeDefined();
    });
  });
});
