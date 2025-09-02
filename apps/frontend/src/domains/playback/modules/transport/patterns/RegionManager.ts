/**
 * Region Manager
 * 
 * Manages track regions and their activation state for pattern scheduling.
 * Handles region bounds checking and lifecycle management.
 */

import type { Region } from '../../../types/region';
import type { MusicalPosition } from '../types';
import type { ScheduledRegion, RegionActivationState } from './types';
import {
  compareMusicalPositions,
  addMusicalTime,
  subtractMusicalTime,
} from '../../../utils/regionUtils';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('RegionManager');

export class RegionManager {
  private trackRegions = new Map<string, Region[]>();
  private activeRegions = new Map<string, ScheduledRegion>();
  private activationStates = new Map<string, RegionActivationState>();
  
  /**
   * Register regions for a track
   */
  registerTrack(trackId: string, regions: Region[]): void {
    this.trackRegions.set(trackId, regions);
    
    logger.info(`Registered ${regions.length} regions for track ${trackId}`);
    
    // Log region details
    regions.forEach(region => {
      logger.info(`  - Region ${region.id}: start=${JSON.stringify(region.startPosition)}, duration=${JSON.stringify(region.duration)}, muted=${region.muted}`);
    });
  }
  
  /**
   * Unregister a track and clean up its regions
   */
  unregisterTrack(trackId: string): void {
    this.trackRegions.delete(trackId);
    
    // Clean up active regions for this track
    const keysToDelete: string[] = [];
    for (const [key, scheduledRegion] of this.activeRegions) {
      if (scheduledRegion.trackId === trackId) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.activeRegions.delete(key);
      this.activationStates.delete(key);
    });
    
