/**
 * Widget singleton manager for ensuring only one instance of each widget type
 * This is a compatibility shim for the old pattern system
 *
 * @deprecated Widgets should use the new useTrack hook which handles this internally
 */

interface WidgetInstance {
  id: string;
  type: string;
  cleanup?: () => void;
}

class WidgetSingleton {
  private instances = new Map<string, WidgetInstance>();

  /**
   * Register a widget instance
   * @deprecated Use useTrack hook instead
   */
  register(widgetId: string, type: string, cleanup?: () => void): void {
    // Clean up any existing instance of the same type
    for (const [id, instance] of this.instances) {
      if (instance.type === type && id !== widgetId) {
        if (instance.cleanup) {
          instance.cleanup();
        }
        this.instances.delete(id);
      }
    }

    // Register new instance
    this.instances.set(widgetId, { id: widgetId, type, cleanup });

    logger.warn(
      `[${widgetId}] Using deprecated widgetSingleton. ` +
        `The new useTrack hook handles singleton behavior automatically.`,
    );
  }

  /**
   * Unregister a widget instance
   */
  unregister(widgetId: string): void {
    const instance = this.instances.get(widgetId);
    if (instance?.cleanup) {
      instance.cleanup();
    }
    this.instances.delete(widgetId);
  }

  /**
   * Check if a widget is registered
   */
  isRegistered(widgetId: string): boolean {
    return this.instances.has(widgetId);
  }

  /**
   * Get active instance of a widget type
   */
  getActiveInstance(type: string): string | null {
    for (const [id, instance] of this.instances) {
      if (instance.type === type) {
        return id;
      }
    }
    return null;
  }

  /**
   * Clear all instances (useful for testing)
   */
  clear(): void {
    for (const instance of this.instances.values()) {
      if (instance.cleanup) {
        instance.cleanup();
      }
    }
    this.instances.clear();
  }
}

// Export singleton instance
export const widgetSingleton = new WidgetSingleton();
