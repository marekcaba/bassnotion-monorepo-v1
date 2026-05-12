/**
 * BrowserCompatibility - Cross-browser testing and compatibility checks
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Ensures audio functionality across all supported browsers
 */

export interface BrowserCapability {
  name: string;
  supported: boolean;
  version?: string;
  notes?: string;
}

export interface BrowserCompatibilityReport {
  browser: {
    name: string;
    version: string;
    userAgent: string;
    platform: string;
  };
  capabilities: BrowserCapability[];
  overallSupport: 'full' | 'partial' | 'none';
  recommendations: string[];
  timestamp: number;
}

export class BrowserCompatibility {
  private capabilities: BrowserCapability[] = [];
  private browserInfo: { name: string; version: string } | null = null;

  constructor() {
    this.detectBrowser();
  }

  /**
   * Run all compatibility checks
   */
  async checkCompatibility(): Promise<BrowserCompatibilityReport> {
    this.capabilities = [];

    // Core Web Audio API
    this.checkCapability('AudioContext', () => {
      return 'AudioContext' in window || 'webkitAudioContext' in window;
    });

    // AudioWorklet (modern audio processing)
    this.checkCapability('AudioWorklet', () => {
      const context = this.getAudioContext();
      const supported = context ? 'audioWorklet' in context : false;
      context?.close();
      return supported;
    });

    // Web Audio API nodes
    this.checkCapability('OscillatorNode', () => {
      const context = this.getAudioContext();
      if (!context) return false;
      try {
        const osc = context.createOscillator();
        osc.disconnect();
        context.close();
        return true;
      } catch {
        context.close();
        return false;
      }
    });

    this.checkCapability('GainNode', () => {
      const context = this.getAudioContext();
      if (!context) return false;
      try {
        const gain = context.createGain();
        gain.disconnect();
        context.close();
        return true;
      } catch {
        context.close();
        return false;
      }
    });

    this.checkCapability('AnalyserNode', () => {
      const context = this.getAudioContext();
      if (!context) return false;
      try {
        const analyser = context.createAnalyser();
        analyser.disconnect();
        context.close();
        return true;
      } catch {
        context.close();
        return false;
      }
    });

    // Promise support
    this.checkCapability('Promise', () => {
      return typeof Promise !== 'undefined';
    });

    // Fetch API
    this.checkCapability('Fetch API', () => {
      return typeof fetch !== 'undefined';
    });

    // ES6 features
    this.checkCapability('ES6 Classes', () => {
      try {
        eval('class Test {}');
        return true;
      } catch {
        return false;
      }
    });

    this.checkCapability('Async/Await', () => {
      try {
        eval('(async function() {})');
        return true;
      } catch {
        return false;
      }
    });

    // Performance API
    this.checkCapability('Performance API', () => {
      return (
        typeof performance !== 'undefined' &&
        typeof performance.now === 'function'
      );
    });

    // High resolution time
    this.checkCapability('High Resolution Time', () => {
      return (
        typeof performance !== 'undefined' &&
        typeof performance.now === 'function' &&
        performance.now() !== Math.floor(performance.now())
      );
    });

    // Web Workers
    this.checkCapability('Web Workers', () => {
      return typeof Worker !== 'undefined';
    });

    // Local Storage
    this.checkCapability('Local Storage', () => {
      try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch {
        return false;
      }
    });

    // Audio format support
    await this.checkAudioFormats();

    // Mobile-specific checks
    if (this.isMobile()) {
      await this.checkMobileCapabilities();
    }

    return this.generateReport();
  }

  /**
   * Check a specific capability
   */
  private checkCapability(
    name: string,
    test: () => boolean,
    notes?: string,
  ): void {
    try {
      const supported = test();
      this.capabilities.push({ name, supported, notes });
    } catch (error) {
      this.capabilities.push({
        name,
        supported: false,
        notes: error instanceof Error ? error.message : 'Test failed',
      });
    }
  }

  /**
   * Check audio format support
   */
  private async checkAudioFormats(): Promise<void> {
    const formats = [
      { name: 'WAV', mimeType: 'audio/wav' },
      { name: 'MP3', mimeType: 'audio/mpeg' },
      { name: 'OGG', mimeType: 'audio/ogg' },
      { name: 'WebM', mimeType: 'audio/webm' },
      { name: 'FLAC', mimeType: 'audio/flac' },
    ];

    for (const format of formats) {
      this.checkCapability(`Audio Format: ${format.name}`, () => {
        const audio = new Audio();
        return audio.canPlayType(format.mimeType) !== '';
      });
    }
  }

  /**
   * Check mobile-specific capabilities
   */
  private async checkMobileCapabilities(): Promise<void> {
    // Check for user gesture requirement
    this.checkCapability(
      'Audio without user gesture',
      () => {
        // Most mobile browsers require user gesture
        return false;
      },
      'Mobile browsers typically require user interaction to start audio',
    );

    // Check for background audio
    this.checkCapability(
      'Background audio',
      () => {
        // Limited support on mobile
        return this.isIOS() ? false : true;
      },
      'iOS suspends audio when app is backgrounded',
    );

    // Check for audio session
    if (this.isIOS()) {
      this.checkCapability(
        'Audio session category',
        () => {
          // iOS specific audio session handling
          return 'webkitAudioContext' in window;
        },
        'iOS requires specific audio session configuration',
      );
    }
  }

