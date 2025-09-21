/**
 * Transport Repository Interface
 *
 * Defines the contract for transport state persistence
 */

import { TransportState } from '../entities/index.js';

export interface ITransportRepository {
  /**
   * Get the current transport state
   */
  get(): Promise<TransportState>;

  /**
   * Save the transport state
   */
  save(state: TransportState): Promise<void>;

  /**
   * Reset to default transport state
   */
  reset(): Promise<void>;

  /**
   * Check if transport state exists
   */
  exists(): Promise<boolean>;
}
