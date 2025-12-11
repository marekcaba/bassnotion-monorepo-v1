/**
 * Security Monitor
 * Story 2.4 Subtask 1.2: Security monitoring and incident tracking
 *
 * Extracted from playback domain to shared infrastructure
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  AuthenticationMetrics,
  DeviceInfo,
  LocationInfo,
  AuthenticationEvent,
  SecurityIncident,
} from '@bassnotion/contracts';

const logger = createStructuredLogger('SecurityMonitor');

export interface SecurityMonitoringConfig {
  enabled: boolean;
  trackLocation: boolean;
  trackDeviceChanges: boolean;
  suspiciousActivityThreshold: number;
  incidentReportingEnabled: boolean;
}

export class SecurityMonitor {
  private config: SecurityMonitoringConfig;
  private metrics: AuthenticationMetrics;
  private events: AuthenticationEvent[] = [];
  private incidents: SecurityIncident[] = [];
  private deviceInfo: DeviceInfo;
  private locationInfo?: LocationInfo;

  constructor(
    config: SecurityMonitoringConfig,
    metrics: AuthenticationMetrics,
  ) {
    this.config = config;
    this.metrics = metrics;
    this.deviceInfo = this.generateDeviceInfo();
    this.initializeLocationTracking();
  }

  /**
   * Generate device information for security tracking
   */
  private generateDeviceInfo(): DeviceInfo {
    // Handle Node.js test environment
    if (typeof navigator === 'undefined') {
      return {
        userAgent: 'test-environment',
        platform: 'test',
        deviceId: 'test-device-id',
        browserFingerprint: 'test-fingerprint',
        screenResolution: '1920x1080',
        timezone: 'UTC',
      };
    }

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      deviceId:
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('bassnotion-device-id') || 'unknown'
          : 'test-device-id',
      browserFingerprint: this.generateBrowserFingerprint(),
      screenResolution:
        typeof screen !== 'undefined'
          ? `${screen.width}x${screen.height}`
          : '1920x1080',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * Generate browser fingerprint
   */
  private generateBrowserFingerprint(): string {
    // Handle test environment
    if (typeof document === 'undefined') {
      return 'test-fingerprint';
    }

    try {
      if (typeof HTMLCanvasElement === 'undefined') {
        return (
          'test-canvas-fingerprint-' + Math.random().toString(36).substr(2, 9)
        );
      }

      const canvas = document.createElement('canvas');
      if (!canvas || typeof canvas.getContext !== 'function') {
        return (
          'test-canvas-fingerprint-' + Math.random().toString(36).substr(2, 9)
        );
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('BassNotion', 2, 2);
      }

      if (typeof canvas.toDataURL === 'function') {
        const dataUrl = canvas.toDataURL();
        if (dataUrl && dataUrl !== 'data:,' && dataUrl !== 'data:') {
          return dataUrl.slice(-50);
        }
      }

      return 'fallback-fingerprint-' + Math.random().toString(36).substr(2, 9);
    } catch (error) {
      logger.warn('Canvas fingerprint generation failed', error);
      return 'fallback-fingerprint-' + Math.random().toString(36).substr(2, 9);
    }
  }

  /**
   * Initialize location tracking if enabled
   */
  private async initializeLocationTracking(): Promise<void> {
    if (!this.config.trackLocation || typeof navigator === 'undefined') {
      return;
    }

    try {
      // In real implementation, this would use a geolocation API
      // For now, we'll use a placeholder
      this.locationInfo = {
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        ipAddress: 'unknown',
      };
    } catch (error) {
      logger.warn('Failed to initialize location tracking', error);
    }
  }

  /**
   * Track authentication event
   */
  trackEvent(event: Omit<AuthenticationEvent, 'id' | 'timestamp'>): void {
    const fullEvent: AuthenticationEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...event,
    };

    this.events.push(fullEvent);
    logger.info('Security event tracked', fullEvent);

    // Check for suspicious activity
    this.analyzeSuspiciousActivity(fullEvent);

    // Maintain event history limit
    if (this.events.length > 1000) {
      this.events = this.events.slice(-500);
    }
  }

  /**
   * Analyze event for suspicious activity
   */
  private analyzeSuspiciousActivity(event: AuthenticationEvent): void {
    // Check for rapid failed attempts
    const recentFailures = this.events.filter(
      (e) =>
        e.type === 'AUTH_FAILURE' &&
        e.timestamp.getTime() > Date.now() - 300000, // Last 5 minutes
    );

    if (recentFailures.length >= this.config.suspiciousActivityThreshold) {
      this.createIncident(
        'SUSPICIOUS_ACCESS',
        'Multiple authentication failures detected',
        { recentFailures },
      );
    }

    // Check for device changes
    if (this.config.trackDeviceChanges && event.deviceInfo) {
      const deviceChanged = this.checkDeviceChange(event.deviceInfo);
      if (deviceChanged) {
        this.createIncident(
          'DEVICE_CHANGE',
          'Authentication from new device detected',
          { newDevice: event.deviceInfo, previousDevice: this.deviceInfo },
        );
      }
    }

    // Check for location changes
    if (this.config.trackLocation && event.location) {
      const locationChanged = this.checkLocationChange(event.location);
      if (locationChanged) {
        this.createIncident(
          'LOCATION_CHANGE',
          'Authentication from new location detected',
          { newLocation: event.location, previousLocation: this.locationInfo },
        );
      }
    }
  }

  /**
   * Check if device has changed significantly
   */
  private checkDeviceChange(newDevice: DeviceInfo): boolean {
    return (
      newDevice.browserFingerprint !== this.deviceInfo.browserFingerprint ||
      newDevice.platform !== this.deviceInfo.platform
    );
  }

  /**
   * Check if location has changed significantly
   */
  private checkLocationChange(newLocation: LocationInfo): boolean {
    if (!this.locationInfo) return true;

    // Check if country or region changed
    return (
      newLocation.country !== this.locationInfo.country ||
      newLocation.region !== this.locationInfo.region
    );
  }

  /**
   * Create security incident
   */
  private createIncident(
    type: SecurityIncident['type'],
    description: string,
    details?: any,
  ): void {
    const incident: SecurityIncident = {
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      timestamp: new Date(),
      deviceInfo: this.deviceInfo,
      location: this.locationInfo,
      resolved: false,
      severity: this.calculateSeverity(type),
      details,
    };

    this.incidents.push(incident);
    this.metrics.securityIncidents++;
    this.updateSuspiciousActivityScore();

    logger.warn('Security incident created', incident);

    if (this.config.incidentReportingEnabled) {
      this.reportIncident(incident);
    }
  }

  /**
   * Calculate incident severity
   */
  private calculateSeverity(
    type: SecurityIncident['type'],
  ): SecurityIncident['severity'] {
    switch (type) {
      case 'SUSPICIOUS_ACCESS':
        return 'high';
      case 'TOKEN_THEFT':
        return 'critical';
      case 'SESSION_HIJACK':
        return 'critical';
      case 'BRUTE_FORCE':
        return 'high';
      case 'DEVICE_CHANGE':
        return 'medium';
      case 'LOCATION_CHANGE':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Update suspicious activity score
   */
  private updateSuspiciousActivityScore(): void {
    const recentIncidents = this.incidents.filter(
      (i) => i.timestamp.getTime() > Date.now() - 86400000, // Last 24 hours
    );

    let score = 0;
    for (const incident of recentIncidents) {
      switch (incident.severity) {
        case 'critical':
          score += 100;
          break;
        case 'high':
          score += 50;
          break;
        case 'medium':
          score += 20;
          break;
        case 'low':
          score += 10;
          break;
      }
    }

    this.metrics.suspiciousActivityScore = Math.min(score, 1000);
  }

  /**
   * Report incident (would send to monitoring service in production)
   */
  private reportIncident(incident: SecurityIncident): void {
    logger.error('SECURITY INCIDENT REPORT', incident);
    // In production, this would send to a security monitoring service
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 100): AuthenticationEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get unresolved incidents
   */
  getUnresolvedIncidents(): SecurityIncident[] {
    return this.incidents.filter((i) => !i.resolved);
  }

  /**
   * Resolve incident
   */
  resolveIncident(incidentId: string, resolution?: string): void {
    const incident = this.incidents.find((i) => i.id === incidentId);
    if (incident) {
      incident.resolved = true;
      incident.resolutionTime = new Date();
      incident.resolution = resolution;
      logger.info('Security incident resolved', { incidentId, resolution });
    }
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): {
    totalEvents: number;
    totalIncidents: number;
    unresolvedIncidents: number;
    suspiciousActivityScore: number;
  } {
    return {
      totalEvents: this.events.length,
      totalIncidents: this.incidents.length,
      unresolvedIncidents: this.incidents.filter((i) => !i.resolved).length,
      suspiciousActivityScore: this.metrics.suspiciousActivityScore,
    };
  }

  /**
   * Clear old events and incidents
   */
  cleanup(): void {
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days

    this.events = this.events.filter((e) => e.timestamp.getTime() > cutoffTime);

    this.incidents = this.incidents.filter(
      (i) => i.timestamp.getTime() > cutoffTime || !i.resolved,
    );

    logger.info('Security monitor cleanup completed', {
      remainingEvents: this.events.length,
      remainingIncidents: this.incidents.length,
    });
  }
}
