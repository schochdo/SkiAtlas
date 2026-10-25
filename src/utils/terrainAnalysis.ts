import * as maplibregl from 'maplibre-gl';
import type { RequestParameters, ResponseCallback } from 'maplibre-gl';

/* =========================================================================
   CLIENT-SIDE REAL-TIME SLOPE & ASPECT TERRAIN ANALYSIS PROTOCOLS
   Calculates slope angle (0°-90°) and compass aspect (solar orientation)
   directly from cached Mapterhorn Terrarium DEM elevation tiles via 3x3
   Sobel/Horn convolution filters. 100% client-side, zero backend dependencies.
   ========================================================================= */

interface TileCoordinates {
  z: number;
  x: number;
  y: number;
}

const TILE_URL_REGEX = /\/(\d+)\/(\d+)\/(\d+)\.webp/;

// In-memory LRU tile cache to prevent re-processing identical tiles when camera pans
const processedTileCache = new Map<string, ArrayBuffer>();
const MAX_CACHE_SIZE = 160;

function getCacheKey(type: 'slope' | 'aspect', z: number, x: number, y: number): string {
  return `${type}:${z}:${x}:${y}`;
}

function addToCache(key: string, buffer: ArrayBuffer) {
  if (processedTileCache.size >= MAX_CACHE_SIZE) {
    const firstKey = processedTileCache.keys().next().value;
    if (firstKey) processedTileCache.delete(firstKey);
  }
  processedTileCache.set(key, buffer);
}

/**
 * Parses slippy tile coordinates (z, x, y) from Mapterhorn DEM URL.
 */
function parseTileCoordinates(url: string): TileCoordinates | null {
  const match = url.match(TILE_URL_REGEX);
  if (!match) return null;
  return {
    z: parseInt(match[1], 10),
    x: parseInt(match[2], 10),
    y: parseInt(match[3], 10),
  };
}

/**
 * Calculates horizontal real-world ground resolution (meters per pixel) at given tile latitude.
 */
function getMetersPerPixel(z: number, y: number, tileSize: number): number {
  // In Web Mercator:
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / Math.pow(2, z))));
  const earthCircumferenceMeters = 40075016.686;
  return (earthCircumferenceMeters * Math.cos(latRad)) / (tileSize * Math.pow(2, z));
}

/**
 * Process raw Terrarium DEM ImageData into either Slope Angle or Aspect PNG byte stream.
 */
