/**
 * EnhancedTrackManagerProcessor - Track-Based Architecture Integration
 * 
 * Extends the existing TrackManagerProcessor to integrate with:
 * - New Track entity system from Task 1
 * - UnifiedTransport master clock
 * - Track lifecycle management
 * - Enhanced dependency resolution
 * 
 * Part of Story 3.21 Task 2 - Track-Based Architecture Migration
 */

import { TrackManagerProcessor, type ManagedTrack, type InstrumentType, type RawMidiTrack } from './TrackManagerProcessor.js';
import { Track } from '../core/Track.js';
import { TrackStateContainer } from '../core/TrackStateContainer.js';
import { UnifiedTransport } from '../core/UnifiedTransport.js';
import type { 
  Track as ITrack, 
  TrackConfig, 
  TrackManager,
  TrackDependency as ITrackDependency,
  TrackSyncConfig,
  TrackMixingState,
  TrackRouting,
  TrackAutomation as ITrackAutomation
} from '../../types/track.js';
import type { Pattern } from '../../types/pattern.js';
import type { MusicalPosition } from '../../types/timing.js';
import { EventBus } from '../core/EventBus.js';
import { serviceRegistry } from '../core/ServiceRegistry.js';
import { PlaybackError, ErrorSeverity } from '../errors/base.js';
import { nanoid } from 'nanoid';

/**
 * Enhanced track manager that bridges the existing MIDI-based system
 * with the new Track entity architecture
 */
export class EnhancedTrackManagerProcessor extends TrackManagerProcessor implements TrackManager {
  // Current tempo from transport
  private currentTempo = 120;
  // Track entity management
  private trackEntities = new Map<string, Track>();
  private trackStateContainers = new Map<string, TrackStateContainer>();
  
  // Transport integration
  private transport: UnifiedTransport;
  private transportListenerId?: string;
  
  // Services
  private eventBus?: EventBus;
  
  // Lifecycle state
  private isInitialized = false;
  private isDisposed = false;
  
  constructor() {
    super();
    
    // Mark as loaded to prevent base class issues
    this.state = 'loaded' as any;
    
    // Get transport instance
    this.transport = UnifiedTransport.getInstance();
    
    // Get services
    try {
      this.eventBus = serviceRegistry.get<EventBus>('eventBus');
    } catch (e) {
      console.warn('EventBus not found in ServiceRegistry');
    }
  }
  
