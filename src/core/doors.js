/* Walk-through doors — crossing a line walks you through it and the ink
 * covers the route swap. Extracted from main.js so it can be tested:
 *   home      deep end (z < zMin + .15)      → /projects
 *   /projects either end of the rail         → /
 * Returns the target path, or null when you are not on a door line. */
export function exitTarget(path, p, bounds, rail) {
  if (path === '/') return p.z < bounds.zMin + 0.15 ? '/projects' : null;
  if (path === '/projects') {
    return (p.x < rail.railMin + 0.5 || p.x > rail.exitX - 0.5) ? '/' : null;
  }
  return null;
}
