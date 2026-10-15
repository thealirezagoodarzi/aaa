import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

function getCurrentDir(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
}

/**
 * FIX #1 (VPS compatibility / relative-path bug):
 * Resolve the project root WITHOUT relying on process.cwd().
 *
 * When the app is run as `node dist/server.cjs` under a systemd/PM2 unit whose
 * WorkingDirectory differs from the deployment folder, `process.cwd()` points
 * somewhere else and data/laboratory_db.json silently disappears — the server
 * then re-initializes an EMPTY database (apparent total data loss).
 *
 * Strategy:
 *  1. Explicit override via LAB_DATA_ROOT env var (highest priority).
 *  2. Walk upward from __dirname (dist/ or server/) looking for package.json;
 *     that directory is the real project root.
 *  3. Fall back to process.cwd() only if nothing else matches.
 */
// BUG FIX (audit item #68): the walk-up search used to accept ANY ancestor
// directory containing a package.json. In containerized or monorepo layouts
// (an app mounted under a folder that itself has package.json, hoisted
// node_modules, etc.) the FIRST match can be the WRONG root — the server then
// happily creates an empty data/laboratory_db.json in the wrong place while
// the real database sits untouched elsewhere: silent total "data loss".
//
// The heuristic is now anchored: a candidate root must contain BOTH
// package.json AND the project's server entry (server.ts / server.js). A
// stray upstream package.json no longer qualifies, and if nothing matches we
// fail fast instead of silently re-initializing an empty DB.
function looksLikeProjectRoot(dir: string): boolean {
  if (!fs.existsSync(path.join(dir, 'package.json'))) return false;
  return (
    fs.existsSync(path.join(dir, 'server.ts')) ||
    fs.existsSync(path.join(dir, 'server.js')) ||
    fs.existsSync(path.join(dir, 'server.cjs'))
  );
}

export function resolveProjectRoot(): string {
  const override = process.env.LAB_DATA_ROOT;
  if (override && override.trim()) {
    return path.resolve(override.trim());
  }

  let dir = getCurrentDir();
  for (let i = 0; i < 6; i++) {
    if (looksLikeProjectRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Last resort: only trust cwd when it actually looks like this project.
  if (looksLikeProjectRoot(process.cwd())) return process.cwd();

  throw new Error(
    '[pathUtils] Could not locate the project root (a directory containing ' +
      'package.json AND server.ts/server.js). Set LAB_DATA_ROOT explicitly. ' +
      'Refusing to start against a possibly-empty implicit data directory.'
  );
}

export const PROJECT_ROOT = resolveProjectRoot();
