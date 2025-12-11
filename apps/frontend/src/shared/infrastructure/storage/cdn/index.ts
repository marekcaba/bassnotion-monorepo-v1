/**
 * CDN Infrastructure Module
 *
 * Provides generic CDN functionality that can be used
 * by all domains in the application
 */

export type { ICDNService, GeolocationCoordinates } from './ICDNService.js';
export { CDNService } from './CDNService.js';
export { EdgeLocationManager } from './EdgeLocationManager.js';
