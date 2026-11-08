/* =========================================================================
   URL & ASSET PATH HELPERS
   ========================================================================= */

/**
 * Resolves a relative public asset path against Vite's base URL
 * (handles deployment subpaths correctly, e.g. GitHub Pages or root)
 */
export const getStaticDataUrl = (relPath: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  return `${cleanBase}${cleanPath}`;
};
