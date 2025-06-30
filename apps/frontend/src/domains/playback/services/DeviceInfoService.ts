/**
 * DeviceInfoService - Abstraction layer for device information
 *
 * Provides a testable interface for accessing Navigator and Performance APIs
 * while handling cross-browser compatibility and providing sensible defaults.
 */

export interface DeviceInfo {
  userAgent: string;
  hardwareConcurrency: number;
  deviceMemory?: number;
  platform: string;
  onLine: boolean;
  connection?: NetworkConnection;
  battery?: BatteryInfo;
}

export interface NetworkConnection {
  effectiveType?: string;
  type?: string;
  downlink?: number;
  rtt?: number;
}

export interface BatteryInfo {
  level: number;
  charging: boolean;
  chargingTime?: number;
  dischargingTime?: number;
}

export interface PerformanceInfo {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  timing?: PerformanceTiming;
}

/**
 * Service for accessing device information in a testable way
 */
export class DeviceInfoService {
  private static instance: DeviceInfoService | null = null;

  private mockDeviceInfo: Partial<DeviceInfo> | null = null;

  private mockPerformanceInfo: Partial<PerformanceInfo> | null = null;

  public static getInstance(): DeviceInfoService {
    if (!DeviceInfoService.instance) {
      DeviceInfoService.instance = new DeviceInfoService();
    }
    return DeviceInfoService.instance;
  }

  /**
   * For testing: Set mock device information
   */
  public setMockDeviceInfo(mockInfo: Partial<DeviceInfo>): void {
    this.mockDeviceInfo = mockInfo;
  }

  /**
   * For testing: Set mock performance information
   */
  public setMockPerformanceInfo(mockInfo: Partial<PerformanceInfo>): void {
    this.mockPerformanceInfo = mockInfo;
  }

  /**
   * Clear all mocks (for testing cleanup)
   */
  public clearMocks(): void {
    this.mockDeviceInfo = null;
    this.mockPerformanceInfo = null;
  }

  /**
   * Get device information
   */
  public getDeviceInfo(): DeviceInfo {
    if (this.mockDeviceInfo) {
      return {
        userAgent: 'Mozilla/5.0 (Test Device)',
        hardwareConcurrency: 8,
        deviceMemory: 8,
        platform: 'desktop',
        onLine: true,
        ...this.mockDeviceInfo,
      };
    }

    const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);

    return {
      userAgent: nav.userAgent || 'Unknown',
      hardwareConcurrency: nav.hardwareConcurrency || 4,
      deviceMemory: nav.deviceMemory,
      platform: nav.platform || 'unknown',
      onLine: typeof nav.onLine === 'boolean' ? nav.onLine : true,
      connection: nav.connection
        ? {
            effectiveType: nav.connection.effectiveType,
            type: nav.connection.type,
            downlink: nav.connection.downlink,
            rtt: nav.connection.rtt,
          }
        : undefined,
    };
  }

  /**
   * Get battery information (async due to getBattery API)
   */
  public async getBatteryInfo(): Promise<BatteryInfo | null> {
    if (this.mockDeviceInfo?.battery) {
      return this.mockDeviceInfo.battery;
    }

    try {
      const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);
      if (nav.getBattery) {
        const battery = await nav.getBattery();
        return {
          level: battery.level || 1.0,
          charging: battery.charging || false,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
        };
      }
    } catch {
      // Battery API not available or access denied
    }

    return null;
  }

  /**
   * Get performance information
   */
  public getPerformanceInfo(): PerformanceInfo {
    if (this.mockPerformanceInfo) {
      return {
        memory: {
          usedJSHeapSize: 50 * 1024 * 1024,
          totalJSHeapSize: 80 * 1024 * 1024,
          jsHeapSizeLimit: 100 * 1024 * 1024,
        },
        ...this.mockPerformanceInfo,
      };
    }

    const perf = typeof performance !== 'undefined' ? performance : ({} as any);

    return {
      memory: perf.memory
        ? {
            usedJSHeapSize: perf.memory.usedJSHeapSize || 0,
            totalJSHeapSize: perf.memory.totalJSHeapSize || 0,
            jsHeapSizeLimit: perf.memory.jsHeapSizeLimit || 0,
          }
        : undefined,
      timing: perf.timing,
    };
  }

  /**
   * Check if device is mobile based on user agent
   */
  public isMobile(): boolean {
    const deviceInfo = this.getDeviceInfo();
    const userAgent = deviceInfo.userAgent.toLowerCase();
    return (
      userAgent.includes('mobile') ||
      userAgent.includes('android') ||
      userAgent.includes('iphone')
    );
  }

  /**
   * Check if device is tablet based on user agent
   */
  public isTablet(): boolean {
    const deviceInfo = this.getDeviceInfo();
    const userAgent = deviceInfo.userAgent.toLowerCase();
    return userAgent.includes('tablet') || userAgent.includes('ipad');
  }

  /**
   * Check if device is low-end based on hardware capabilities
   */
  public isLowEndDevice(): boolean {
    const deviceInfo = this.getDeviceInfo();
    return (
      deviceInfo.hardwareConcurrency <= 2 ||
      (deviceInfo.deviceMemory !== undefined && deviceInfo.deviceMemory <= 2)
    );
  }

  /**
   * Get network speed estimation
   */
  public getNetworkSpeed(): 'slow' | 'medium' | 'fast' | 'unknown' {
    const deviceInfo = this.getDeviceInfo();
    const connection = deviceInfo.connection;

    if (!connection) return 'unknown';

    const effectiveType = connection.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
    if (effectiveType === '3g') return 'medium';
    if (effectiveType === '4g') return 'fast';

    return 'medium'; // Default fallback
  }

  /**
   * Get hardware concurrency (number of CPU cores)
   */
  public getHardwareConcurrency(): number {
    const deviceInfo = this.getDeviceInfo();
    return deviceInfo.hardwareConcurrency;
  }

  /**
   * For testing: Reset singleton instance
   */
  public static resetInstance(): void {
    DeviceInfoService.instance = null;
  }
}

export default DeviceInfoService;
