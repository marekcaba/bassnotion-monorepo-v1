/**
 * usePlaybackIntegration - Deprecated Redirect
 *
 * This file redirects to the deprecated implementation for backward compatibility.
 * New code should use:
 * - useTransport() for playback control
 * - useTrack() for instrument control
 * - EventBus for communication between components
 */

export * from './usePlaybackIntegration.deprecated';
