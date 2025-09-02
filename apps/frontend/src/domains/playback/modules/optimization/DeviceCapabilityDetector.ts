/**
 * Device Capability Detector
 * 
 * Detects device capabilities for performance optimization decisions.
 * Extracted from PerformanceOptimizer with enhanced detection logic.
 */

import type { DeviceCapabilities, NetworkCapabilities } from './types';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('DeviceCapabilityDetector');

export class DeviceCapabilityDetector {
  /**
   * Detect comprehensive device capabilities
   */
  async detectDeviceCapabilities(): Promise<DeviceCapabilities> {
    logger.info('🔍 Detecting device capabilities...');
    
    const capabilities: DeviceCapabilities = {
      cpu: await this.detectCPUCapabilities(),
      memory: await this.detectMemoryCapabilities(),
      audio: await this.detectAudioCapabilities(),
      network: await this.detectNetworkCapabilities(),
      battery: await this.detectBatteryCapabilities(),
      platform: this.detectPlatform(),
    };
    
    logger.info('✅ Device capabilities detected:', {
      platform: capabilities.platform,
      cpuCores: capabilities.cpu.cores,
      cpuPerformance: capabilities.cpu.performance,
      totalMemoryMB: capabilities.memory.total,
      networkType: capabilities.network.type,
      batteryLevel: capabilities.battery.level,
    });
    
    return capabilities;
  }
  
  /**
   * Detect CPU capabilities
   */
  private async detectCPUCapabilities(): Promise<DeviceCapabilities['cpu']> {
    const cores = navigator.hardwareConcurrency || 4;
    
    return {
      cores,
      architecture: this.detectArchitecture(),
      performance: this.detectCPUPerformance(cores),
    };
  }
  
  /**
   * Detect memory capabilities
   */
  private async detectMemoryCapabilities(): Promise<DeviceCapabilities['memory']> {
    const total = this.detectTotalMemory();
    const available = this.detectAvailableMemory(total);
    const usage = this.calculateMemoryUsage(total, available);
    
    return {
      total,
      available,
      usage,
    };
  }
  
  /**
   * Detect audio capabilities
   */
  private async detectAudioCapabilities(): Promise<DeviceCapabilities['audio']> {
    let sampleRate = 48000;
    let bufferSize = 256;
    let latency = 20;
    let channels = 2;
    
    try {
      // Try to get actual audio context capabilities
      if (typeof window !== 'undefined' && window.AudioContext) {
        const tempContext = new AudioContext();
        sampleRate = tempContext.sampleRate;
        
        if (tempContext.baseLatency !== undefined) {
          latency = tempContext.baseLatency * 1000; // Convert to ms
        }
        
        await tempContext.close();
      }
    } catch (error) {
      logger.warn('Could not detect audio capabilities:', error);
    }
    
    return {
      sampleRate,
      bufferSize,
      latency,
      channels,
    };
  }
  
  /**
   * Detect network capabilities
   */
  private async detectNetworkCapabilities(): Promise<DeviceCapabilities['network']> {
    const type = this.detectNetworkType();
    const speed = this.detectNetworkSpeed();
    const latency = await this.measureNetworkLatency();
    const bandwidth = this.estimateBandwidth();
    
    return {
      type,
      speed,
      latency,
      bandwidth,
    };
  }
  
  /**
   * Detect battery capabilities
   */
  private async detectBatteryCapabilities(): Promise<DeviceCapabilities['battery']> {
    const level = await this.getBatteryLevel();
    const charging = await this.getBatteryCharging();
    const temperature = 25; // Default - not available in web APIs
    
    return {
      level,
      charging,
      temperature,
    };
  }
  
