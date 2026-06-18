import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

const STATE_FILE_PATH = path.join(process.cwd(), 'db_state.json');

function loadServerState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const content = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error loading server state via Vite:', error);
  }
  return null;
}

function saveServerState(state: any) {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving server state via Vite:', error);
    return false;
  }
}

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'api-state-sync',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.split('?')[0] === '/api/state') {
              if (req.method === 'GET') {
                const state = loadServerState();
                res.setHeader('Content-Type', 'application/json');
                if (state) {
                  res.end(JSON.stringify({ success: true, state }));
                } else {
                  res.end(JSON.stringify({ success: false, message: 'No state file found' }));
                }
                return;
              }
              if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => {
                  body += chunk;
                });
                req.on('end', () => {
                  try {
                    const payload = JSON.parse(body);
                    if (payload && payload.state) {
                      const success = saveServerState(payload.state);
                      res.setHeader('Content-Type', 'application/json');
                      if (success) {
                        res.end(JSON.stringify({ success: true }));
                      } else {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ success: false, message: 'Failed to write state via Vite' }));
                      }
                    } else {
                      res.statusCode = 400;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ success: false, message: 'Missing state payload' }));
                    }
                  } catch (e: any) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: false, message: e.message }));
                  }
                });
                return;
              }
            }
            next();
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