async function processDemTile(
  type: 'slope' | 'aspect',
  imgBitmap: ImageBitmap,
  tileCoords: TileCoordinates
): Promise<ArrayBuffer> {
  const width = imgBitmap.width;
  const height = imgBitmap.height;

  // Draw DEM bitmap to OffscreenCanvas to read RGB elevation bytes
  const inCanvas = new OffscreenCanvas(width, height);
  const inCtx = inCanvas.getContext('2d', { willReadFrequently: true });
  if (!inCtx) throw new Error('Could not get 2D context for DEM analysis');

  inCtx.drawImage(imgBitmap, 0, 0);
  const demData = inCtx.getImageData(0, 0, width, height);
  const d = demData.data;

  // Unpack elevation into Float32Array (Terrarium formula: (R * 256 + G + B / 256) - 32768)
  const elevs = new Float32Array(width * height);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    elevs[p] = (d[i] * 256 + d[i + 1] + d[i + 2] / 256) - 32768;
  }

  const metersPerPixel = getMetersPerPixel(tileCoords.z, tileCoords.y, width);

  // Prepare output RGBA canvas
  const outCanvas = new OffscreenCanvas(width, height);
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Could not get 2D context for output overlay');

  const outImgData = outCtx.createImageData(width, height);
  const outData = outImgData.data;

  // 3x3 Sobel/Horn Convolution Filter
  for (let r = 0; r < height; r++) {
    const rPrev = r > 0 ? r - 1 : 0;
    const rNext = r < height - 1 ? r + 1 : height - 1;
    const rPrevOffset = rPrev * width;
    const rCurrOffset = r * width;
    const rNextOffset = rNext * width;

    for (let c = 0; c < width; c++) {
      const cPrev = c > 0 ? c - 1 : 0;
      const cNext = c < width - 1 ? c + 1 : width - 1;

      const z00 = elevs[rPrevOffset + cPrev];
      const z10 = elevs[rPrevOffset + c];
      const z20 = elevs[rPrevOffset + cNext];

      const z01 = elevs[rCurrOffset + cPrev];
      const z21 = elevs[rCurrOffset + cNext];

      const z02 = elevs[rNextOffset + cPrev];
      const z12 = elevs[rNextOffset + c];
      const z22 = elevs[rNextOffset + cNext];

      // Horizontal & vertical elevation gradients
      const dzdx = ((z20 + 2 * z21 + z22) - (z00 + 2 * z01 + z02)) / (8 * metersPerPixel);
      const dzdy = ((z02 + 2 * z12 + z22) - (z00 + 2 * z10 + z20)) / (8 * metersPerPixel);

      const riseRun = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
      const slopeDeg = Math.atan(riseRun) * (180 / Math.PI);
      const idx = (rCurrOffset + c) * 4;

      if (type === 'slope') {
        // SLOPE ANGLE (CalTopo Avalanche Grade):
        // Flat (<22°): Transparent to preserve underlying basemap & trails
        // 22°-27°: Light green-gold (gentle cruising)
        // 27°-30°: Yellow (caution / transition)
        // 30°-35°: Orange (prime avalanche release zone)
        // 35°-40°: Red / Crimson (high-frequency avalanche zone)
        // 40°-45°: Deep Magenta (extreme steep)
        // 45°-60°: Dark Violet (cliff bands / couloirs)
        // >=60°: Charcoal Black (vertical walls)
        if (slopeDeg < 22) {
          outData[idx + 3] = 0; // transparent
        } else if (slopeDeg < 27) {
          outData[idx] = 160;
          outData[idx + 1] = 200;
          outData[idx + 2] = 80;
          outData[idx + 3] = 140;
        } else if (slopeDeg < 30) {
          outData[idx] = 245;
          outData[idx + 1] = 205;
          outData[idx + 2] = 40;
          outData[idx + 3] = 210;
        } else if (slopeDeg < 35) {
          outData[idx] = 235;
          outData[idx + 1] = 115;
          outData[idx + 2] = 25;
          outData[idx + 3] = 225;
        } else if (slopeDeg < 40) {
          outData[idx] = 210;
          outData[idx + 1] = 35;
          outData[idx + 2] = 45;
          outData[idx + 3] = 235;
        } else if (slopeDeg < 45) {
          outData[idx] = 145;
          outData[idx + 1] = 20;
          outData[idx + 2] = 60;
          outData[idx + 3] = 240;
        } else if (slopeDeg < 60) {
          outData[idx] = 75;
          outData[idx + 1] = 20;
          outData[idx + 2] = 85;
          outData[idx + 3] = 245;
        } else {
          outData[idx] = 30;
          outData[idx + 1] = 15;
          outData[idx + 2] = 35;
          outData[idx + 3] = 250;
        }
      } else {
        // ASPECT (Compass Solar Exposure / Fall-Line Direction):
        // Flat valleys (<4°): Transparent
        // N (337.5°-22.5°): Cool Blue (cold, shaded winter powder, persistent weak layer preservation)
        // NE (22.5°-67.5°): Teal
        // E (67.5°-112.5°): Green (morning sun)
        // SE (112.5°-157.5°): Yellow-Green
        // S (157.5°-202.5°): Amber / Gold (intense solar radiation, corn snow / wet slides)
        // SW (202.5°-247.5°): Warm Orange
        // W (247.5°-292.5°): Coral / Red (afternoon sun, wind crusts)
        // NW (292.5°-337.5°): Violet / Indigo
        if (slopeDeg < 4) {
          outData[idx + 3] = 0;
        } else {
          let aspectDeg = Math.atan2(-dzdx, dzdy) * (180 / Math.PI);
          if (aspectDeg < 0) aspectDeg += 360;

          let rVal = 0, gVal = 0, bVal = 0;
          if (aspectDeg >= 337.5 || aspectDeg < 22.5) {
            rVal = 30; gVal = 95; bVal = 175; // North (Cool Blue)
          } else if (aspectDeg < 67.5) {
            rVal = 0; gVal = 168; bVal = 150; // Northeast (Teal)
          } else if (aspectDeg < 112.5) {
            rVal = 65; gVal = 170; bVal = 140; // East (Emerald Green)
          } else if (aspectDeg < 157.5) {
            rVal = 145; gVal = 190; bVal = 110; // Southeast (Yellow-Green)
          } else if (aspectDeg < 202.5) {
            rVal = 245; gVal = 200; bVal = 75; // South (Solar Amber/Gold)
          } else if (aspectDeg < 247.5) {
            rVal = 245; gVal = 145; bVal = 30; // Southwest (Warm Orange)
          } else if (aspectDeg < 292.5) {
            rVal = 235; gVal = 80; bVal = 50; // West (Coral/Red)
          } else {
            rVal = 100; gVal = 85; bVal = 160; // Northwest (Violet/Indigo)
          }

          outData[idx] = rVal;
          outData[idx + 1] = gVal;
          outData[idx + 2] = bVal;
          outData[idx + 3] = 220;
        }
      }
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  const outBlob = await outCanvas.convertToBlob({ type: 'image/png' });
  return await outBlob.arrayBuffer();
}

/**
 * Creates custom MapLibre tile protocol action for Slope or Aspect.
 */
function createProtocolHandler(type: 'slope' | 'aspect') {
  return async (params: RequestParameters, abortController: AbortController) => {
    const rawUrl = params.url.replace(`${type}://`, 'https://');
    const tileCoords = parseTileCoordinates(rawUrl);

    if (!tileCoords) {
      throw new Error(`Invalid tile URL for ${type} protocol: ${params.url}`);
    }

    const cacheKey = getCacheKey(type, tileCoords.z, tileCoords.x, tileCoords.y);
    const cachedBuffer = processedTileCache.get(cacheKey);
    if (cachedBuffer) {
      return { data: cachedBuffer };
    }

    // Fetch the Mapterhorn Terrarium DEM WebP tile
    const response = await fetch(rawUrl, { signal: abortController.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch DEM tile: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const imgBitmap = await createImageBitmap(blob);

    const buffer = await processDemTile(type, imgBitmap, tileCoords);
    addToCache(cacheKey, buffer);

    return { data: buffer };
  };
}

let protocolsRegistered = false;

/**
 * Registers custom slope:// and aspect:// tile protocols with MapLibre GL.
 * Idempotent: safe to invoke multiple times across component lifecycle.
 */
export function registerTerrainAnalysisProtocols() {
  if (protocolsRegistered) return;
  protocolsRegistered = true;

  try {
    maplibregl.addProtocol('slope', createProtocolHandler('slope'));
  } catch (err) {
    console.warn('Could not register slope protocol:', err);
  }

  try {
    maplibregl.addProtocol('aspect', createProtocolHandler('aspect'));
  } catch (err) {
    console.warn('Could not register aspect protocol:', err);
  }
}
