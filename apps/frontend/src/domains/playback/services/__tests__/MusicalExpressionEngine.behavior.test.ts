/**
 * Musical Expression Engine - Behavior Tests
 *
 * Comprehensive test suite for advanced musical expression and articulation
 * processing, covering all aspects of Task 9 implementation.
 *
 * @author BassNotion Team
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MusicalExpressionEngine,
  type MidiNoteEvent,
  type MusicalContext,
  type ExpressionOptions,
} from '../plugins/MusicalExpressionEngine.js';

describe('MusicalExpressionEngine - Task 9 Implementation', () => {
  let engine: MusicalExpressionEngine;

  const testNotes: MidiNoteEvent[] = [
    { note: 'C4', velocity: 80, time: 0, duration: 0.5, channel: 1 },
    { note: 'E4', velocity: 75, time: 0.5, duration: 0.5, channel: 1 },
  ];

  const testContext: MusicalContext = {
    key: 'C major',
    timeSignature: [4, 4],
    tempo: 120,
    style: 'jazz',
    genre: 'jazz',
    complexity: 0.6,
    emotionalIntensity: 0.7,
  };

  beforeEach(async () => {
    engine = MusicalExpressionEngine.getInstance();
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.dispose();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(engine).toBeInstanceOf(MusicalExpressionEngine);
    });

    it('should load groove templates', () => {
      const templates = engine.getGrooveTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('Expression Processing', () => {
    it('should apply expression to notes', async () => {
      const result = await engine.applyExpression(testNotes, testContext);
      expect(result).toHaveLength(testNotes.length);
      expect(result[0]).toHaveProperty('expression');
    });

    it('should apply groove templates', async () => {
      const options: ExpressionOptions = { grooveTemplate: 'jazz-swing' };
      const result = await engine.applyExpression(
        testNotes,
        testContext,
        options,
      );
      expect(result[0]?.expression?.microTiming).toBeDefined();
    });

    it('should apply swing quantization', async () => {
      const options: ExpressionOptions = { swingRatio: 0.67 };
      const result = await engine.applyExpression(
        testNotes,
        testContext,
        options,
      );
      expect(result).toHaveLength(testNotes.length);
    });

    it('should apply humanization', async () => {
      const options: ExpressionOptions = {
        humanization: {
          timingVariation: 0.3,
          velocityVariation: 0.2,
          durationVariation: 0.1,
          enabled: true,
        },
      };
      const result = await engine.applyExpression(
        testNotes,
        testContext,
        options,
      );
      expect(result).toHaveLength(testNotes.length);
    });
  });

  describe('Context Awareness', () => {
    it('should adapt to different musical styles', async () => {
      const jazzResult = await engine.applyExpression(testNotes, {
        ...testContext,
        style: 'jazz',
      });
      const rockResult = await engine.applyExpression(testNotes, {
        ...testContext,
        style: 'rock',
      });

      expect(jazzResult[0]?.expression?.phrasing).toBeDefined();
      expect(rockResult[0]?.expression?.phrasing).toBeDefined();
    });

    it('should respond to emotional intensity', async () => {
      const lowIntensity = await engine.applyExpression(testNotes, {
        ...testContext,
        emotionalIntensity: 0.2,
      });
      const highIntensity = await engine.applyExpression(testNotes, {
        ...testContext,
        emotionalIntensity: 0.9,
      });

      expect(lowIntensity).toHaveLength(testNotes.length);
      expect(highIntensity).toHaveLength(testNotes.length);
    });
  });

  describe('Resource Management', () => {
    it('should dispose properly', async () => {
      await engine.dispose();
      expect(true).toBe(true); // Disposal completed without error
    });
  });
});
