import type { Map as MapLibreMap } from 'maplibre-gl';
import type { CameraMode } from './types';

/* =========================================================================
   CAMERA FINITE STATE MACHINE (FSM) & PROGRAMMATIC TRANSITIONS
   Manages the transitions between:
     - 'idle'    : Static or manual mouse pan/orbit
     - 'flight'  : Active 60fps keyboard cruising (WASD / arrows / QE)
     - 'flyto'   : Programmatic eased transition to resort/lookout/home
     - 'inspect' : Close-up stationary inspection of a feature
   ========================================================================= */

type StateChangeListener = (mode: CameraMode) => void;

// Exported live boolean binding for direct conditional checks: if (isProgrammaticFlightActive) ...
export let isProgrammaticFlightActive = false;

class CameraStateMachine {
  private mode: CameraMode = 'idle';
  private listeners: Set<StateChangeListener> = new Set();
  private flightSequenceId = 0;

  public getMode(): CameraMode {
    return this.mode;
  }

  public setMode(newMode: CameraMode): void {
    if (this.mode === newMode) return;
    this.mode = newMode;
    isProgrammaticFlightActive = newMode === 'flyto';

    this.listeners.forEach((listener) => {
      try {
        listener(newMode);
      } catch (err) {
        console.warn('CameraStateMachine listener error:', err);
      }
    });
  }

  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public isProgrammaticActive(): boolean {
    return this.mode === 'flyto';
  }

  public cancelProgrammaticFlight(map?: MapLibreMap | null): void {
    if (this.mode === 'flyto') {
      this.flightSequenceId++;
      this.setMode('idle');
      if (map) {
        try {
          (map as any).setCenterClampedToGround?.(true);
        } catch (_) {}
      }
    }
  }

  /**
   * Safe programmatic flight with coordinate validation and state machine coordination
   */
  public safeFlyTo(map: MapLibreMap | null, options: any): void {
    if (!map || !options) return;

    if (options.center) {
      const c = options.center;
      let lng: number | undefined;
      let lat: number | undefined;
      if (Array.isArray(c)) {
        lng = Number(c[0]);
        lat = Number(c[1]);
      } else if (c && typeof c === 'object') {
        lng = Number(c.lng ?? c.lon);
        lat = Number(c.lat);
      }
      if (
        lng === undefined ||
        lat === undefined ||
        !isFinite(lng) ||
        !isFinite(lat) ||
        isNaN(lng) ||
        isNaN(lat)
      ) {
        console.warn('safeFlyTo rejected invalid coordinates:', c);
        return;
      }
      options.center = [lng, lat];
    }

    try {
      const currentFlightId = ++this.flightSequenceId;
      this.setMode('flyto');

      // Enable center ground clamping during programmatic flight so MapLibre eases smoothly onto the target terrain
      try {
        (map as any).setCenterClampedToGround?.(true);
      } catch (_) {}

      map.flyTo(options);

      const onEnd = () => {
        if (this.flightSequenceId === currentFlightId) {
          this.setMode('idle');
          try {
            (map as any).setCenterClampedToGround?.(true);
          } catch (_) {}
        }
        map.off('moveend', onEnd);
      };
      map.once('moveend', onEnd);
    } catch (err) {
      console.warn('safeFlyTo caught exception:', err);
      this.setMode('idle');
      try {
        (map as any).setCenterClampedToGround?.(true);
      } catch (_) {}
    }
  }

  /**
   * Safe easeTo transition with exception protection
   */
  public safeEaseTo(map: MapLibreMap | null, options: any): void {
    if (!map || !options) return;
    try {
      map.easeTo(options);
    } catch (err) {
      console.warn('safeEaseTo caught exception:', err);
    }
  }
}

export const cameraStateMachine = new CameraStateMachine();

export const setIsProgrammaticFlightActive = (v: boolean): void => {
  if (v) {
    cameraStateMachine.setMode('flyto');
  } else if (cameraStateMachine.getMode() === 'flyto') {
    cameraStateMachine.cancelProgrammaticFlight();
  }
};

export const getIsProgrammaticFlightActive = (): boolean => cameraStateMachine.isProgrammaticActive();
export const safeFlyTo = (map: MapLibreMap | null, options: any) => cameraStateMachine.safeFlyTo(map, options);
export const safeEaseTo = (map: MapLibreMap | null, options: any) => cameraStateMachine.safeEaseTo(map, options);
