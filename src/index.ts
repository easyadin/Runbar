import { app, BrowserWindow, Tray, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs-extra';

app.setName('Runbar');
app.setAppUserModelId('com.runbar.app');

import { ProcessManager } from './processManager'; 
import { Storage } from './storage';
import { Service, Settings, ServiceStatus } from './types';

class RunbarApp {
  private tray: Tray | null = null;
  private processManager: ProcessManager | null = null;
  private storage: Storage | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private services: Service[] = [];
  private settings: Settings | null = null;

  async initialize(): Promise<void> {
    try {
      this.storage = new Storage();
      await this.storage.initialize();
      
      this.services = await this.storage.getServices();
      this.settings = await this.storage.getSettings();
      
      this.processManager = new ProcessManager();
      
      this.createTray();
      
      this.validateServices();
      
      if (this.settings?.globalAutoStart) {
        this.autoStartServices();
      }
      
      console.log('Runbar initialized successfully');
    } catch (error) {
      console.error('[index.ts] Failed to initialize Runbar:', error);
      app.quit();
    }
  }

  private createTray(): void {
    try {
      const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
      console.log('Loading icon from:', iconPath);
      
      const icon = nativeImage.createFromPath(iconPath);
      console.log('Icon loaded, size:', icon.getSize());
      
      const resizedIcon = icon.resize({ width: 16, height: 16 });
      console.log('Icon resized to:', resizedIcon.getSize());
      
      this.tray = new Tray(resizedIcon);
      this.tray.setToolTip('Runbar - Click for menu');
      
      this.tray.on('click', () => {
        console.log('Tray icon clicked!');
        this.tray?.popUpContextMenu();
      });
      console.log('[index.ts] About to instantiate TrayMenu');
      if (this.tray && this.processManager && this.storage) {
        new (require('./trayMenu').TrayMenu)(this.tray, this.processManager, this.storage);
        console.log('[index.ts] TrayMenu instantiated');
      }
      
      console.log('Tray created successfully');
      
      this.updateTrayStatus('stopped');
    } catch (error) {
      console.error('Error creating tray:', error);
    }
  }

  private updateTrayStatus(status: ServiceStatus): void {
    console.log(`Tray status: ${status}`);
  }

  private async validateServices(): Promise<void> {
    console.log('Validating services...');
    
    for (const service of this.services) {
      try {
        const pathExists = await fs.pathExists(service.path);
        if (!pathExists) {
          console.warn(`Service path not found: ${service.path}`);
          // Could show warning in UI
        }
        
        // Check dependencies (basic check)
        // This could be expanded to check for Node.js, Ruby, etc.
        
      } catch (error) {
        console.error(`Error validating service ${service.name}:`, error);
      }
    }
  }

  private async autoStartServices(): Promise<void> {
    console.log('Auto-starting enabled services...');
    
    if (!this.processManager) {
      console.error('Process manager not initialized');
      return;
    }
    
    for (const service of this.services) {
      if (service.autoStart) {
        try {
          await this.processManager.startService(service);
        } catch (error) {
          console.error(`Failed to auto-start ${service.name}:`, error);
        }
      }
    }
  }

  createSettingsWindow(): void {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return;
    }

    this.settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      title: 'Runbar Settings',
      resizable: true,
      minimizable: true,
      maximizable: true
    });

    // Load settings page (Create this later)
    this.settingsWindow.loadURL('data:text/html,<h1>Settings UI Coming Soon</h1>');

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }
}

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);
  app.dock.setIcon(appIcon);
  
  app.setName('Runbar');
  app.setAppUserModelId('com.runbar.app');
  
  const runbar = new RunbarApp();
  runbar.initialize();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
});

app.on('before-quit', async () => {
  console.log('Stopping all services...');
}); 