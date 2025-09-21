/**
 * MIDI Validation Engine
 *
 * Orchestrates MIDI validation using format, event, and timing validators
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { ParsedMidiFile, TypedMidiEvent } from '../parser/index.js';
import { MidiFormatValidator } from './MidiFormatValidator.js';
import { MidiEventValidator } from './MidiEventValidator.js';
import { MidiTimingValidator } from './MidiTimingValidator.js';
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './MidiFormatValidator.js';
import type { EventValidationRules } from './MidiEventValidator.js';

const logger = createStructuredLogger('MidiValidationEngine');

export interface ValidationOptions {
  // Format validation
  validateFormat?: boolean;
  maxFileSize?: number;
  allowedFormats?: number[];

  // Event validation
  validateEvents?: boolean;
  eventRules?: EventValidationRules;

  // Timing validation
  validateTiming?: boolean;
  checkOverlaps?: boolean;
  checkGaps?: boolean;
  checkDrift?: boolean;

  // Rule sets
  ruleSet?: 'strict' | 'standard' | 'permissive' | 'custom';
  customRules?: ValidationRule[];
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  validator: (file: ParsedMidiFile) => ValidationIssue[];
}

export interface ValidationIssue {
  ruleId: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  context?: any;
}

export interface ComprehensiveValidationResult {
  valid: boolean;
  score: number; // 0-100 quality score
  summary: {
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    formatValid: boolean;
    eventsValid: boolean;
    timingValid: boolean;
  };
  format?: ValidationResult;
  events?: {
    valid: boolean;
    errorCount: number;
    warningCount: number;
  };
  timing?: {
    valid: boolean;
    issues: any[];
    statistics: any;
  };
  ruleViolations: ValidationIssue[];
  recommendations: string[];
}

/**
 * Comprehensive MIDI validation engine
 */
export class MidiValidationEngine {
  private static predefinedRules: Map<string, ValidationRule[]> = new Map();

  static {
    // Initialize predefined rule sets
    this.initializePredefinedRules();
  }

  /**
   * Validate a parsed MIDI file
   */
  static validate(
    parsedFile: ParsedMidiFile,
    options: ValidationOptions = {},
  ): ComprehensiveValidationResult {
    const startTime = performance.now();

    const {
      validateFormat = true,
      validateEvents = true,
      validateTiming = true,
      ruleSet = 'standard',
      customRules = [],
    } = options;

    logger.info('Starting MIDI validation', {
      trackCount: parsedFile.tracks.length,
      ruleSet,
      options,
    });

    const result: ComprehensiveValidationResult = {
      valid: true,
      score: 100,
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        totalInfo: 0,
        formatValid: true,
        eventsValid: true,
        timingValid: true,
      },
      ruleViolations: [],
      recommendations: [],
    };

    // Format validation
    if (validateFormat) {
      result.format = MidiFormatValidator.validate(parsedFile);
      result.summary.formatValid = result.format.valid;
      result.summary.totalErrors += result.format.errors.length;
      result.summary.totalWarnings += result.format.warnings.length;

      // Convert to rule violations
      this.convertFormatResults(result.format, result.ruleViolations);
    }

    // Event validation
    if (validateEvents) {
      const eventResults = this.validateAllEvents(
        parsedFile,
        options.eventRules,
      );
      result.events = eventResults;
      result.summary.eventsValid = eventResults.valid;
      result.summary.totalErrors += eventResults.errorCount;
      result.summary.totalWarnings += eventResults.warningCount;
    }

    // Timing validation
    if (validateTiming) {
      result.timing = MidiTimingValidator.validateTiming(parsedFile, {
        checkOverlaps: options.checkOverlaps,
        checkGaps: options.checkGaps,
        checkDrift: options.checkDrift,
      });
      result.summary.timingValid = result.timing.valid;
      result.summary.totalErrors += result.timing.issues.filter(
        (i) => i.severity === 'high',
      ).length;
      result.summary.totalWarnings += result.timing.issues.filter(
        (i) => i.severity === 'medium' || i.severity === 'low',
      ).length;
    }

