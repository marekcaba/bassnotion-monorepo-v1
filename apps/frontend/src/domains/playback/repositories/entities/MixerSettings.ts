/**
 * Mixer Settings Entity
 *
 * Represents the global mixer configuration and routing.
 * Encapsulates mixer state and business logic.
 */

import { TrackId, Volume } from '../value-objects/index.js';

export interface BusConfig {
  id: string;
  name: string;
  volume: Volume;
  isMuted: boolean;
  sends: Array<{
    targetBusId: string;
    level: Volume;
  }>;
}

export interface MixerSettingsProps {
  masterVolume: Volume;
  masterLimiterEnabled: boolean;
  masterLimiterThreshold: number; // in dB
  soloMode: 'exclusive' | 'additive';
  buses: BusConfig[];
  trackRouting: Map<string, string>; // trackId -> busId
  globalMute: boolean;
  dim: boolean;
  dimLevel: Volume;
  createdAt: Date;
  updatedAt: Date;
}

export class MixerSettings {
  private constructor(private props: MixerSettingsProps) {}

  /**
   * Create default mixer settings
   */
  static createDefault(): MixerSettings {
    const now = new Date();
    return new MixerSettings({
      masterVolume: Volume.create(0.75),
      masterLimiterEnabled: true,
      masterLimiterThreshold: -0.3, // -0.3 dB
      soloMode: 'exclusive',
      buses: [
        {
          id: 'master',
          name: 'Master',
          volume: Volume.full(),
          isMuted: false,
          sends: [],
        },
      ],
      trackRouting: new Map(),
      globalMute: false,
      dim: false,
      dimLevel: Volume.create(0.5),
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstitute from persistence
   */
  static reconstitute(props: MixerSettingsProps): MixerSettings {
    return new MixerSettings(props);
  }

  // Getters
  get masterVolume(): Volume {
    return this.props.masterVolume;
  }
  get masterLimiterEnabled(): boolean {
    return this.props.masterLimiterEnabled;
  }
  get masterLimiterThreshold(): number {
    return this.props.masterLimiterThreshold;
  }
  get soloMode(): 'exclusive' | 'additive' {
    return this.props.soloMode;
  }
  get buses(): BusConfig[] {
    return [...this.props.buses];
  }
  get globalMute(): boolean {
    return this.props.globalMute;
  }
  get dim(): boolean {
    return this.props.dim;
  }
  get dimLevel(): Volume {
    return this.props.dimLevel;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Business Logic Methods
   */

  /**
   * Get effective master volume (considering mute and dim)
   */
  getEffectiveMasterVolume(): Volume {
    if (this.globalMute) {
      return Volume.silence();
    }

    let volume = this.masterVolume;
    if (this.dim) {
      volume = volume.applyGain(this.dimLevel.value);
    }

    return volume;
  }

  /**
   * Check if any bus is soloed
   */
  hasAnySolo(): boolean {
    // This would need to check track solo states
    // For now, return false as buses don't have solo
    return false;
  }

  /**
   * Get bus by ID
   */
  getBus(busId: string): BusConfig | undefined {
    return this.props.buses.find((bus) => bus.id === busId);
  }

  /**
   * Get master bus
   */
  getMasterBus(): BusConfig {
    const master = this.getBus('master');
    if (!master) {
      throw new Error('Master bus not found');
    }
    return master;
  }

  /**
   * Get track routing
   */
  getTrackRouting(trackId: TrackId): string {
    return this.props.trackRouting.get(trackId.value) || 'master';
  }

  /**
   * Check if bus exists
   */
  hasBus(busId: string): boolean {
    return this.props.buses.some((bus) => bus.id === busId);
  }

  /**
   * Check if bus name is unique
   */
  isBusNameUnique(name: string, excludeId?: string): boolean {
    return !this.props.buses.some(
      (bus) =>
        bus.name.toLowerCase() === name.toLowerCase() && bus.id !== excludeId,
    );
  }

  /**
   * Validate bus routing (check for circular dependencies)
   */
  private validateBusRouting(busId: string, targetBusId: string): void {
    if (busId === targetBusId) {
      throw new Error('Bus cannot send to itself');
    }

    // Check for circular routing
    const visited = new Set<string>();
    let current = targetBusId;

    while (current) {
      if (visited.has(current)) {
        throw new Error('Circular bus routing detected');
      }
      visited.add(current);

      const bus = this.getBus(current);
      if (!bus || bus.sends.length === 0) break;

      // For simplicity, check only first send
      const nextBusId = bus.sends[0]?.targetBusId;
      if (!nextBusId) break;
      current = nextBusId;
    }
  }

  /**
   * Mutation Methods
   */

  /**
   * Set master volume
   */
  setMasterVolume(volume: Volume): void {
    if (volume.equals(this.props.masterVolume)) return;

    this.props.masterVolume = volume;
    this.props.updatedAt = new Date();
  }

  /**
   * Set master limiter state
   */
  setMasterLimiter(enabled: boolean, threshold?: number): void {
    if (threshold !== undefined) {
      if (threshold > 0 || threshold < -60) {
        throw new Error('Limiter threshold must be between -60 and 0 dB');
      }
    }

    this.props.masterLimiterEnabled = enabled;
    if (threshold !== undefined) {
      this.props.masterLimiterThreshold = threshold;
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Set solo mode
   */
  setSoloMode(mode: 'exclusive' | 'additive'): void {
    if (mode === this.props.soloMode) return;

    this.props.soloMode = mode;
    this.props.updatedAt = new Date();
  }

  /**
   * Add a new bus
   */
  addBus(name: string): string {
    if (!this.isBusNameUnique(name)) {
      throw new Error(`Bus name "${name}" already exists`);
    }

    const busId = `bus_${Date.now()}`;
    const newBus: BusConfig = {
      id: busId,
      name,
      volume: Volume.default(),
      isMuted: false,
      sends: [],
    };

    this.props.buses.push(newBus);
    this.props.updatedAt = new Date();

    return busId;
  }

  /**
   * Remove a bus
   */
  removeBus(busId: string): void {
    if (busId === 'master') {
      throw new Error('Cannot remove master bus');
    }

    const index = this.props.buses.findIndex((bus) => bus.id === busId);
    if (index === -1) {
      throw new Error(`Bus ${busId} not found`);
    }

    // Remove the bus
    this.props.buses.splice(index, 1);

    // Update track routing to redirect to master
    for (const [trackId, routedBusId] of this.props.trackRouting) {
      if (routedBusId === busId) {
        this.props.trackRouting.set(trackId, 'master');
      }
    }

    // Remove sends to this bus
    this.props.buses.forEach((bus) => {
      bus.sends = bus.sends.filter((send) => send.targetBusId !== busId);
    });

    this.props.updatedAt = new Date();
  }

  /**
   * Update bus configuration
   */
  updateBus(busId: string, updates: Partial<Omit<BusConfig, 'id'>>): void {
    const bus = this.props.buses.find((b) => b.id === busId);
    if (!bus) {
      throw new Error(`Bus ${busId} not found`);
    }

    if (updates.name && updates.name !== bus.name) {
      if (!this.isBusNameUnique(updates.name, busId)) {
        throw new Error(`Bus name "${updates.name}" already exists`);
      }
      bus.name = updates.name;
    }

    if (updates.volume) {
      bus.volume = updates.volume;
    }

    if (updates.isMuted !== undefined) {
      bus.isMuted = updates.isMuted;
    }

    if (updates.sends) {
      // Validate sends
      updates.sends.forEach((send) => {
        this.validateBusRouting(busId, send.targetBusId);
      });
      bus.sends = updates.sends;
    }

    this.props.updatedAt = new Date();
  }

  /**
   * Route track to bus
   */
  routeTrackToBus(trackId: TrackId, busId: string): void {
    if (!this.hasBus(busId)) {
      throw new Error(`Bus ${busId} not found`);
    }

    const currentRouting = this.props.trackRouting.get(trackId.value);
    if (currentRouting === busId) return;

    this.props.trackRouting.set(trackId.value, busId);
    this.props.updatedAt = new Date();
  }

  /**
   * Toggle global mute
   */
  toggleGlobalMute(): void {
    this.props.globalMute = !this.props.globalMute;
    this.props.updatedAt = new Date();
  }

  /**
   * Set global mute
   */
  setGlobalMute(muted: boolean): void {
    if (muted !== this.props.globalMute) {
      this.props.globalMute = muted;
      this.props.updatedAt = new Date();
    }
  }

  /**
   * Toggle dim
   */
  toggleDim(): void {
    this.props.dim = !this.props.dim;
    this.props.updatedAt = new Date();
  }

  /**
   * Set dim
   */
  setDim(enabled: boolean, level?: Volume): void {
    this.props.dim = enabled;
    if (level) {
      this.props.dimLevel = level;
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Reset to default settings
   */
  reset(): void {
    const defaults = MixerSettings.createDefault();
    this.props.masterVolume = defaults.masterVolume;
    this.props.masterLimiterEnabled = defaults.masterLimiterEnabled;
    this.props.masterLimiterThreshold = defaults.masterLimiterThreshold;
    this.props.soloMode = defaults.soloMode;
    this.props.buses = defaults.buses;
    this.props.trackRouting.clear();
    this.props.globalMute = false;
    this.props.dim = false;
    this.props.dimLevel = defaults.dimLevel;
    this.props.updatedAt = new Date();
  }

  /**
   * Convert to persistence format
   */
  toPersistence(): MixerSettingsProps {
    return {
      ...this.props,
      trackRouting: new Map(this.props.trackRouting),
    };
  }
}
