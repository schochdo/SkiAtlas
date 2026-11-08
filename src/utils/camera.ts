/* =========================================================================
   SAFE MAP CAMERA CONTROLS (DELEGATE TO MODULAR CAMERA SUBSYSTEM)
   ========================================================================= */

export {
  cameraStateMachine,
  isProgrammaticFlightActive,
  setIsProgrammaticFlightActive,
  getIsProgrammaticFlightActive,
  safeFlyTo,
  safeEaseTo,
  computeGlobeFitZoom,
  DEFAULT_NORTH_AMERICA_CENTER,
} from '../camera';
