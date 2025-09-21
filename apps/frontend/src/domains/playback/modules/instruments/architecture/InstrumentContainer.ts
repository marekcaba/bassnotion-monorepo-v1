/**
 * Instrument Dependency Injection Container
 *
 * Manages dependencies and composition for instruments
 */

import type { IInstrumentCore } from './IInstrumentCore.js';
import type { IInstrumentScheduler } from './IInstrumentScheduler.js';
import type { IInstrumentEffects } from './IInstrumentEffects.js';
import type { IInstrumentLifecycle } from './IInstrumentLifecycle.js';

export interface InstrumentDependencies {
  core: IInstrumentCore;
  scheduler?: IInstrumentScheduler;
  effects?: IInstrumentEffects;
  lifecycle?: IInstrumentLifecycle;
  [key: string]: any;
}

export interface ServiceProvider<T> {
  (): T | Promise<T>;
}

export interface ServiceDescriptor<T = any> {
  provider: ServiceProvider<T>;
  singleton: boolean;
  instance?: T;
}

/**
 * Dependency injection container for instruments
 */
export class InstrumentContainer {
  private services: Map<string | symbol, ServiceDescriptor> = new Map();
  private instrumentDependencies: Map<string, InstrumentDependencies> =
    new Map();

  /**
   * Register a service
   */
  register<T>(
    token: string | symbol,
    provider: ServiceProvider<T>,
    options: { singleton?: boolean } = {},
  ): void {
    const { singleton = true } = options;

    this.services.set(token, {
      provider,
      singleton,
    });
  }

  /**
   * Register a singleton instance
   */
  registerInstance<T>(token: string | symbol, instance: T): void {
    this.services.set(token, {
      provider: () => instance,
      singleton: true,
      instance,
    });
  }

  /**
   * Register a factory function
   */
  registerFactory<T>(
    token: string | symbol,
    factory: (...args: any[]) => T,
    dependencies: Array<string | symbol> = [],
  ): void {
    this.register(token, async () => {
      const deps = await Promise.all(
        dependencies.map((dep) => this.resolve(dep)),
      );
      return factory(...deps);
    });
  }

  /**
   * Resolve a service
   */
  async resolve<T>(token: string | symbol): Promise<T> {
    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(`Service not registered: ${String(token)}`);
    }

    if (descriptor.singleton && descriptor.instance) {
      return descriptor.instance as T;
    }

    const instance = await descriptor.provider();

    if (descriptor.singleton) {
      descriptor.instance = instance;
    }

    return instance as T;
  }

  /**
   * Check if service is registered
   */
  has(token: string | symbol): boolean {
    return this.services.has(token);
  }

  /**
   * Create an instrument with dependencies
   */
  async createInstrument(
    instrumentId: string,
    coreFactory: () => IInstrumentCore | Promise<IInstrumentCore>,
    options: {
      scheduler?: boolean | string | symbol;
      effects?: boolean | string | symbol;
      lifecycle?: boolean | string | symbol;
    } = {},
  ): Promise<InstrumentDependencies> {
    // Create core
    const core = await coreFactory();

    const dependencies: InstrumentDependencies = { core };

    // Resolve optional dependencies
    if (options.scheduler) {
      const schedulerToken =
        typeof options.scheduler === 'string' ||
        typeof options.scheduler === 'symbol'
          ? options.scheduler
          : 'scheduler';
      dependencies.scheduler =
        await this.resolve<IInstrumentScheduler>(schedulerToken);
    }

    if (options.effects) {
      const effectsToken =
        typeof options.effects === 'string' ||
        typeof options.effects === 'symbol'
          ? options.effects
          : 'effects';
      dependencies.effects =
        await this.resolve<IInstrumentEffects>(effectsToken);
    }

    if (options.lifecycle) {
      const lifecycleToken =
        typeof options.lifecycle === 'string' ||
        typeof options.lifecycle === 'symbol'
          ? options.lifecycle
          : 'lifecycle';
      dependencies.lifecycle =
        await this.resolve<IInstrumentLifecycle>(lifecycleToken);
    }

    // Store dependencies
    this.instrumentDependencies.set(instrumentId, dependencies);

    return dependencies;
  }

  /**
   * Get instrument dependencies
   */
  getInstrumentDependencies(
    instrumentId: string,
  ): InstrumentDependencies | undefined {
    return this.instrumentDependencies.get(instrumentId);
  }

  /**
   * Dispose instrument and its dependencies
   */
  async disposeInstrument(instrumentId: string): Promise<void> {
    const deps = this.instrumentDependencies.get(instrumentId);
    if (!deps) return;

    // Dispose in reverse order
    if (deps.lifecycle) {
      await deps.lifecycle.dispose();
    }

    if (deps.effects && 'dispose' in deps.effects) {
      (deps.effects as any).dispose();
    }

    if (deps.scheduler && 'dispose' in deps.scheduler) {
      (deps.scheduler as any).dispose();
    }

    await deps.core.dispose();

    this.instrumentDependencies.delete(instrumentId);
  }

  /**
   * Clear all services and instruments
   */
  async clear(): Promise<void> {
    // Dispose all instruments
    for (const instrumentId of this.instrumentDependencies.keys()) {
      await this.disposeInstrument(instrumentId);
    }

    // Clear services
    this.services.clear();
  }

  /**
   * Create a scoped container
   */
  createScope(): InstrumentContainer {
    const scope = new InstrumentContainer();

    // Copy service registrations (not instances)
    for (const [token, descriptor] of this.services) {
      scope.services.set(token, {
        provider: descriptor.provider,
        singleton: descriptor.singleton,
      });
    }

    return scope;
  }
}

/**
 * Global container instance
 */
export const globalContainer = new InstrumentContainer();

/**
 * Service tokens
 */
export const ServiceTokens = {
  // Core services
  AudioContext: Symbol('AudioContext'),
  Transport: Symbol('Transport'),

  // Instrument services
  Scheduler: Symbol('Scheduler'),
  Effects: Symbol('Effects'),
  Lifecycle: Symbol('Lifecycle'),

  // Storage services
  SampleLoader: Symbol('SampleLoader'),
  SampleCache: Symbol('SampleCache'),

  // Configuration
  Config: Symbol('Config'),
} as const;

/**
 * Decorator for dependency injection
 */
export function Injectable(token?: string | symbol) {
  return function (target: any) {
    const finalToken = token || target.name;
    globalContainer.register(finalToken, () => new target());
  };
}

/**
 * Decorator for injecting dependencies
 */
export function Inject(token: string | symbol) {
  return function (
    target: any,
    propertyKey: string | symbol,
    parameterIndex: number,
  ) {
    // Store metadata for later resolution
    const existingTokens =
      Reflect.getMetadata('design:paramtokens', target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata('design:paramtokens', existingTokens, target);
  };
}