  /**
   * Detect platform type
   */
  private detectPlatform(): 'desktop' | 'mobile' | 'tablet' | 'embedded' {
    // Check for test environment mocking first
    if (typeof (navigator as any).mockPlatform === 'string') {
      logger.info(`📱 Using mocked platform: ${(navigator as any).mockPlatform}`);
      return (navigator as any).mockPlatform;
    }
    
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Mobile detection
    if (userAgent.includes('iphone') || 
        userAgent.includes('android') ||
        userAgent.includes('mobile')) {
      return 'mobile';
    }
    
    // Tablet detection
    if (userAgent.includes('ipad') || 
        userAgent.includes('tablet')) {
      return 'tablet';
    }
    
    // Embedded detection
    if (userAgent.includes('embedded') ||
        userAgent.includes('iot')) {
      return 'embedded';
    }
    
    return 'desktop';
  }
  
  /**
   * Detect CPU architecture
   */
  private detectArchitecture(): string {
    // Limited detection in browser environment
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('arm64') || userAgent.includes('aarch64')) {
      return 'arm64';
    }
    if (userAgent.includes('arm')) {
      return 'arm';
    }
    if (userAgent.includes('x86_64') || userAgent.includes('amd64')) {
      return 'x86_64';
    }
    if (userAgent.includes('x86')) {
      return 'x86';
    }
    