    logger.info(`Unregistered track ${trackId} and cleaned up ${keysToDelete.length} active regions`);
  }
  
  /**
   * Update regions for a track
   */
  updateTrackRegions(trackId: string, regions: Region[]): void {
    logger.info(`Updating track ${trackId} with ${regions.length} regions`);
    
    if (regions.length > 0) {
      this.trackRegions.set(trackId, regions);
    } else {
      this.trackRegions.delete(trackId);
    }
    
    // Clean up active regions for this track
    const keysToDelete: string[] = [];
    for (const [key, scheduledRegion] of this.activeRegions) {
      if (scheduledRegion.trackId === trackId) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.activeRegions.delete(key);
      this.activationStates.delete(key);
    });
    
    logger.info(`Updated regions for track ${trackId}, cleaned ${keysToDelete.length} active regions`);
  }
  
  /**
   * Check if a position is within a region's bounds
   */
  isPositionInRegion(
    region: Region,
    currentPosition: MusicalPosition,
    tempo: number
  ): {
    isInRegion: boolean;
    loopIteration?: number;
    positionInLoop?: number;
  } {
    const startPos = region.startPosition || `0:${region.startTime || 0}:0`;
    const duration = typeof region.duration === 'number' 
      ? `0:${region.duration}:0` 
      : region.duration;
    
    // For looping regions
    if (region.loopCount === 0 || region.loopCount > 1) {
      const timeSinceStart = subtractMusicalTime(currentPosition, startPos);
      const loopDurationBeats = this.musicalPositionToBeats(duration);
      const timeSinceStartBeats = this.musicalPositionToBeats(timeSinceStart);
      
      if (timeSinceStartBeats >= 0 && loopDurationBeats > 0) {
        const currentLoopIndex = Math.floor(timeSinceStartBeats / loopDurationBeats);
        
        // Check if within valid loop count
        if (region.loopCount === 0 || currentLoopIndex < region.loopCount) {
          const positionInLoop = timeSinceStartBeats % loopDurationBeats;
          const isInRegion = positionInLoop >= 0 && positionInLoop < loopDurationBeats;
          
          return {
            isInRegion,
            loopIteration: currentLoopIndex,
            positionInLoop,
          };
        }
      }
    } else {
      // Single play region
      const endPos = addMusicalTime(startPos, duration);
      const isInRegion = 
        compareMusicalPositions(currentPosition, startPos) >= 0 &&
        compareMusicalPositions(currentPosition, endPos) < 0;
      
      return { isInRegion, loopIteration: 0 };
    }
    
    return { isInRegion: false };
  }
  
  /**
   * Get regions for a track
   */
  getTrackRegions(trackId: string): Region[] {
    return this.trackRegions.get(trackId) || [];
  }
  
  /**
   * Get all registered tracks
   */
  getRegisteredTracks(): string[] {
    return Array.from(this.trackRegions.keys());
  }
  
  /**
   * Get active scheduled region
   */
  getActiveRegion(regionKey: string): ScheduledRegion | undefined {
    return this.activeRegions.get(regionKey);
  }
  
  /**
   * Set active scheduled region
   */
  setActiveRegion(regionKey: string, scheduledRegion: ScheduledRegion): void {
    this.activeRegions.set(regionKey, scheduledRegion);
    
    // Track activation state
    const activationState: RegionActivationState = {
      regionKey,
      isActive: true,
      activationTime: Date.now(),
      lastEventTime: scheduledRegion.lastScheduledTime,
      completedLoops: 0,
    };
    
    this.activationStates.set(regionKey, activationState);
  }
  
  /**
   * Remove active region
   */
  removeActiveRegion(regionKey: string): void {
    this.activeRegions.delete(regionKey);
    this.activationStates.delete(regionKey);
  }
  
  /**
   * Get all active regions
   */
  getActiveRegions(): Map<string, ScheduledRegion> {
    return new Map(this.activeRegions);
  }
  
  /**
   * Clear all active regions
   */
  clearActiveRegions(): void {
    this.activeRegions.clear();
    this.activationStates.clear();
    logger.info('Cleared all active regions');
  }
  
  /**
   * Get activation states
   */
  getActivationStates(): Map<string, RegionActivationState> {
    return new Map(this.activationStates);
  }
  
  /**
   * Create region key for identification
   */
  createRegionKey(trackId: string, regionId: string): string {
    return `${trackId}-${regionId}`;
  }
  
  /**
   * Parse region key back to trackId and regionId
   */
  parseRegionKey(regionKey: string): { trackId: string; regionId: string } {
    const parts = regionKey.split('-');
    const regionId = parts.pop() || '';
    const trackId = parts.join('-');
    return { trackId, regionId };
  }
  
  /**
   * Convert musical position to beats
   */
  private musicalPositionToBeats(position: MusicalPosition): number {
    // Handle both string and object formats
    if (typeof position === 'string') {
      const parts = position.split(':');
      const bars = parseInt(parts[0] || '0', 10);
      const beats = parseInt(parts[1] || '0', 10);
      const sixteenths = parseInt(parts[2] || '0', 10);
      return bars * 4 + beats + sixteenths / 4;
    }
    
    // Object format
    if (typeof position === 'object' && position !== null) {
      const bars = (position as any).bars || 0;
      const beats = (position as any).beats || 0;
      const sixteenths = (position as any).sixteenths || 0;
      return bars * 4 + beats + sixteenths / 4;
    }
    
    return 0;
  }
  
  /**
   * Get statistics about managed regions
   */
  getRegionStats(): {
    totalTracks: number;
    totalRegions: number;
    activeRegions: number;
    regionsByTrack: Map<string, number>;
  } {
    const regionsByTrack = new Map<string, number>();
    let totalRegions = 0;
    
    for (const [trackId, regions] of this.trackRegions) {
      regionsByTrack.set(trackId, regions.length);
      totalRegions += regions.length;
    }
    
    return {
      totalTracks: this.trackRegions.size,
      totalRegions,
      activeRegions: this.activeRegions.size,
      regionsByTrack,
    };
  }
}