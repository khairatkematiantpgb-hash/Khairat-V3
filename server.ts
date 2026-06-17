import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const STATE_FILE_PATH = path.join(process.cwd(), 'db_state.json');

// Helper to load state from server file or return null if not present
function loadServerState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const content = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error loading server state:', error);
  }
  return null;
}

// Helper to save state to server file
function saveServerState(state: any) {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving server state:', error);
    return false;
  }
}

async function startServer() {
  const app = express();

  // Support large JSON payloads because the ledger database state can be large
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Route: Get State
  app.get('/api/state', (req, res) => {
    const state = loadServerState();
    if (state) {
      res.json({ success: true, state });
    } else {
      res.json({ success: false, message: 'No state file found' });
    }
  });

  // API Route: Save State
  app.post('/api/state', (req, res) => {
    const { state } = req.body;
    if (!state) {
      return res.status(400).json({ success: false, message: 'Missing state payload' });
    }
    const success = saveServerState(state);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, message: 'Failed to save state on server disk' });
    }
  });

  // Vite development middleware vs production static assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
