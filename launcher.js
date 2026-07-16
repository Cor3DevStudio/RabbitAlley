/**
 * Rabbit Alley POS - System Launcher
 * ===================================
 * Starts backend, frontend, and Chrome kiosk mode.
 * When ANY process exits, ALL processes are terminated.
 * 
 * Usage: node launcher.js
 * 
 * Powered by CoreDev Studio
 */

import { spawn, exec, execSync } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to parse .env files without dependencies
function parseEnvFile(filePath) {
  const env = {};
  if (fs.existsSync(filePath)) {
    try {
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          env[key] = val;
        }
      }
    } catch (e) {
      // Ignore errors parsing config
    }
  }
  return env;
}

// Load env files
const rootEnv = parseEnvFile(path.join(__dirname, '.env'));
const serverEnv = parseEnvFile(path.join(__dirname, 'server', '.env'));

// Parse CLI args (e.g. node launcher.js 8081 8001 or --port=8081 --api-port=8001)
let customFrontendPort = '';
let customBackendPort = '';

process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--port=')) {
    customFrontendPort = arg.split('=')[1];
  } else if (arg.startsWith('--api-port=')) {
    customBackendPort = arg.split('=')[1];
  } else if (/^\d+$/.test(arg)) {
    if (!customFrontendPort) {
      customFrontendPort = arg;
    } else if (!customBackendPort) {
      customBackendPort = arg;
    }
  }
});

const frontendPort = customFrontendPort || process.env.PORT || process.env.VITE_PORT || rootEnv.PORT || rootEnv.VITE_PORT || '8080';
const backendPort = customBackendPort || process.env.API_PORT || rootEnv.API_PORT || serverEnv.PORT || '8000';

// Configuration
const CONFIG = {
  POS_URL: `http://localhost:${frontendPort}`,
  BACKEND_DELAY: 3000,       // Wait 3s for backend to start
  FRONTEND_POLL_MS: 500,     // Poll every 500ms for frontend ready
  FRONTEND_MAX_WAIT_MS: 60000, // Give up after 60s
  CHROME_PATHS: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ],
};

// Store all child processes
const processes = {
  backend: null,
  frontend: null,
  chrome: null,
};

let isShuttingDown = false;

// Console styling
const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
};

// Find Chrome executable
function findChrome() {
  for (const chromePath of CONFIG.CHROME_PATHS) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  return null;
}

// Wait until the frontend URL responds (so we don't open Chrome to an empty/refused connection)
function waitForFrontendReady() {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - start > CONFIG.FRONTEND_MAX_WAIT_MS) {
        reject(new Error(`Frontend did not become ready at ${CONFIG.POS_URL} within ${CONFIG.FRONTEND_MAX_WAIT_MS / 1000}s`));
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      fetch(CONFIG.POS_URL, { method: 'HEAD', signal: controller.signal })
        .then((res) => {
          clearTimeout(timeout);
          if (res.ok || res.status === 304) {
            log.success('Frontend is ready');
            resolve();
            return;
          }
          setTimeout(check, CONFIG.FRONTEND_POLL_MS);
        })
        .catch(() => {
          clearTimeout(timeout);
          setTimeout(check, CONFIG.FRONTEND_POLL_MS);
        });
    }
    log.info(`Waiting for frontend at ${CONFIG.POS_URL}...`);
    check();
  });
}

// Shutdown all processes
function shutdown(reason) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n');
  log.warn(`Shutdown triggered: ${reason}`);

  // Auto-backup database on exit
  log.info('Creating auto-backup of database...');
  try {
    const backupScript = path.join(__dirname, 'server', 'scripts', 'backup-db.js');
    if (fs.existsSync(backupScript)) {
      execSync(`node "${backupScript}"`, { stdio: 'inherit' });
      log.success('Database backup completed.');
    }
  } catch (err) {
    log.error(`Database auto-backup failed: ${err.message}`);
  }

  log.info('Stopping all processes...');

  // Kill all child processes
  Object.entries(processes).forEach(([name, proc]) => {
    if (proc && !proc.killed) {
      log.info(`Stopping ${name}...`);
      try {
        // On Windows, we need to kill the entire process tree
        if (os.platform() === 'win32') {
          exec(`taskkill /pid ${proc.pid} /T /F`, () => {});
        } else {
          proc.kill('SIGTERM');
        }
      } catch (e) {
        // Ignore errors
      }
    }
  });

  // Give processes time to die, then force exit
  setTimeout(() => {
    log.success('System shutdown complete.');
    process.exit(0);
  }, 2000);
}

