/**
 * Router - Advanced audio routing system
 *
 * Manages complex routing scenarios:
 * - Multi-channel routing
 * - Sidechain connections
 * - Bus routing
 * - Send/return management
 * - Signal flow validation
 */

import type { Channel } from '../mixing/Channel.js';
import type { Bus } from '../mixing/Bus.js';
import { EventBus, createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('Router');

export type RouteType = 'direct' | 'send' | 'sidechain' | 'bus';
export type RoutePoint = 'pre-fader' | 'post-fader' | 'pre-fx' | 'post-fx';

export interface Route {
  id: string;
  name: string;
  type: RouteType;
  sourceId: string;
  destinationId: string;
  sourcePoint: RoutePoint;
  active: boolean;
  gain: number;
  pan?: number;
  muted: boolean;
  soloed: boolean;
}

export interface RoutingMatrix {
  routes: Map<string, Route>;
  connections: Map<string, Set<string>>; // source -> destinations
  reverseConnections: Map<string, Set<string>>; // destination -> sources
}

export interface RouterConfig {
  maxRoutes?: number;
  allowFeedbackLoops?: boolean;
  validateRouting?: boolean;
}

export class Router {
  private routes = new Map<string, Route>();
  private connections = new Map<string, Set<string>>();
  private reverseConnections = new Map<string, Set<string>>();
  private config: Required<RouterConfig>;
  private eventBus?: EventBus;

  // Audio nodes registry
  private channels = new Map<string, Channel>();
  private buses = new Map<string, Bus>();

  constructor(config: RouterConfig = {}, eventBus?: EventBus) {
    this.config = {
      maxRoutes: config.maxRoutes ?? 1000,
      allowFeedbackLoops: config.allowFeedbackLoops ?? false,
      validateRouting: config.validateRouting ?? true,
    };
    this.eventBus = eventBus;
  }

  /**
   * Register a channel
   */
  registerChannel(channel: Channel): void {
    this.channels.set(channel.id, channel);
    logger.debug('Channel registered', { channelId: channel.id });
  }

  /**
   * Register a bus
   */
  registerBus(bus: Bus): void {
    this.buses.set(bus.id, bus);
    logger.debug('Bus registered', { busId: bus.id });
  }

  /**
   * Create a direct route
   */
  createDirectRoute(
    sourceId: string,
    destinationId: string,
    options: {
      name?: string;
      sourcePoint?: RoutePoint;
      gain?: number;
      pan?: number;
    } = {},
  ): Route {
    // Validate
    if (this.config.validateRouting) {
      this.validateRoute(sourceId, destinationId);
    }

    const routeId = `route-${sourceId}-${destinationId}-${Date.now()}`;
    const route: Route = {
      id: routeId,
      name: options.name || `${sourceId} → ${destinationId}`,
      type: 'direct',
      sourceId,
      destinationId,
      sourcePoint: options.sourcePoint || 'post-fader',
      active: true,
      gain: options.gain ?? 1.0,
      pan: options.pan,
      muted: false,
      soloed: false,
    };

    this.addRoute(route);
    this.connectRoute(route);

    return route;
  }

  /**
   * Create a send route
   */
  createSend(
    sourceId: string,
    auxBusId: string,
    options: {
      name?: string;
      sourcePoint?: RoutePoint;
      gain?: number;
    } = {},
  ): Route {
    const bus = this.buses.get(auxBusId);
    if (!bus || bus.type !== 'aux') {
      throw new Error(`Invalid aux bus: ${auxBusId}`);
    }

    const routeId = `send-${sourceId}-${auxBusId}-${Date.now()}`;
    const route: Route = {
      id: routeId,
      name: options.name || `${sourceId} Send → ${auxBusId}`,
      type: 'send',
      sourceId,
      destinationId: auxBusId,
      sourcePoint: options.sourcePoint || 'post-fader',
      active: true,
      gain: options.gain ?? 0.5,
      muted: false,
      soloed: false,
    };

    this.addRoute(route);
    this.connectRoute(route);

    return route;
  }

  /**
   * Create a sidechain route
   */
  createSidechain(
    sourceId: string,
    destinationId: string,
    options: {
      name?: string;
      sourcePoint?: RoutePoint;
    } = {},
  ): Route {
    const routeId = `sidechain-${sourceId}-${destinationId}-${Date.now()}`;
    const route: Route = {
      id: routeId,
      name: options.name || `${sourceId} SC → ${destinationId}`,
      type: 'sidechain',
      sourceId,
      destinationId,
      sourcePoint: options.sourcePoint || 'post-fader',
      active: true,
      gain: 1.0,
      muted: false,
      soloed: false,
    };

    this.addRoute(route);
    // Sidechain connections are handled differently
    this.connectSidechain(route);

    return route;
  }

  /**
   * Update route
   */
  updateRoute(
    routeId: string,
    updates: Partial<{
      gain: number;
      pan: number;
      muted: boolean;
      soloed: boolean;
      active: boolean;
    }>,
  ): void {
    const route = this.routes.get(routeId);
    if (!route) {
      throw new Error(`Route not found: ${routeId}`);
    }

    // Apply updates
    if (updates.gain !== undefined) {
      route.gain = Math.max(0, Math.min(2, updates.gain));
    }
    if (updates.pan !== undefined) {
      route.pan = Math.max(-1, Math.min(1, updates.pan));
    }
    if (updates.muted !== undefined) {
      route.muted = updates.muted;
    }
    if (updates.soloed !== undefined) {
      route.soloed = updates.soloed;
    }
    if (updates.active !== undefined) {
      route.active = updates.active;
      if (updates.active) {
        this.connectRoute(route);
      } else {
        this.disconnectRoute(route);
      }
    }

    // Apply to audio connection
    this.applyRouteChanges(route);

    this.eventBus?.emit('router:routeUpdated', {
      routeId,
      updates,
    });
  }

  /**
   * Delete route
   */
  deleteRoute(routeId: string): void {
    const route = this.routes.get(routeId);
    if (!route) {
      return;
    }

    this.disconnectRoute(route);
    this.removeRoute(route);

    logger.info('Route deleted', { routeId });
  }

  /**
   * Get all routes for a source
   */
  getRoutesFromSource(sourceId: string): Route[] {
    const destinations = this.connections.get(sourceId);
    if (!destinations) {
      return [];
    }

    return Array.from(destinations)
      .map((destId) => this.findRoute(sourceId, destId))
      .filter(Boolean) as Route[];
  }

  /**
   * Get all routes to a destination
   */
  getRoutesToDestination(destinationId: string): Route[] {
    const sources = this.reverseConnections.get(destinationId);
    if (!sources) {
      return [];
    }

    return Array.from(sources)
      .map((sourceId) => this.findRoute(sourceId, destinationId))
      .filter(Boolean) as Route[];
  }

  /**
   * Check if route exists
   */
  hasRoute(sourceId: string, destinationId: string): boolean {
    const destinations = this.connections.get(sourceId);
    return destinations ? destinations.has(destinationId) : false;
  }

  /**
   * Get routing matrix
   */
  getRoutingMatrix(): RoutingMatrix {
    return {
      routes: new Map(this.routes),
      connections: new Map(this.connections),
      reverseConnections: new Map(this.reverseConnections),
    };
  }

  /**
   * Validate routing paths
   */
  validateAllRoutes(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for feedback loops
    if (!this.config.allowFeedbackLoops) {
      const loops = this.detectFeedbackLoops();
      loops.forEach((loop) => {
        errors.push(`Feedback loop detected: ${loop.join(' → ')}`);
      });
    }

    // Check for orphaned routes
    this.routes.forEach((route) => {
      if (
        !this.channels.has(route.sourceId) &&
        !this.buses.has(route.sourceId)
      ) {
        warnings.push(`Route source not found: ${route.sourceId}`);
      }
      if (
        !this.channels.has(route.destinationId) &&
        !this.buses.has(route.destinationId)
      ) {
        warnings.push(`Route destination not found: ${route.destinationId}`);
      }
    });

    // Check route count
    if (this.routes.size > this.config.maxRoutes) {
      warnings.push(
        `Route count (${this.routes.size}) exceeds maximum (${this.config.maxRoutes})`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Add route to internal structures
   */
  private addRoute(route: Route): void {
    if (this.routes.size >= this.config.maxRoutes) {
      throw new Error(
        `Maximum route count (${this.config.maxRoutes}) exceeded`,
      );
    }

    this.routes.set(route.id, route);

    // Update connections
    if (!this.connections.has(route.sourceId)) {
      this.connections.set(route.sourceId, new Set());
    }
    const sourceConnections = this.connections.get(route.sourceId);
    if (sourceConnections) {
      sourceConnections.add(route.destinationId);
    }

    if (!this.reverseConnections.has(route.destinationId)) {
      this.reverseConnections.set(route.destinationId, new Set());
    }
    const destConnections = this.reverseConnections.get(route.destinationId);
    if (destConnections) {
      destConnections.add(route.sourceId);
    }

    this.eventBus?.emit('router:routeAdded', { route });
  }

  /**
   * Remove route from internal structures
   */
  private removeRoute(route: Route): void {
    this.routes.delete(route.id);

    // Update connections
    const destinations = this.connections.get(route.sourceId);
    if (destinations) {
      destinations.delete(route.destinationId);
      if (destinations.size === 0) {
        this.connections.delete(route.sourceId);
      }
    }

    const sources = this.reverseConnections.get(route.destinationId);
    if (sources) {
      sources.delete(route.sourceId);
      if (sources.size === 0) {
        this.reverseConnections.delete(route.destinationId);
      }
    }

    this.eventBus?.emit('router:routeRemoved', { routeId: route.id });
  }

  /**
   * Connect route audio
   */
  private connectRoute(route: Route): void {
    const source = this.getAudioNode(route.sourceId);
    const destination = this.getAudioNode(route.destinationId);

    if (!source || !destination) {
      logger.warn('Cannot connect route - node not found', {
        sourceId: route.sourceId,
        destinationId: route.destinationId,
      });
      return;
    }

    // Route type specific connection logic would go here
    logger.debug('Route connected', {
      routeId: route.id,
      type: route.type,
    });
  }

  /**
   * Disconnect route audio
   */
  private disconnectRoute(route: Route): void {
    // Disconnection logic would go here
    logger.debug('Route disconnected', { routeId: route.id });
  }

  /**
   * Connect sidechain
   */
  private connectSidechain(route: Route): void {
    // Sidechain-specific connection logic
    logger.debug('Sidechain connected', { routeId: route.id });
  }

  /**
   * Apply route parameter changes
   */
  private applyRouteChanges(route: Route): void {
    // Apply gain, pan, mute, solo changes to audio connection
    logger.debug('Route changes applied', {
      routeId: route.id,
      gain: route.gain,
      muted: route.muted,
    });
  }

  /**
   * Validate route
   */
  private validateRoute(sourceId: string, destinationId: string): void {
    if (sourceId === destinationId) {
      throw new Error('Cannot route to self');
    }

    if (!this.config.allowFeedbackLoops) {
      if (this.wouldCreateFeedbackLoop(sourceId, destinationId)) {
        throw new Error('Route would create feedback loop');
      }
    }

    if (this.hasRoute(sourceId, destinationId)) {
      throw new Error('Route already exists');
    }
  }

  /**
   * Check if route would create feedback loop
   */
  private wouldCreateFeedbackLoop(
    sourceId: string,
    destinationId: string,
  ): boolean {
    // Simple DFS to check for cycles
    const visited = new Set<string>();
    const stack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (stack.has(nodeId)) {
        return true;
      }
      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      stack.add(nodeId);

      const destinations = this.connections.get(nodeId);
      if (destinations) {
        for (const destId of destinations) {
          if (destId === sourceId || hasCycle(destId)) {
            return true;
          }
        }
      }

      stack.delete(nodeId);
      return false;
    };

    return hasCycle(destinationId);
  }

  /**
   * Detect all feedback loops
   */
  private detectFeedbackLoops(): string[][] {
    const loops: string[][] = [];
    const visited = new Set<string>();

    const findCycles = (nodeId: string, path: string[]): void => {
      if (path.includes(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        loops.push(path.slice(cycleStart).concat(nodeId));
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      path.push(nodeId);

      const destinations = this.connections.get(nodeId);
      if (destinations) {
        for (const destId of destinations) {
          findCycles(destId, [...path]);
        }
      }
    };

    this.connections.forEach((_, sourceId) => {
      if (!visited.has(sourceId)) {
        findCycles(sourceId, []);
      }
    });

    return loops;
  }

  /**
   * Find route between source and destination
   */
  private findRoute(
    sourceId: string,
    destinationId: string,
  ): Route | undefined {
    return Array.from(this.routes.values()).find(
      (route) =>
        route.sourceId === sourceId && route.destinationId === destinationId,
    );
  }

  /**
   * Get audio node (channel or bus)
   */
  private getAudioNode(nodeId: string): Channel | Bus | undefined {
    return this.channels.get(nodeId) || this.buses.get(nodeId);
  }

  /**
   * Clear all routes
   */
  clear(): void {
    this.routes.forEach((route) => {
      this.disconnectRoute(route);
    });

    this.routes.clear();
    this.connections.clear();
    this.reverseConnections.clear();

    logger.info('All routes cleared');
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.clear();
    this.channels.clear();
    this.buses.clear();
  }
}
