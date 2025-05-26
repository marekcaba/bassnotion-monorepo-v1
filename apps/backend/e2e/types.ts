/// <reference types="vitest" />

import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { TestingModule } from '@nestjs/testing';

export interface TestContext {
  app: NestFastifyApplication;
  moduleFixture: TestingModule;
}

export interface TestRequest {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __TEST_CONTEXT__: TestContext;
}
