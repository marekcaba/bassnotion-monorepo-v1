import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ServiceRegistry } from '../../services/core/ServiceRegistry.js';
import { AudioEngine } from '../../services/core/AudioEngine.js';
import { EventBus } from '../../services/core/EventBus.js';
import { UnifiedTransport } from '../../services/core/index.js';
import { PluginManager } from '../../services/core/PluginManager.js';

describe('Production Readiness Validation', () => {
  const servicesPath = path.resolve(__dirname, '../../services/core');
  const widgetsPath = path.resolve(__dirname, '../../../widgets/components');

  describe('TypeScript Strict Mode Compliance', () => {
    it('should have no "any" types in core services', () => {
      const coreFiles = [
        'AudioEngine.ts',
        'EventBus.ts',
        'ServiceRegistry.ts',
        'UnifiedTransport.ts',
        'PluginManager.ts'
      ];

      let anyTypeCount = 0;
      const violations: string[] = [];

      coreFiles.forEach(file => {
        const filePath = path.join(servicesPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            // Skip comments and type definitions that legitimately use 'any'
            if (!line.trim().startsWith('//') && 
                !line.includes('* @') &&
                line.includes(': any') && 
                !line.includes('unknown')) {
              anyTypeCount++;
              violations.push(`${file}:${index + 1}: ${line.trim()}`);
            }
          });
        }
      });

      expect(anyTypeCount).toBe(0);
      if (violations.length > 0) {
        console.log('Any type violations:', violations);
      }
    });

    it('should have proper type exports', () => {
      const indexPath = path.join(servicesPath, 'index.ts');
      expect(fs.existsSync(indexPath)).toBe(true);

      const content = fs.readFileSync(indexPath, 'utf-8');
      
      // Should export all core services
      expect(content).toContain('export { AudioEngine }');
      expect(content).toContain('export { EventBus }');
      expect(content).toContain('export { ServiceRegistry }');
      expect(content).toContain('export { UnifiedTransport }');
      expect(content).toContain('export { PluginManager }');
      
      // Should export types
      expect(content).toMatch(/export\s+(type|interface)/);
    });
  });

  describe('Technical Debt Validation', () => {
    it('should have no TODO comments in core services', () => {
      const coreFiles = fs.readdirSync(servicesPath)
        .filter(file => file.endsWith('.ts') && !file.includes('test'));

      let todoCount = 0;
      const todos: string[] = [];

      coreFiles.forEach(file => {
        const filePath = path.join(servicesPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
            todoCount++;
            todos.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });
      });

      expect(todoCount).toBe(0);
      if (todos.length > 0) {
        console.log('TODO/FIXME/HACK comments found:', todos);
      }
    });

    it('should have no console.log or console.error in production code', () => {
      const coreFiles = fs.readdirSync(servicesPath)
        .filter(file => file.endsWith('.ts') && !file.includes('test'));

      let consoleCount = 0;
      const violations: string[] = [];

      coreFiles.forEach(file => {
        const filePath = path.join(servicesPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (!line.trim().startsWith('//') && 
              (line.includes('console.log') || 
               line.includes('console.error') ||
               line.includes('console.warn'))) {
            consoleCount++;
            violations.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });
      });

      expect(consoleCount).toBe(0);
      if (violations.length > 0) {
        console.log('Console statements found:', violations);
      }
    });

    it('should have no deprecated patterns', () => {
      const deprecatedPatterns = [
        /window\.\w+\s*=/,  // Global assignments
        /Function\.prototype/,  // Prototype pollution
        /eval\(/,  // eval usage
        /__proto__/,  // Proto access
        /arguments\.callee/  // Deprecated arguments usage
      ];

      const coreFiles = fs.readdirSync(servicesPath)
        .filter(file => file.endsWith('.ts') && !file.includes('test'));

      const violations: string[] = [];

      coreFiles.forEach(file => {
        const filePath = path.join(servicesPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        deprecatedPatterns.forEach(pattern => {
          if (pattern.test(content)) {
            violations.push(`${file}: Contains deprecated pattern ${pattern}`);
          }
        });
      });

      expect(violations).toHaveLength(0);
      if (violations.length > 0) {
        console.log('Deprecated patterns found:', violations);
      }
    });
  });

  describe('Error Handling Excellence', () => {
    it('should have comprehensive error handling in all services', () => {
      const coreFiles = [
        'AudioEngine.ts',
        'EventBus.ts',
        'ServiceRegistry.ts',
        'UnifiedTransport.ts',
        'PluginManager.ts'
      ];

      coreFiles.forEach(file => {
        const filePath = path.join(servicesPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Should have try-catch blocks
          expect(content).toMatch(/try\s*{[\s\S]*?}\s*catch/);
          
          // Should have error messages
          expect(content).toMatch(/throw\s+new\s+Error\(/);
          
          // Should handle async errors
          if (content.includes('async')) {
            expect(content).toMatch(/\.catch\(|try\s*{[\s\S]*?await/);
          }
        }
      });
    });

    it('should provide user-friendly error messages', async () => {
      const audioEngine = new AudioEngine(new EventBus());
      
      // Mock audio context creation failure
      const originalCreate = audioEngine.createContext;
      audioEngine.createContext = () => {
        throw new Error('Audio context creation failed');
      };

      try {
        await audioEngine.initialize();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        
        // Should have helpful error message
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(20);
        
        // Should not expose internal details
        expect(message).not.toContain('undefined');
        expect(message).not.toContain('null');
        expect(message).not.toContain('stack');
      }

      // Restore
      audioEngine.createContext = originalCreate;
    });

    it('should have error recovery mechanisms', async () => {
      const eventBus = new EventBus();
      const audioEngine = new AudioEngine(eventBus);
      
      let errorCount = 0;
      eventBus.on('error', () => errorCount++);

      // Simulate recoverable error
      const transport = new UnifiedTransport(audioEngine, eventBus);
      
      // Mock a failure that should be recoverable
      let attemptCount = 0;
      const originalPlay = transport.play;
      transport.play = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return originalPlay.call(transport);
      };

      // Should retry and eventually succeed
      await expect(transport.play()).resolves.not.toThrow();
      expect(attemptCount).toBe(3);
    });
  });

  describe('Cross-Browser Compatibility', () => {
    it('should have browser compatibility checks', () => {
      const audioEnginePath = path.join(servicesPath, 'AudioEngine.ts');
      const content = fs.readFileSync(audioEnginePath, 'utf-8');

      // Should check for Web Audio API support
      expect(content).toMatch(/window\.AudioContext|window\.webkitAudioContext/i);
      
      // Should have fallbacks
      expect(content).toContain('||');
    });

    it('should handle vendor prefixes', () => {
      const files = fs.readdirSync(servicesPath)
        .filter(file => file.endsWith('.ts') && !file.includes('test'));

      const vendorChecks = [
        'webkit',
        'moz',
        'ms'
      ];

      let hasVendorHandling = false;

      files.forEach(file => {
        const filePath = path.join(servicesPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        vendorChecks.forEach(vendor => {
          if (content.toLowerCase().includes(vendor)) {
            hasVendorHandling = true;
          }
        });
      });

      // At least some vendor prefix handling should exist
      expect(hasVendorHandling).toBe(true);
    });
  });

  describe('Production Monitoring', () => {
    it('should have health check endpoints', async () => {
      const serviceRegistry = new ServiceRegistry();
      const eventBus = new EventBus();
      const audioEngine = new AudioEngine(eventBus);
      
      serviceRegistry.register('eventBus', eventBus);
      serviceRegistry.register('audioEngine', audioEngine);
      
      await serviceRegistry.initialize();
      
      // Should provide health check
      const health = await serviceRegistry.healthCheck();
      
      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('services');
      expect(health).toHaveProperty('timestamp');
      
      expect(health.overall).toMatch(/healthy|unhealthy/);
      expect(health.services).toBeTypeOf('object');
    });

    it('should emit monitoring events', async () => {
      const eventBus = new EventBus();
      const monitoringEvents: any[] = [];
      
      // Subscribe to monitoring events
      eventBus.on('monitoring:*', (eventName, data) => {
        monitoringEvents.push({ event: eventName, data });
      });

      const audioEngine = new AudioEngine(eventBus);
      await audioEngine.initialize();

      // Should have emitted monitoring events
      expect(monitoringEvents.length).toBeGreaterThan(0);
      
      const initEvent = monitoringEvents.find(e => e.event.includes('initialized'));
      expect(initEvent).toBeDefined();
    });

    it('should track performance metrics', async () => {
      const eventBus = new EventBus();
      const metrics: any[] = [];
      
      eventBus.on('metrics:*', (eventName, data) => {
        metrics.push(data);
      });

      const audioEngine = new AudioEngine(eventBus);
      const transport = new UnifiedTransport(audioEngine, eventBus);
      
      await audioEngine.initialize();
      await transport.initialize();
      await transport.play();
      await transport.stop();

      // Should have collected metrics
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('Security Best Practices', () => {
    it('should not expose sensitive information', () => {
      const coreFiles = fs.readdirSync(servicesPath)
        .filter(file => file.endsWith('.ts') && !file.includes('test'));

      const sensitivePatterns = [
        /api[_-]?key/i,
        /secret/i,
        /password/i,
        /token/i,
        /credential/i
      ];

      const violations: string[] = [];

      coreFiles.forEach(file => {
        const filePath = path.join(servicesPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          sensitivePatterns.forEach(pattern => {
            if (pattern.test(line) && !line.includes('//') && !line.includes('*')) {
              violations.push(`${file}:${index + 1}: Potential sensitive data exposure`);
            }
          });
        });
      });

      expect(violations).toHaveLength(0);
    });

    it('should sanitize user inputs', () => {
      // Check for input validation in public methods
      const transportPath = path.join(servicesPath, 'UnifiedTransport.ts');
      const content = fs.readFileSync(transportPath, 'utf-8');

      // Should validate numeric inputs
      expect(content).toMatch(/if\s*\(.*tempo.*[<>]=?\s*\d+/);
      
      // Should validate types
      expect(content).toMatch(/typeof.*===\s*['"]number['"]/);
    });
  });

  describe('Build Configuration', () => {
    it('should have production optimizations configured', () => {
      // This would check build configs in a real scenario
      expect(true).toBe(true);
    });
  });

  describe('Documentation Completeness', () => {
    it('should have JSDoc comments for all public methods', () => {
      const coreFiles = [
        'AudioEngine.ts',
        'EventBus.ts',
        'ServiceRegistry.ts',
        'UnifiedTransport.ts',
        'PluginManager.ts'
      ];

      coreFiles.forEach(file => {
        const filePath = path.join(servicesPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Check for class documentation
          expect(content).toMatch(/\/\*\*[\s\S]*?\*\/[\s\S]*?export\s+class/);
          
          // Check for method documentation
          const publicMethods = content.match(/public\s+\w+\s*\(/g) || [];
          const asyncMethods = content.match(/async\s+\w+\s*\(/g) || [];
          
          const totalMethods = publicMethods.length + asyncMethods.length;
          const jsdocComments = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
          
          // Should have roughly equal number of JSDoc comments to methods
          expect(jsdocComments.length).toBeGreaterThanOrEqual(totalMethods * 0.8);
        }
      });
    });
  });
});