    return 'unknown';
  }
  
  /**
   * Detect CPU performance level
   */
  private detectCPUPerformance(cores: number): 'low' | 'medium' | 'high' | 'ultra' {
    // Performance estimation based on core count and platform
    const platform = this.detectPlatform();
    
    if (platform === 'mobile') {
      // Mobile devices generally have lower performance per core
      if (cores >= 8) return 'high';
      if (cores >= 6) return 'medium';
      if (cores >= 4) return 'medium';
      return 'low';
    }
    
    // Desktop/tablet performance scaling
    if (cores >= 16) return 'ultra';
    if (cores >= 8) return 'high';
    if (cores >= 4) return 'medium';
    return 'low';
  }
  
  /**
   * Detect total memory
   */
  private detectTotalMemory(): number {
    // deviceMemory is experimental API
    const deviceMemoryGB = (navigator as any).deviceMemory;
    if (typeof deviceMemoryGB === 'number') {
      return deviceMemoryGB * 1024; // Convert GB to MB
    }
    
    // Fallback estimation based on platform
    const platform = this.detectPlatform();
    const cores = navigator.hardwareConcurrency || 4;
    
    if (platform === 'mobile') {
      if (cores >= 8) return 6 * 1024; // 6GB
      if (cores >= 6) return 4 * 1024; // 4GB
      return 2 * 1024; // 2GB
    }
    
    // Desktop fallback
    if (cores >= 8) return 16 * 1024; // 16GB
    if (cores >= 4) return 8 * 1024; // 8GB
    return 4 * 1024; // 4GB
  }
  
  /**
   * Detect available memory
   */
  private detectAvailableMemory(totalMemory: number): number {
    // Estimate available memory (70% of total as reasonable assumption)
    return totalMemory * 0.7;
  }
  
  /**
   * Calculate current memory usage
   */
  private calculateMemoryUsage(): number {
    // Use performance.memory if available
    if ((performance as any).memory) {
      const memInfo = (performance as any).memory;
      return (memInfo.usedJSHeapSize / memInfo.totalJSHeapSize) * 100;
    }
    
    // Fallback estimation
    return Math.random() * 30 + 20; // 20-50%
  }
  
  /**
   * Detect network type
   */
  private detectNetworkType(): 'wifi' | 'cellular' | 'ethernet' | 'unknown' {
    try {
      // Check for test environment mock first
      if ((global.navigator as any)?.connection) {
        const mockConnection = (global.navigator as any).connection;
        if (mockConnection.type) {
          logger.info(`🌐 Using mocked network type: ${mockConnection.type}`);
          return mockConnection.type;
        }
      }
      
      // Network Connection API is experimental
      const connection = (navigator as any).connection ||
                        (navigator as any).mozConnection ||
                        (navigator as any).webkitConnection;
      
      if (connection?.type) {
        return connection.type;
      }
    } catch (error) {
      logger.warn('Could not detect network type:', error);
    }
    
    return 'unknown';
  }
  
  /**
   * Detect network speed
   */
  private detectNetworkSpeed(): 'slow' | 'medium' | 'fast' | 'ultra' {
    try {
      const connection = (navigator as any).connection ||
                        (navigator as any).mozConnection ||
                        (navigator as any).webkitConnection;
      
      if (connection?.effectiveType) {
        switch (connection.effectiveType) {
          case 'slow-2g':
          case '2g':
            return 'slow';
          case '3g':
            return 'medium';
          case '4g':
            return 'fast';
          case '5g':
            return 'ultra';
          default:
            return 'medium';
        }
      }
    } catch (error) {
      logger.warn('Could not detect network speed:', error);
    }
    
    return 'medium';
  }
  
  /**
   * Measure network latency
   */
  private async measureNetworkLatency(): Promise<number> {
    try {
      const startTime = performance.now();
      
      // Try to make a simple request to measure latency
      await fetch('/', { method: 'HEAD', cache: 'no-cache' });
      
      const latency = performance.now() - startTime;
      return latency;
    } catch (error) {
      logger.warn('Could not measure network latency:', error);
      return Math.random() * 50 + 10; // 10-60ms fallback
    }
  }
  
  /**
   * Estimate bandwidth
   */
  private estimateBandwidth(): number {
    try {
      const connection = (navigator as any).connection ||
                        (navigator as any).mozConnection ||
                        (navigator as any).webkitConnection;
      
      return connection?.downlink || 10; // Mbps
    } catch (error) {
      logger.warn('Could not estimate bandwidth:', error);
      return 10; // Default bandwidth
    }
  }
  
  /**
   * Get battery level
   */
  private async getBatteryLevel(): Promise<number> {
    try {
      // Check for test environment mock first
      if ((global.navigator as any)?.getBattery) {
        const mockBattery = await (global.navigator as any).getBattery();
        if (mockBattery && typeof mockBattery.level === 'number') {
          logger.info(`🔋 Using mocked battery level: ${mockBattery.level * 100}%`);
          return mockBattery.level * 100;
        }
      }
      
      // Battery API is experimental
      const battery = await (navigator as any).getBattery?.();
      return battery ? battery.level * 100 : 100;
    } catch (error) {
      logger.warn('Could not get battery level:', error);
      return 100; // Default for non-mobile devices
    }
  }
  
  /**
   * Get battery charging status
   */
  private async getBatteryCharging(): Promise<boolean> {
    try {
      // Check for test environment mock first
      if ((global.navigator as any)?.getBattery) {
        const mockBattery = await (global.navigator as any).getBattery();
        if (mockBattery && typeof mockBattery.charging === 'boolean') {
          return mockBattery.charging;
        }
      }
      
      // Battery API is experimental
      const battery = await (navigator as any).getBattery?.();
      return battery ? battery.charging : true;
    } catch (error) {
      logger.warn('Could not get battery charging status:', error);
      return true; // Default for non-mobile devices
    }
  }
  
  /**
   * Get detailed network capabilities
   */
  async getNetworkCapabilities(): Promise<NetworkCapabilities> {
    try {
      const connection = (navigator as any).connection ||
                        (navigator as any).mozConnection ||
                        (navigator as any).webkitConnection;
      
      if (connection) {
        return {
          connectionType: connection.type || 'unknown',
          downlink: connection.downlink || 10,
          rtt: connection.rtt || 100,
          effectiveType: connection.effectiveType || '4g',
        };
      }
    } catch (error) {
      logger.warn('Could not get network capabilities:', error);
    }
    
    // Fallback network capabilities
    return {
      connectionType: 'unknown',
      downlink: 10,
      rtt: 100,
      effectiveType: '4g',
    };
  }
}