  /**
   * Enhanced initialization with UnifiedTransport integration
   */
  public async initializeEnhanced(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Skip base class initialization - we don't need it for enhanced mode
      // The base class expects a PluginAudioContext which we don't have/need
      
      // Subscribe to transport events
      this.subscribeToTransport();
      
      // Emit initialization event
      this.eventBus?.emit('trackManager:initialized', {
        trackCount: this.trackEntities.size
      });
      
      this.isInitialized = true;
      console.log('✅ EnhancedTrackManagerProcessor initialized');
    } catch (error) {
      throw new PlaybackError(
        `Failed to initialize EnhancedTrackManagerProcessor: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRACK_MANAGER_INIT_FAILED',
        ErrorSeverity.HIGH
      );
    }
  }
  
  /**
   * Subscribe to UnifiedTransport events
   */
  private subscribeToTransport(): void {
    if (!this.eventBus) {
      console.warn('EventBus not available for transport subscription');
      return;
    }
    
    // Listen for transport state changes via EventBus
    this.eventBus.on('transport:state-change', (data: any) => {
      this.handleTransportStateChange(data.state);
    });
    
    // Listen for position updates
    this.eventBus.on('transport:timing-update', (data: any) => {
      this.handleTransportPositionUpdate(data.position);
    });
    
    // Listen for tempo changes
    this.eventBus.on('transport:tempo-change', (data: any) => {
      this.handleTransportTempoChange(data.tempo);
    });
  }
  
  /**
   * Handle transport state changes
   */
  private handleTransportStateChange(state: string): void {
    // Update all tracks based on transport state
    for (const track of this.trackEntities.values()) {
      switch (state) {
        case 'started':
          if (track.state === 'READY') {
            track.state = 'PLAYING';
          }
          break;
        case 'stopped':
          if (track.state === 'PLAYING') {
            track.state = 'READY';
          }
          break;
        case 'paused':
          if (track.state === 'PLAYING') {
            track.state = 'PAUSED';
          }
          break;
      }
    }
    
    this.eventBus?.emit('trackManager:transportStateChanged', { state });
  }
  
  /**
   * Handle transport position updates
   */
  private handleTransportPositionUpdate(position: MusicalPosition): void {
    // This will be used for automation and pattern scheduling
    this.eventBus?.emit('trackManager:positionUpdate', { position });
  }
  
  /**
   * Handle transport tempo changes
   */
  private handleTransportTempoChange(tempo: number): void {
    // Store current tempo
    this.currentTempo = tempo;
    
    this.eventBus?.emit('trackManager:tempoChanged', { tempo });
  }
  
  /**
   * Create a new Track entity from configuration
   */
  public async createTrack(config: TrackConfig): Promise<Track> {
    if (this.isDisposed) {
      throw new PlaybackError(
        'Cannot create track on disposed manager',
        'TRACK_MANAGER_DISPOSED',
        ErrorSeverity.HIGH
      );
    }
    
    // Create track entity
    const track = new Track(config);
    
    // Initialize track
    await track.initialize();
    
    // Create state container
    const stateContainer = new TrackStateContainer(track);
    
    // Store references
    this.trackEntities.set(track.id, track);
    this.trackStateContainers.set(track.id, stateContainer);
    
    // Emit creation event
    this.eventBus?.emit('track:created', {
      trackId: track.id,
      instrumentType: track.instrumentType
    });
    
    return track;
  }
  
  /**
   * Convert ManagedTrack to Track entity
   */
  public async convertToTrackEntity(managedTrack: ManagedTrack): Promise<Track> {
    // Map mixing state
    const mixingState: Partial<TrackMixingState> = {
      volume: managedTrack.mixing.volume,
      pan: managedTrack.mixing.pan,
      mute: managedTrack.mixing.mute,
      solo: managedTrack.mixing.solo
    };
    
    // Map sync configuration
    const syncConfig: Partial<TrackSyncConfig> = {
      quantization: {
        enabled: managedTrack.sync.quantization.enabled,
        gridSize: this.mapQuantizationGrid(managedTrack.sync.quantization.grid),
        strength: managedTrack.sync.quantization.strength,
        swing: managedTrack.sync.quantization.swing
      },
      grooveTemplate: managedTrack.sync.groove.template,
      humanization: managedTrack.sync.groove.humanization,
      priority: managedTrack.sync.priority,
      dependencies: managedTrack.sync.dependencies.map(dep => ({
        trackId: dep.targetTrackId,
        type: this.mapDependencyType(dep.type),
        strength: dep.strength
      }))
    };
    
    // Create track configuration
    const trackConfig: TrackConfig = {
      name: `Track ${managedTrack.id}`,
      instrumentType: managedTrack.instrumentType,
      mixing: mixingState,
      sync: syncConfig
    };
    
    // Create track entity
    const track = await this.createTrack(trackConfig);
    
    // Copy musical data
    if (managedTrack.musicalData.keySignature) {
      track.musical.keySignature = managedTrack.musicalData.keySignature;
    }
    if (managedTrack.musicalData.timeSignature) {
      const [num, den] = managedTrack.musicalData.timeSignature.split('/').map(Number);
      track.musical.timeSignature = { numerator: num, denominator: den };
    }
    if (managedTrack.musicalData.noteRange) {
      track.musical.noteRange = managedTrack.musicalData.noteRange;
    }
    track.musical.velocityRange = {
      min: managedTrack.musicalData.velocity.min,
      max: managedTrack.musicalData.velocity.max
    };
    
    // Map automation
    this.mapAutomation(managedTrack, track);
    
    return track;
  }
  
  /**
   * Process tracks with enhanced Track entity support
   */
  public async processTracksEnhanced(rawTracks: RawMidiTrack[]): Promise<Track[]> {
    // First, process tracks using base class
    const managedTracks = await super.processTracks(rawTracks);
    
    // Convert to Track entities
    const trackEntities: Track[] = [];
    for (const managedTrack of managedTracks) {
      const trackEntity = await this.convertToTrackEntity(managedTrack);
      trackEntities.push(trackEntity);
    }
    
    // Validate dependencies
    this.validateTrackDependencies(trackEntities);
    
    // Setup synchronization with UnifiedTransport
    await this.setupTrackSynchronization(trackEntities);
    
    return trackEntities;
  }
  
  /**
   * Get track by ID
   */
  public getTrack(id: string): Track | undefined {
    return this.trackEntities.get(id);
  }
  
  /**
   * Get all tracks
   */
  public getAllTracks(): Track[] {
    return Array.from(this.trackEntities.values());
  }
  
  /**
   * Update track
   */
  public updateTrack(id: string, updates: Partial<Track>): void {
    const track = this.trackEntities.get(id);
    const stateContainer = this.trackStateContainers.get(id);
    
    if (!track || !stateContainer) {
      throw new PlaybackError(
        `Track ${id} not found`,
        'TRACK_NOT_FOUND',
        ErrorSeverity.MEDIUM
      );
    }
    
    // Use state container for managed updates
    stateContainer.updateState(updates, 'Track update');
  }
  
  /**
   * Delete track
   */
  public async deleteTrack(id: string): Promise<void> {
    const track = this.trackEntities.get(id);
    if (!track) {
      throw new PlaybackError(
        `Track ${id} not found`,
        'TRACK_NOT_FOUND',
        ErrorSeverity.MEDIUM
      );
    }
    
    // Dispose track
    await track.dispose();
    
    // Remove from collections
    this.trackEntities.delete(id);
    this.trackStateContainers.delete(id);
    // Base class map is private, so we can't access it
    
    // Emit deletion event
    this.eventBus?.emit('track:deleted', { trackId: id });
  }
  
  /**
   * Reorder tracks
   */
  public reorderTracks(trackIds: string[]): void {
    let index = 0;
    for (const trackId of trackIds) {
      const track = this.trackEntities.get(trackId);
      if (track) {
        track.index = index++;
      }
    }
    
    this.eventBus?.emit('tracks:reordered', { trackIds });
  }
  
  /**
   * Get tracks by instrument type
   */
  public getTracksByType(type: InstrumentType): Track[] {
    return Array.from(this.trackEntities.values())
      .filter(track => track.instrumentType === type);
  }
  
  /**
   * Validate track dependencies
   */
  public validateDependencies(): boolean {
    const tracks = this.getAllTracks();
    return this.validateTrackDependencies(tracks);
  }
  
  /**
   * Validate dependencies for a set of tracks
   */
  private validateTrackDependencies(tracks: Track[]): boolean {
    const trackIds = new Set(tracks.map(t => t.id));
    
    for (const track of tracks) {
      for (const dep of track.sync.dependencies) {
        // Check if dependency target exists
        if (!trackIds.has(dep.trackId)) {
          console.warn(`Track ${track.id} has dependency on non-existent track ${dep.trackId}`);
          return false;
        }
        
        // Check for circular dependencies
        if (this.hasCircularDependency(track.id, dep.trackId, tracks)) {
          console.warn(`Circular dependency detected between tracks ${track.id} and ${dep.trackId}`);
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Check for circular dependencies
   */
  private hasCircularDependency(
    sourceId: string, 
    targetId: string, 
    tracks: Track[]
  ): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();
    
    const visit = (trackId: string): boolean => {
      if (stack.has(trackId)) {
        return true; // Circular dependency found
      }
      
      if (visited.has(trackId)) {
        return false;
      }
      
      visited.add(trackId);
      stack.add(trackId);
      
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        for (const dep of track.sync.dependencies) {
          if (visit(dep.trackId)) {
            return true;
          }
        }
      }
      
      stack.delete(trackId);
      return false;
    };
    
    return visit(sourceId);
  }
  
  /**
   * Resolve timing dependencies
   */
  public resolveDependencies(): void {
    const tracks = this.getAllTracks();
    
    // Sort tracks by priority and dependencies
    const sortedTracks = this.topologicalSort(tracks);
    
    // Update track indices based on resolved order
    sortedTracks.forEach((track, index) => {
      track.index = index;
    });
    
    this.eventBus?.emit('dependencies:resolved', {
      trackOrder: sortedTracks.map(t => t.id)
    });
  }
  
  /**
   * Topological sort for dependency resolution
   */
  private topologicalSort(tracks: Track[]): Track[] {
    const sorted: Track[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();
    
    const visit = (track: Track): void => {
      if (temp.has(track.id)) {
        throw new PlaybackError(
          'Circular dependency detected',
          'CIRCULAR_DEPENDENCY',
          ErrorSeverity.HIGH
        );
      }
      
      if (visited.has(track.id)) {
        return;
      }
      
      temp.add(track.id);
      
      // Visit dependencies first
      for (const dep of track.sync.dependencies) {
        const depTrack = tracks.find(t => t.id === dep.trackId);
        if (depTrack) {
          visit(depTrack);
        }
      }
      
      temp.delete(track.id);
      visited.add(track.id);
      sorted.push(track);
    };
    
    // Sort by priority first
    const prioritySorted = [...tracks].sort((a, b) => b.sync.priority - a.sync.priority);
    
    // Then apply topological sort
    for (const track of prioritySorted) {
      if (!visited.has(track.id)) {
        visit(track);
      }
    }
    
    return sorted;
  }
  
  /**
   * Setup track synchronization with UnifiedTransport
   */
  private async setupTrackSynchronization(tracks: Track[]): Promise<void> {
    // Register tracks with transport's scheduling system
    for (const track of tracks) {
      // This will be implemented in Task 3 with PatternScheduler enhancement
      this.eventBus?.emit('track:readyForScheduling', {
        trackId: track.id,
        instrumentType: track.instrumentType,
        priority: track.sync.priority
      });
    }
  }
  
  /**
   * Map quantization grid values
   */
  private mapQuantizationGrid(grid: string): '1/4' | '1/8' | '1/16' | '1/32' | 'triplet' {
    switch (grid) {
      case 'quarter': return '1/4';
      case 'eighth': return '1/8';
      case 'sixteenth': return '1/16';
      case 'thirtysecond': return '1/32';
      case 'triplet': return 'triplet';
      default: return '1/16';
    }
  }
  
  /**
   * Map dependency type
   */
  private mapDependencyType(type: string): 'follow' | 'avoid' | 'sync' | 'trigger' {
    switch (type) {
      case 'rhythm': return 'sync';
      case 'harmony': return 'follow';
      case 'tempo': return 'sync';
      default: return 'sync';
    }
  }
  
  /**
   * Map automation from ManagedTrack to Track
   */
  private mapAutomation(managedTrack: ManagedTrack, track: Track): void {
    // Map volume automation
    if (managedTrack.automation.volume.length > 0) {
      track.addAutomation({
        parameter: 'volume',
        points: managedTrack.automation.volume.map(point => ({
          position: this.timeToMusicalPosition(point.time),
          value: point.value
        })),
        mode: 'read',
        curveType: 'linear'
      });
    }
    
    // Map pan automation
    if (managedTrack.automation.pan.length > 0) {
      track.addAutomation({
        parameter: 'pan',
        points: managedTrack.automation.pan.map(point => ({
          position: this.timeToMusicalPosition(point.time),
          value: point.value
        })),
        mode: 'read',
        curveType: 'linear'
      });
    }
  }
  
  /**
   * Convert time to musical position
   */
  private timeToMusicalPosition(time: number): MusicalPosition {
    // This is a simplified conversion - would use transport's actual conversion
    const beatsPerBar = 4;
    const totalBeats = (time * this.currentTempo) / 60;
    const bars = Math.floor(totalBeats / beatsPerBar) + 1;
    const beats = Math.floor(totalBeats % beatsPerBar) + 1;
    const sixteenths = Math.floor((totalBeats % 1) * 4);
    const ticks = Math.floor(((totalBeats % 1) * 4 % 1) * 960);
    
    return { bars, beats, sixteenths, ticks };
  }
  
  /**
   * Dispose and cleanup
   */
  public async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }
    
    try {
      // Event subscriptions are automatically cleaned up when EventBus is destroyed
      
      // Dispose all tracks
      for (const track of this.trackEntities.values()) {
        await track.dispose();
      }
      
      // Clear collections
      this.trackEntities.clear();
      this.trackStateContainers.clear();
      
      this.isDisposed = true;
      
      this.eventBus?.emit('trackManager:disposed', {});
    } catch (error) {
      throw new PlaybackError(
        `Failed to dispose EnhancedTrackManagerProcessor: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRACK_MANAGER_DISPOSE_FAILED',
        ErrorSeverity.MEDIUM
      );
    }
  }
}