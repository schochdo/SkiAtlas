import { useEffect, useRef } from 'react';
import type { UseKeyboardFlightOptions } from './types';
import { NAVIGATION_KEY_SET, CAMERA_CONSTANTS } from './types';
import {
  normalizeBearing,
  clampPitch,
  isInputElementFocused,
  computeGeographicDisplacement,
  sampleTerrainObstacle,
} from './cameraUtils';
import { cameraStateMachine } from './cameraStateMachine';

/**
 * 60 FPS Keyboard Camera Flight Hook
 * Provides smooth, level, momentum-calibrated flight across 3D terrain
 * without elevation snapping or zoom locking.
 */
export function useKeyboardFlight({
  map,
  isLoaded,
  onAltitudeChange,
  onBearingChange,
  onPitchChange,
  onModeChange,
}: UseKeyboardFlightOptions): void {
  // Stable refs for callbacks to prevent re-attaching listeners on every render
  const callbacksRef = useRef({
    onAltitudeChange,
    onBearingChange,
    onPitchChange,
    onModeChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onAltitudeChange,
      onBearingChange,
      onPitchChange,
      onModeChange,
    };
  });

  useEffect(() => {
    if (!isLoaded || !map) return;

    try {
      map.keyboard.disable();
    } catch (_) {}

    const activeKeys = new Set<string>();
    let animationFrameId: number | null = null;
    let lastTimestamp: number | null = null;
    let isElevationHeld = false;

    // Listen for external mode changes (e.g. safeFlyTo starting or ending)
    const unsubscribeState = cameraStateMachine.subscribe((newMode) => {
      callbacksRef.current.onModeChange?.(newMode);
      if (newMode === 'flyto' && animationFrameId !== null) {
        stopFlight(true);
      }
    });

    const stopFlight = (_immediate = false) => {
      activeKeys.clear();
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      lastTimestamp = null;
      if (cameraStateMachine.getMode() === 'flight') {
        cameraStateMachine.setMode('idle');
      }

      // Safe terrain settlement on key release
      if (isElevationHeld && map) {
        isElevationHeld = false;
        try {
          const curCenter = map.getCenter();
          const curPitch = map.getPitch();
          const centerElev = map.queryTerrainElevation(curCenter);

          // Only re-enable ground clamping if center is actually on terrain and pitch is not glancing the horizon
          if (centerElev !== null && curPitch < 78) {
            map.setCenterClampedToGround(true);
          } else {
            // Looking above the horizon or over off-terrain void: keep ground clamping disabled
            map.setCenterClampedToGround(false);
          }
        } catch (_) {}
      }
    };

    const flightStep = (timestamp: number) => {
      if (!map) {
        stopFlight(true);
        return;
      }

      if (cameraStateMachine.isProgrammaticActive()) {
        stopFlight(true);
        return;
      }

      if (lastTimestamp === null) lastTimestamp = timestamp;
      const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.08);
      lastTimestamp = timestamp;

      const hasNavKey = Array.from(activeKeys).some((k) => NAVIGATION_KEY_SET.has(k));
      if (!hasNavKey) {
        stopFlight(false);
        return;
      }

      const isShift = activeKeys.has('ShiftLeft') || activeKeys.has('ShiftRight');

      let pitchDelta = 0;
      let rotateBearing = 0;
      let zoomDelta = 0;
      let moveForward = 0;
      let moveStrafe = 0;
      let altitudeDelta = 0;

      // WASD: Direct Camera Orientation Controls (No Shift required!)
      // W/S: Tilt pitch (up towards 3D horizon / down towards 2D nadir)
      if (activeKeys.has('KeyW')) pitchDelta += 1;
      if (activeKeys.has('KeyS')) pitchDelta -= 1;

      // A/D: Rotate bearing (spin camera heading left / right)
      // KeyA turns LEFT (counter-clockwise / decreases bearing)
      // KeyD turns RIGHT (clockwise / increases bearing)
      if (activeKeys.has('KeyA')) rotateBearing -= 1;
      if (activeKeys.has('KeyD')) rotateBearing += 1;

      // Q/E or PageDown/PageUp: Manual Altitude Adjustment (Descend / Ascend)
      if (activeKeys.has('KeyE') || activeKeys.has('PageUp')) altitudeDelta += 1;
      if (activeKeys.has('KeyQ') || activeKeys.has('PageDown')) altitudeDelta -= 1;

      // Arrow Keys: Direct Ground Panning Controls (No Shift required!)
      if (activeKeys.has('ArrowUp')) moveForward += 1;
      if (activeKeys.has('ArrowDown')) moveForward -= 1;
      if (activeKeys.has('ArrowRight')) moveStrafe += 1;
      if (activeKeys.has('ArrowLeft')) moveStrafe -= 1;

      // Zoom In / Out: + / - (or Z / X for single-hand left keyboard use)
      if (activeKeys.has('Equal') || activeKeys.has('NumpadAdd') || activeKeys.has('KeyZ')) zoomDelta += 1;
      if (activeKeys.has('Minus') || activeKeys.has('NumpadSubtract') || activeKeys.has('KeyX')) zoomDelta -= 1;

      // 1. PITCH CONTROL WITH DYNAMIC ZOOM CEILING
      if (pitchDelta !== 0) {
        const curPitch = map.getPitch();
        const curZoom = map.getZoom();
        const pitchSpeed = (isShift ? 2.0 : 1.0) * CAMERA_CONSTANTS.PITCH_SPEED_DEG_PER_SEC;
        const nextPitch = clampPitch(curPitch + pitchDelta * pitchSpeed * dt, curZoom);
        map.setPitch(nextPitch);
        callbacksRef.current.onPitchChange?.(Math.round(nextPitch));
      }

      // 2. BEARING CONTROL
      if (rotateBearing !== 0) {
        const curBearing = map.getBearing();
        const bearingSpeed = (isShift ? 2.0 : 1.0) * CAMERA_CONSTANTS.BEARING_SPEED_DEG_PER_SEC;
        const nextBearing = normalizeBearing(curBearing + rotateBearing * bearingSpeed * dt);
        map.setBearing(nextBearing);
        callbacksRef.current.onBearingChange?.(Math.round(nextBearing));
      }

      // 3. ZOOM CONTROL WITH CLEARANCE PROTECTION
      if (zoomDelta !== 0) {
        const curZoom = map.getZoom();
        const zoomSpeed = (isShift ? 2.0 : 1.0) * CAMERA_CONSTANTS.ZOOM_SPEED_PER_SEC;
        let nextZoom = Math.max(1.0, Math.min(20.5, curZoom + zoomDelta * zoomSpeed * dt));

        // Ground clearance protection when zooming in towards terrain
        if (zoomDelta > 0) {
          const tr = (map as any)._camera?.transform;
          const camLngLat = tr?.getCameraLngLat?.() || map.getCenter();
          const camAlt = tr?.getCameraAltitude?.();
          const groundUnderCam = map.queryTerrainElevation(camLngLat);

          if (
            camAlt !== null &&
            camAlt !== undefined &&
            isFinite(camAlt) &&
            groundUnderCam !== null &&
            groundUnderCam !== undefined &&
            isFinite(groundUnderCam)
          ) {
            if (camAlt <= groundUnderCam + CAMERA_CONSTANTS.MIN_ZOOM_CLEARANCE_METERS) {
              nextZoom = curZoom; // Prevent crashing camera eye into terrain
            }
          }
        }

        map.setZoom(nextZoom);
      }

      const liveZoom = map.getZoom();
      const speedMps = CAMERA_CONSTANTS.BASE_SPEED_MPS * Math.pow(2, 14 - liveZoom) * (isShift ? 2.5 : 1.0);

      // 4. MANUAL ALTITUDE CONTROL: TRUE VERTICAL "HELICOPTER" ELEVATOR (Q / E or PageDown / PageUp)
      // Unlike zoom (which glides along the angled line-of-sight vector towards the ground target),
      // altitude changes camera elevation STRAIGHT UP and DOWN vertically without horizontal camera drift.
      if (altitudeDelta !== 0) {
        if (!isElevationHeld) {
          try {
            map.setCenterClampedToGround(false);
            isElevationHeld = true;
          } catch (_) {}
        }

        const tr = (map as any)._camera?.transform;
        const curCenter = map.getCenter();
        const curBearing = map.getBearing();
        const curPitch = map.getPitch();
        const curCamLngLat = tr?.getCameraLngLat?.() || curCenter;
        const curCamAlt = tr?.getCameraAltitude?.();
        const groundUnderCam = map.queryTerrainElevation(curCamLngLat) ?? 0;
        const groundUnderCenter = map.queryTerrainElevation(curCenter) ?? (map.getCenterElevation?.() ?? 0);

        // Climb/descent rate in vertical meters per second, scaled with zoom level and shift sprint
        const vertSpeedMps = (CAMERA_CONSTANTS.BASE_SPEED_MPS * 0.75) * Math.pow(2, 14 - liveZoom) * (isShift ? 2.5 : 1.0);
        const deltaAltMeters = altitudeDelta * vertSpeedMps * dt;

        if (curCamAlt !== null && curCamAlt !== undefined && isFinite(curCamAlt) && curCamAlt > 0) {
          const targetCamAlt = curCamAlt + deltaAltMeters;
          const minAllowedCamAlt = groundUnderCam + CAMERA_CONSTANTS.MIN_CAMERA_CLEARANCE_METERS;

          // Enforce ground collision clearance floor for vertical descent
          if (deltaAltMeters < 0 && targetCamAlt < minAllowedCamAlt) {
            // Camera eye is at or below safe clearance floor; stop descent
          } else {
            const nextCamAlt = Math.max(minAllowedCamAlt, targetCamAlt);
            const pitchRad = (curPitch * Math.PI) / 180;
            const bearingRad = (curBearing * Math.PI) / 180;

            // Height of camera above ground target
            const prevHeightAboveGround = Math.max(10, curCamAlt - groundUnderCenter);
            const nextHeightAboveGround = Math.max(10, nextCamAlt - groundUnderCenter);

            // 1. Zoom adjustment: camera distance along view vector scales with vertical height change
            // -log2(nextDist / prevDist) maintains geometric focal scale
            const zoomAdjust = -Math.log2(nextHeightAboveGround / prevHeightAboveGround);
            const curZoom = map.getZoom();
            const nextZoom = Math.max(1.0, Math.min(20.5, curZoom + zoomAdjust));

            // 2. Horizontal center shift: as camera goes straight up/down at fixed pitch and bearing,
            // the intersection of the line-of-sight with the ground shifts along bearing by deltaHeight * tan(pitch)
            const deltaGroundDist = (nextHeightAboveGround - prevHeightAboveGround) * Math.tan(pitchRad);
            const deltaEast = deltaGroundDist * Math.sin(bearingRad);
            const deltaNorth = deltaGroundDist * Math.cos(bearingRad);

            const metersPerDegLat = CAMERA_CONSTANTS.METERS_PER_DEG_LAT;
            const latRad = (curCenter.lat * Math.PI) / 180;
            const metersPerDegLng = metersPerDegLat * Math.cos(latRad);

            const nextCenterLat = Math.max(-85, Math.min(85, curCenter.lat + deltaNorth / metersPerDegLat));
            const nextCenterLng = curCenter.lng + deltaEast / metersPerDegLng;

            map.jumpTo({
              center: [nextCenterLng, nextCenterLat],
              zoom: nextZoom,
            });
          }
        } else {
          // Fallback if camera transform elevation is unavailable: adjust zoom cleanly
          const curZ = map.getZoom();
          const altSpeed = isShift ? 2.5 : CAMERA_CONSTANTS.ALTITUDE_SPEED_PER_SEC;
          const nextZ = curZ - altitudeDelta * altSpeed * dt;
          map.setZoom(Math.max(1.0, Math.min(20.5, nextZ)));
        }
      }

      // 5. HORIZONTAL GROUND FLIGHT (Arrow Keys)
      const hasHorizontalMove = moveForward !== 0 || moveStrafe !== 0;

      if (hasHorizontalMove) {
        // Temporarily release center ground clamping so camera cruises level without peak-and-valley bouncing
        if (!isElevationHeld) {
          try {
            map.setCenterClampedToGround(false);
            isElevationHeld = true;
          } catch (_) {}
        }

        const curCenter = map.getCenter();
        const curBearing = map.getBearing();

        const { deltaLat, deltaLng, nextLat, nextLng } = computeGeographicDisplacement(
          curCenter,
          curBearing,
          moveForward,
          moveStrafe,
          speedMps,
          dt
        );

        // Predictive ground clearance for the camera eye:
        const lookaheadSec = CAMERA_CONSTANTS.LOOKAHEAD_SECONDS;
        const lookaheadMultiplier = dt > 0 ? lookaheadSec / dt : 1;
        const lookaheadLat = deltaLat * lookaheadMultiplier;
        const lookaheadLng = deltaLng * lookaheadMultiplier;

        const tr = (map as any)._camera?.transform;
        const camLngLat = tr?.getCameraLngLat?.() || curCenter;
        const camAlt = tr?.getCameraAltitude?.();
        const nextCamLat = Math.max(-85, Math.min(85, camLngLat.lat + deltaLat));
        const nextCamLng = camLngLat.lng + deltaLng;
        const lookCamLat = Math.max(-85, Math.min(85, nextCamLat + lookaheadLat));
        const lookCamLng = nextCamLng + lookaheadLng;

        const maxGroundCam = sampleTerrainObstacle(map, nextCamLng, nextCamLat, lookCamLng, lookCamLat);

        // Climb ONLY when the camera eye itself is within clearance threshold of terrain directly below or ahead
        if (maxGroundCam > -Infinity && camAlt !== null && camAlt !== undefined && isFinite(camAlt) && camAlt > 0) {
          const minAllowedCamAlt = maxGroundCam + CAMERA_CONSTANTS.MIN_CAMERA_CLEARANCE_METERS;
          if (minAllowedCamAlt > camAlt) {
            const climbDiff = minAllowedCamAlt - camAlt;
            const zoomAdjust = Math.log2(1 + climbDiff / camAlt);
            const curZ = map.getZoom();
            const nextZ = Math.max(1.0, curZ - zoomAdjust * (1 - Math.exp(-dt * 6.0)));
            map.setZoom(nextZ);
          }
        }

        map.jumpTo({
          center: [nextLng, nextLat],
        });
      }

      // Live update camera altitude metric during flight
      try {
        const alt = (map as any)._camera?.transform?.getCameraAltitude?.() ?? map.getCenterElevation?.();
        if (alt !== null && alt !== undefined && isFinite(alt)) {
          callbacksRef.current.onAltitudeChange?.(alt);
        }
      } catch (_) {}

      animationFrameId = requestAnimationFrame(flightStep);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputElementFocused()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Only true navigation keys trigger flight (Shift is purely a speed multiplier)
      if (NAVIGATION_KEY_SET.has(e.code)) {
        e.preventDefault();
        activeKeys.add(e.code);
        if (e.shiftKey) activeKeys.add('ShiftLeft');

        // Cancel any running programmatic flight when user takes manual control
        if (cameraStateMachine.isProgrammaticActive()) {
          cameraStateMachine.cancelProgrammaticFlight(map);
        }
        cameraStateMachine.setMode('flight');

        if (animationFrameId === null) {
          lastTimestamp = performance.now();
          animationFrameId = requestAnimationFrame(flightStep);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        activeKeys.delete('ShiftLeft');
        activeKeys.delete('ShiftRight');
      }
      const hasNavKey = Array.from(activeKeys).some((k) => NAVIGATION_KEY_SET.has(k));
      if (!hasNavKey && animationFrameId !== null) {
        stopFlight(false);
      }
    };

    const stopFlightOnBlur = () => stopFlight(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', stopFlightOnBlur);
    window.addEventListener('focus', stopFlightOnBlur);
    document.addEventListener('visibilitychange', stopFlightOnBlur);

    // Yield flight engine immediately when user uses mouse to pan or rotate
    const canvasContainer = map.getCanvasContainer();
    const onCanvasMouseInteraction = () => {
      if (animationFrameId !== null || activeKeys.size > 0 || isElevationHeld) {
        stopFlight(true);
      }
    };
    canvasContainer.addEventListener('mousedown', onCanvasMouseInteraction, { capture: true });
    canvasContainer.addEventListener('pointerdown', onCanvasMouseInteraction, { capture: true });
    canvasContainer.addEventListener('wheel', onCanvasMouseInteraction, { capture: true });

    return () => {
      unsubscribeState();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', stopFlightOnBlur);
      window.removeEventListener('focus', stopFlightOnBlur);
      document.removeEventListener('visibilitychange', stopFlightOnBlur);
      canvasContainer.removeEventListener('mousedown', onCanvasMouseInteraction, { capture: true } as any);
      canvasContainer.removeEventListener('pointerdown', onCanvasMouseInteraction, { capture: true } as any);
      canvasContainer.removeEventListener('wheel', onCanvasMouseInteraction, { capture: true } as any);
      stopFlight(true);
    };
  }, [map, isLoaded]);
}
