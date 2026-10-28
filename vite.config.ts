import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig, Plugin} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { geminiMiddleware, configureGeminiAuth } from './server/geminiApi';
import { handleLabDataApi } from './server/labDbMiddleware';
import { verifySessionToken } from './server/labDbServer';

// SECURITY FIX (audit #10): wire the Gemini auth seam in dev exactly like
// production (server.ts) does, otherwise `npm run dev` leaves the guard
// fail-closed and every /api/gemini/* call returns 401.
configureGeminiAuth((token: string) => {
  const payload = verifySessionToken(token);
  return payload ? { userId: payload.userId, role: payload.role } : null;
});

// Laboratory Database Server Middleware (Central cross-device persistent store)
function labDatabasePlugin(): Plugin {
  return {
    name: 'vite-plugin-lab-database',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handleLabDataApi(req, res, next);
      });
    }
  };
}

// Gemini API Server Middleware
// BUG FIX (audit "logic forked between server.ts and vite.config.ts"): this
// used to be a ~150-line hand-rolled duplicate of the Express routes with NO
// authentication and NO rate limiting — i.e. `npm run dev` silently exposed an
// open, quota-burnable proxy to the paid Gemini API, and dev behavior diverged
// from production. It now mounts the SHARED implementation from
// server/geminiApi.ts (same session guard, same per-IP budget, same input
// validation, same prompts). There is exactly one copy of this logic.

function geminiApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-gemini-api',
    configureServer(server) {
      server.middlewares.use(geminiMiddleware());
    },
  };
}

// LINT.IfChange(aistudio_media_plugin)
function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(
              __dirname,
              'public',
              'assets',
              'aistudio',
            );
            const filePath = path.resolve(__dirname, 'public', relativePath);
            if (
              filePath.startsWith(aistudioDir + path.sep) &&
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isFile()
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp',
                '.ico': 'image/x-icon',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogv': 'video/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.pdf': 'application/pdf',
              };
              res.setHeader(
                'Content-Type',
                mimeMap[ext] || 'application/octet-stream',
              );
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {
            // Fall through if URI decoding or file access fails
          }
        }
        next();
      });
    },
  };
}
// LINT.ThenChange(//depot/google3/java/com/google/alkali/boq/makersuite/applet_dev_service/templates/initializers/react_theme/vite.config.ts:aistudio_media_plugin)

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aistudioMediaPlugin(), geminiApiPlugin(), labDatabasePlugin()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    build: {
      // PERF FIX (audit #46): lowered from 1600KB — the previous value was
      // effectively silencing the warning while heavy libs sat in the main
      // chunk. With the lazy imports + manualChunks below, real chunks are
      // much smaller and a genuine regression will now surface again.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // PERF: split heavy libraries into cacheable vendor chunks so the
          // main bundle stays small and app-code edits don't invalidate them.
          // BUGFIX (audit #46): docx / html2pdf.js (+ its bundled jspdf) were
          // missing here and landed in the entry chunk, slowing first load.
          // They are also dynamically imported on click now, so Rollup emits
          // them as separate async chunks regardless; this pins stable names.
          manualChunks: {
            three: ['three'],
            charts: ['recharts'],
            icons: ['lucide-react'],
            docx: ['docx'],
            pdf: ['html2pdf.js'],
          },
        },
      },
    },
    server: {
      port: 3000,
      host: process.env.DEV_HOST || '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // AUDIT FIX (#96): `watch: null` / `watch: {}` are NOT valid Vite server
      // options and silently did nothing — the "disable watching to save CPU"
      // comment was aspirational, files were always watched. The documented
      // API for this is `server.watch: { ignored: ['**'] }`, which makes
      // chokidar watch nothing and stops polling/spinning during agent edits.
      ...(process.env.DISABLE_HMR === 'true'
        ? { watch: { ignored: ['**'] } }
        : {}),
    },
  };
});

