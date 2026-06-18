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

  // API Route: Shorten URL (Ad-free & Direct Redirect)
  app.post('/api/shorten', async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL diperlukan' });
    }
    
    // 1st Priority: is.gd (100% free, direct redirection, absolutely NO ads or splash screens)
    try {
      console.log('Shortening with is.gd:', url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const shortUrl = await response.text();
        if (shortUrl && shortUrl.startsWith('http')) {
          console.log('is.gd produced:', shortUrl);
          return res.json({ success: true, shortUrl });
        }
      }
    } catch (error) {
      console.error('is.gd failed, trying cleanuri:', error);
    }

    // 2nd Priority: cleanuri.com (100% free, no ads, direct redirections)
    try {
      console.log('Shortening with cleanuri.com:', url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch('https://cleanuri.com/api/v1/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `url=${encodeURIComponent(url)}`,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (data.result_url && data.result_url.startsWith('http')) {
          console.log('cleanuri produced:', data.result_url);
          return res.json({ success: true, shortUrl: data.result_url });
        }
      }
    } catch (error) {
      console.error('cleanuri failed, trying tinyurl:', error);
    }

    // 3rd Priority: tinyurl.com as absolute fallback
    try {
      console.log('Shortening with tinyurl:', url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const shortUrl = await response.text();
        if (shortUrl && shortUrl.startsWith('http')) {
          console.log('tinyurl produced fallback:', shortUrl);
          return res.json({ success: true, shortUrl });
        }
      }
    } catch (error) {
      console.error('tinyurl also failed:', error);
    }

    res.status(500).json({ success: false, message: 'Gagal memproses pautan pendek secara automatik.' });
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