  /**
   * Detect browser
   */
  private detectBrowser(): void {
    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes('chrome') && !ua.includes('edg')) {
      const match = ua.match(/chrome\/(\d+\.\d+)/);
      this.browserInfo = {
        name: 'Chrome',
        version: match?.[1] || 'unknown',
      };
    } else if (ua.includes('firefox')) {
      const match = ua.match(/firefox\/(\d+\.\d+)/);
      this.browserInfo = {
        name: 'Firefox',
        version: match?.[1] || 'unknown',
      };
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      const match = ua.match(/version\/(\d+\.\d+)/);
      this.browserInfo = {
        name: 'Safari',
        version: match?.[1] || 'unknown',
      };
    } else if (ua.includes('edg')) {
      const match = ua.match(/edg\/(\d+\.\d+)/);
      this.browserInfo = {
        name: 'Edge',
        version: match?.[1] || 'unknown',
      };
    } else {
      this.browserInfo = { name: 'Unknown', version: 'unknown' };
    }
  }

  /**
   * Generate compatibility report
   */
  private generateReport(): BrowserCompatibilityReport {
    const supportedCount = this.capabilities.filter((c) => c.supported).length;
    const totalCount = this.capabilities.length;
    const supportPercentage = (supportedCount / totalCount) * 100;

    let overallSupport: 'full' | 'partial' | 'none';
    if (supportPercentage >= 95) {
      overallSupport = 'full';
    } else if (supportPercentage >= 70) {
      overallSupport = 'partial';
    } else {
      overallSupport = 'none';
    }

    const recommendations = this.generateRecommendations();

    return {
      browser: {
        name: this.browserInfo?.name || 'Unknown',
        version: this.browserInfo?.version || 'unknown',
        userAgent: navigator.userAgent,
        platform:
          navigator.userAgentData?.platform ||
          navigator.platform ||
          'unknown',
      },
      capabilities: this.capabilities,
      overallSupport,
      recommendations,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate recommendations based on capabilities
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const unsupported = this.capabilities.filter((c) => !c.supported);

    for (const capability of unsupported) {
      switch (capability.name) {
        case 'AudioContext':
          recommendations.push(
            'Browser does not support Web Audio API. Please upgrade to a modern browser.',
          );
          break;
        case 'AudioWorklet':
          recommendations.push(
            'AudioWorklet not supported. Some advanced audio features may be unavailable.',
          );
          break;
        case 'Promise':
        case 'Fetch API':
        case 'ES6 Classes':
        case 'Async/Await':
          recommendations.push(
            'Browser lacks modern JavaScript features. Please upgrade your browser.',
          );
          break;
        case 'Web Workers':
          recommendations.push(
            'Web Workers not supported. Audio processing performance may be limited.',
          );
          break;
        case 'Audio without user gesture':
          recommendations.push(
            'Audio requires user interaction to start. Add a play button or similar control.',
          );
          break;
      }
    }

    // Browser-specific recommendations
    if (this.browserInfo) {
      if (
        this.browserInfo.name === 'Safari' &&
        !this.hasCapability('AudioWorklet')
      ) {
        recommendations.push(
          'Update Safari to version 14.1 or later for full audio support.',
        );
      }
      if (
        this.browserInfo.name === 'Firefox' &&
        !this.hasCapability('AudioWorklet')
      ) {
        recommendations.push(
          'Update Firefox to version 76 or later for AudioWorklet support.',
        );
      }
    }

    // Mobile recommendations
    if (this.isMobile()) {
      recommendations.push(
        'Mobile device detected. Ensure user interaction before starting audio.',
      );
      if (this.isIOS()) {
        recommendations.push(
          'iOS detected. Audio may pause when app is backgrounded.',
        );
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Check if capability is supported
   */
  private hasCapability(name: string): boolean {
    return this.capabilities.find((c) => c.name === name)?.supported || false;
  }

  /**
   * Get audio context
   */
  private getAudioContext(): AudioContext | null {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      return AudioContextClass ? new AudioContextClass() : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if mobile device
   */
  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  }

  /**
   * Check if iOS device
   */
  private isIOS(): boolean {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !('MSStream' in window)
    );
  }

  /**
   * Get specific browser recommendations
   */
  getBrowserRecommendations(browserName: string): string[] {
    const recommendations: string[] = [];

    switch (browserName.toLowerCase()) {
      case 'chrome':
        recommendations.push('Chrome 66+ recommended for AudioWorklet support');
        recommendations.push(
          'Enable "Experimental Web Platform features" for latest audio features',
        );
        break;
      case 'firefox':
        recommendations.push(
          'Firefox 76+ recommended for AudioWorklet support',
        );
        recommendations.push(
          'Ensure media.autoplay.enabled is set appropriately',
        );
        break;
      case 'safari':
        recommendations.push(
          'Safari 14.1+ recommended for AudioWorklet support',
        );
        recommendations.push('User gesture required to start audio playback');
        break;
      case 'edge':
        recommendations.push('Edge 79+ (Chromium-based) recommended');
        recommendations.push('Legacy Edge has limited Web Audio support');
        break;
    }

    return recommendations;
  }
}