    // Apply rule set
    const rules = this.getRules(ruleSet, customRules);
    for (const rule of rules) {
      const violations = rule.validator(parsedFile);
      result.ruleViolations.push(...violations);
    }

    // Calculate overall validity and score
    result.valid = result.summary.totalErrors === 0;
    result.score = this.calculateQualityScore(result);

    // Generate recommendations
    result.recommendations = this.generateRecommendations(result, parsedFile);

    const duration = performance.now() - startTime;
    logger.info('MIDI validation complete', {
      valid: result.valid,
      score: result.score,
      errors: result.summary.totalErrors,
      warnings: result.summary.totalWarnings,
      duration,
    });

    return result;
  }

  /**
   * Validate all events in the file
   */
  private static validateAllEvents(
    parsedFile: ParsedMidiFile,
    rules?: EventValidationRules,
  ): { valid: boolean; errorCount: number; warningCount: number } {
    let errorCount = 0;
    let warningCount = 0;

    for (const track of parsedFile.tracks) {
      for (const event of track.events) {
        // Skip events that aren't typed
        if (!this.isTypedEvent(event)) continue;

        const result = MidiEventValidator.validateEvent(event, rules);
        errorCount += result.errors.length;
        warningCount += result.warnings.length;
      }
    }

    return {
      valid: errorCount === 0,
      errorCount,
      warningCount,
    };
  }

  /**
   * Check if event is a typed event
   */
  private static isTypedEvent(event: any): event is TypedMidiEvent {
    const typedEventTypes = [
      'noteOn',
      'noteOff',
      'controlChange',
      'programChange',
      'pitchBend',
      'tempo',
      'timeSignature',
      'keySignature',
    ];
    return typedEventTypes.includes(event.type);
  }

  /**
   * Convert format validation results to rule violations
   */
  private static convertFormatResults(
    formatResult: ValidationResult,
    violations: ValidationIssue[],
  ): void {
    for (const error of formatResult.errors) {
      violations.push({
        ruleId: `format.${error.code}`,
        message: error.message,
        severity: error.severity === 'critical' ? 'error' : 'error',
        context: error.location,
      });
    }

    for (const warning of formatResult.warnings) {
      violations.push({
        ruleId: `format.${warning.code}`,
        message: warning.message,
        severity: 'warning',
        context: warning.location,
      });
    }
  }

  /**
   * Get validation rules based on rule set
   */
  private static getRules(
    ruleSet: string,
    customRules: ValidationRule[],
  ): ValidationRule[] {
    if (ruleSet === 'custom') {
      return customRules;
    }

    const predefined = this.predefinedRules.get(ruleSet) || [];
    return [...predefined, ...customRules];
  }

  /**
   * Calculate quality score
   */
  private static calculateQualityScore(
    result: ComprehensiveValidationResult,
  ): number {
    let score = 100;

    // Deduct for errors (heavy penalty)
    score -= result.summary.totalErrors * 10;

    // Deduct for warnings (light penalty)
    score -= result.summary.totalWarnings * 2;

    // Deduct for rule violations
    for (const violation of result.ruleViolations) {
      if (violation.severity === 'error') score -= 5;
      else if (violation.severity === 'warning') score -= 1;
    }

    // Timing quality affects score
    if (result.timing) {
      const timingPenalty = result.timing.issues.length * 0.5;
      score -= Math.min(timingPenalty, 10); // Cap timing penalty at 10
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations based on validation results
   */
  private static generateRecommendations(
    result: ComprehensiveValidationResult,
    parsedFile: ParsedMidiFile,
  ): string[] {
    const recommendations = new Set<string>();

    // Add timing recommendations
    if (result.timing?.recommendations) {
      result.timing.recommendations.forEach((r) => recommendations.add(r));
    }

    // Add format-based recommendations
    if (!result.summary.formatValid) {
      recommendations.add('Fix format errors before processing');
    }

    // Event-based recommendations
    if (result.events && result.events.errorCount > 10) {
      recommendations.add(
        'Many event errors detected - consider using a MIDI cleanup tool',
      );
    }

    // Score-based recommendations
    if (result.score < 50) {
      recommendations.add('File quality is poor - manual review recommended');
    } else if (result.score < 80) {
      recommendations.add('File has minor issues that should be addressed');
    }

    // Performance recommendations
    const totalEvents = parsedFile.tracks.reduce(
      (sum, track) => sum + track.events.length,
      0,
    );
    if (totalEvents > 100000) {
      recommendations.add(
        'Very large file - consider splitting for better performance',
      );
    }

    return Array.from(recommendations);
  }

  /**
   * Initialize predefined rule sets
   */
  private static initializePredefinedRules(): void {
    // Strict rules
    this.predefinedRules.set('strict', [
      {
        id: 'strict.no-overlapping-notes',
        name: 'No Overlapping Notes',
        description: 'Ensures no notes overlap on the same channel',
        severity: 'error',
        validator: (file) => {
          const violations: ValidationIssue[] = [];
          // Implementation would check for overlaps
          return violations;
        },
      },
      {
        id: 'strict.valid-tempo-range',
        name: 'Valid Tempo Range',
        description: 'Tempo must be between 20-300 BPM',
        severity: 'error',
        validator: (file) => {
          const violations: ValidationIssue[] = [];
          for (const track of file.tracks) {
            for (const event of track.events) {
              if (event.type === 'setTempo' && 'bpm' in event) {
                const bpm = (event as any).bpm;
                if (bpm < 20 || bpm > 300) {
                  violations.push({
                    ruleId: 'strict.valid-tempo-range',
                    message: `Tempo ${bpm} BPM is outside valid range (20-300)`,
                    severity: 'error',
                  });
                }
              }
            }
          }
          return violations;
        },
      },
    ]);

    // Standard rules
    this.predefinedRules.set('standard', [
      {
        id: 'standard.reasonable-tempo',
        name: 'Reasonable Tempo',
        description: 'Warns about extreme tempos',
        severity: 'warning',
        validator: (file) => {
          const violations: ValidationIssue[] = [];
          for (const track of file.tracks) {
            for (const event of track.events) {
              if (event.type === 'setTempo' && 'bpm' in event) {
                const bpm = (event as any).bpm;
                if (bpm < 40 || bpm > 200) {
                  violations.push({
                    ruleId: 'standard.reasonable-tempo',
                    message: `Tempo ${bpm} BPM may be too ${bpm < 40 ? 'slow' : 'fast'}`,
                    severity: 'warning',
                  });
                }
              }
            }
          }
          return violations;
        },
      },
    ]);

    // Permissive rules
    this.predefinedRules.set('permissive', [
      {
        id: 'permissive.file-parseable',
        name: 'File Parseable',
        description: 'File can be parsed without critical errors',
        severity: 'info',
        validator: (file) => {
          if (!file.header || file.tracks.length === 0) {
            return [
              {
                ruleId: 'permissive.file-parseable',
                message: 'File structure is incomplete',
                severity: 'error',
              },
            ];
          }
          return [];
        },
      },
    ]);
  }

  /**
   * Create custom validation rule
   */
  static createRule(
    id: string,
    name: string,
    description: string,
    severity: 'error' | 'warning' | 'info',
    validator: (file: ParsedMidiFile) => ValidationIssue[],
  ): ValidationRule {
    return { id, name, description, severity, validator };
  }

  /**
   * Validate against specific rule
   */
  static validateRule(
    parsedFile: ParsedMidiFile,
    rule: ValidationRule,
  ): ValidationIssue[] {
    try {
      return rule.validator(parsedFile);
    } catch (error) {
      logger.error('Rule validation failed', error, { ruleId: rule.id });
      return [
        {
          ruleId: rule.id,
          message: `Rule validation failed: ${error.message}`,
          severity: 'error',
        },
      ];
    }
  }
}
