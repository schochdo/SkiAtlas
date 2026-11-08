import type { Map as MapLibreMap } from 'maplibre-gl';

/* =========================================================================
   CAMERA & FLIGHT SYSTEM TYPES
   ========================================================================= */

/**
 * Camera operational modes managed by the Finite State Machine
 */
export type CameraMode = 'idle' | 'flight' | 'flyto' | 'inspect';

/**
 * Recognized keyboard navigation input codes
 */
export type FlightKeyCode =
  | 'KeyW'
  | 'KeyA'
  | 'KeyS'
  | 'KeyD'
  | 'KeyQ'
  | 'KeyE'
  | 'PageUp'
  | 'PageDown'
  | 'KeyZ'
  | 'KeyX'
  | 'Equal'
  | 'Minus'
  | 'NumpadAdd'
  | 'NumpadSubtract'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight';

export const NAVIGATION_KEY_SET = new Set<string>([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'PageUp',
  'PageDown',
  'KeyZ',
  'KeyX',
  'Equal',
  'Minus',
  'NumpadAdd',
  'NumpadSubtract',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

/**
 * Configuration options and callbacks for the keyboard flight hook
 */
export interface UseKeyboardFlightOptions {
  map: MapLibreMap | null;
  isLoaded: boolean;
  onAltitudeChange?: (altitudeMeters: number) => void;
  onBearingChange?: (bearing: number) => void;
  onPitchChange?: (pitch: number) => void;
  onModeChange?: (mode: CameraMode) => void;
}

/**
 * Physical kinematics constants for camera navigation
 */
export const CAMERA_CONSTANTS = {
  MIN_CAMERA_CLEARANCE_METERS: 25.0, // Minimum camera eye height above terrain
  MIN_ZOOM_CLEARANCE_METERS: 15.0,   // Clearance threshold when zooming in directly
  LOOKAHEAD_SECONDS: 0.6,            // Predictive terrain obstacle lookahead time
  MIN_PITCH_DEG: 0,
  MAX_PITCH_DEG: 85,
  BASE_SPEED_MPS: 720,               // Cruising speed in m/s at zoom 14
  PITCH_SPEED_DEG_PER_SEC: 36,
  BEARING_SPEED_DEG_PER_SEC: 42,
  ZOOM_SPEED_PER_SEC: 1.5,
  ALTITUDE_SPEED_PER_SEC: 1.2,
  METERS_PER_DEG_LAT: 111320,
} as const;
