#!/usr/bin/env node

/**
 * Node runner for backup script
 */
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

const pythonScript = path.join(__dirname, 'backup.py');

// Try running python3
const result = spawnSync('python3', [pythonScript], {
  cwd: rootDir,
  stdio: 'inherit'
});

if (result.error || result.status !== 0) {
  // If python3 is not found, try 'python'
  const pyResult = spawnSync('python', [pythonScript], {
    cwd: rootDir,
    stdio: 'inherit'
  });
  if (pyResult.error || pyResult.status !== 0) {
    console.error('Ralat: Gagal menjalankan scripts/backup.py. Sila pastikan python3 telah dipasang.');
    process.exit(1);
  }
}