// Start backend server
function startBackend() {
  return new Promise((resolve) => {
    log.info(`Starting backend server on port ${backendPort}...`);
    
    const serverDir = path.join(__dirname, 'server');
    processes.backend = spawn('npm', ['run', 'dev'], {
      cwd: serverDir,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: backendPort },
    });

    processes.backend.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.log(`  \x1b[90m[API]\x1b[0m ${output}`);
    });

    processes.backend.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output && !output.includes('ExperimentalWarning')) {
        console.log(`  \x1b[90m[API]\x1b[0m ${output}`);
      }
    });

    processes.backend.on('exit', (code) => {
      if (!isShuttingDown) {
        shutdown(`Backend exited with code ${code}`);
      }
    });

    // Wait for backend to initialize
    setTimeout(() => {
      log.success('Backend server started');
      resolve();
    }, CONFIG.BACKEND_DELAY);
  });
}

// Start frontend server
function startFrontend() {
  return new Promise((resolve) => {
    log.info(`Starting frontend server on port ${frontendPort}...`);
    
    processes.frontend = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: frontendPort, API_PORT: backendPort },
    });

    processes.frontend.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.log(`  \x1b[90m[UI]\x1b[0m ${output}`);
    });

    processes.frontend.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.log(`  \x1b[90m[UI]\x1b[0m ${output}`);
    });

    processes.frontend.on('exit', (code) => {
      if (!isShuttingDown) {
        shutdown(`Frontend exited with code ${code}`);
      }
    });

    // Give Vite a moment to start (ready check happens before Chrome)
    setTimeout(() => {
      log.success('Frontend server started');
      resolve();
    }, 2000);
  });
}

// Start Chrome in kiosk mode
function startChrome() {
  return new Promise((resolve, reject) => {
    log.info('Starting Chrome in kiosk mode...');
    
    const chromePath = findChrome();
    if (!chromePath) {
      reject(new Error('Chrome not found'));
      return;
    }

    const chromeArgs = [
      '--kiosk',
      '--disable-pinch',
      '--overscroll-history-navigation=0',
      '--disable-session-crashed-bubble',
      '--disable-infobars',
      '--noerrdialogs',
      '--disable-translate',
      '--no-first-run',
      '--disable-features=TranslateUI',
      '--new-window',
      CONFIG.POS_URL,
    ];

    processes.chrome = spawn(chromePath, chromeArgs, {
      detached: false,
      stdio: 'ignore',
    });

    processes.chrome.on('exit', (code) => {
      if (!isShuttingDown) {
        shutdown(`Chrome exited with code ${code}`);
      }
    });

    processes.chrome.on('error', (err) => {
      log.error(`Chrome error: ${err.message}`);
      reject(err);
    });

    setTimeout(() => {
      log.success('Chrome kiosk started');
      resolve();
    }, 2000);
  });
}

// Main entry point
async function main() {
  console.log('\n==========================================');
  console.log('  Rabbit Alley POS - System Launcher');
  console.log('  Powered by CoreDev Studio');
  console.log('==========================================\n');
  console.log(`  Configured ports:`);
  console.log(`  - Frontend: ${frontendPort} (UI)`);
  console.log(`  - Backend : ${backendPort} (API)`);
  console.log('==========================================\n');
  console.log('  NOTE: Closing ANY window will shutdown');
  console.log('        the entire POS system.\n');

  try {
    await startBackend();
    await startFrontend();
    await waitForFrontendReady();
    await startChrome();

    console.log('\n==========================================');
    log.success('POS System is running!');
    console.log('==========================================\n');
    console.log('  Press Ctrl+C here to shutdown everything\n');

  } catch (err) {
    log.error(`Startup failed: ${err.message}`);
    shutdown('Startup error');
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => shutdown('User interrupted (Ctrl+C)'));
process.on('SIGTERM', () => shutdown('Terminated'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  log.error(`Uncaught exception: ${err.message}`);
  shutdown('Uncaught exception');
});

// Start the system
main();
