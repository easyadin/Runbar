import { app } from 'electron';
import path from 'path';
import { RunbarApp } from './app';
import { createServiceLogger } from '../shared/logger';
import { eventBus } from '../shared/events';
import { config } from '../shared/config';

const log = createServiceLogger('Main');

// Global reference to prevent garbage collection
let runbarApp: RunbarApp | null = null;

// Configure app
app.setName(config.app.name);
app.setAppUserModelId(config.build.appId);

// Set app icon for tray (not dock for tray apps)
const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');

async function initializeApp(): Promise<void> {
  try {
    log.info('Starting Runbar application');
    
    // Create and initialize the main app
    runbarApp = new RunbarApp({
      iconPath,
      enableLogging: true,
    });
    
    await runbarApp.initialize();
    
    log.info('Runbar application started successfully');
  } catch (error) {
    log.error('Failed to start Runbar application', error as Error);
    app.quit();
  }
}

// App lifecycle events
app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (runbarApp && runbarApp.isReady()) {
    // Could open settings window here if needed
  }
});

app.on('before-quit', async () => {
  try {
    log.info('Application quitting, cleaning up...');
    
    // Emit shutdown event to trigger cleanup
    eventBus.emitAppShutdown();
    
    // Give some time for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    log.info('Cleanup completed');
  } catch (error) {
    log.error('Error during cleanup', error as Error);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception', error);
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  log.warn('Unhandled rejection', { reason: String(reason), promise: String(promise) });
  app.quit();
});

// Export for potential external use
export { runbarApp }; 