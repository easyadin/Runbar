import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

export class Dashboard {
  private window: BrowserWindow | null = null;
  private static ipcHandlersRegistered = false;

  constructor() {
    this.setupIpcHandlers();
  }

  public show(): void {
    if (this.window) {
      this.window.show();
      this.window.focus();
      return;
    }

    this.window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Runbar',
      icon: path.join(__dirname, '../assets/icon.png'),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      show: false,
      vibrancy: 'under-window',
      visualEffectState: 'active'
    });

    // Load the dashboard HTML
    const htmlPath = path.join(__dirname, 'dashboard.html');
    console.log('[Dashboard] Loading HTML from:', htmlPath);
    
    this.window.loadFile(htmlPath).catch((error) => {
      console.error('[Dashboard] Failed to load HTML:', error);
      // Fallback to simple HTML content
      this.window?.loadURL('data:text/html,<html><body><h1>Dashboard Loading...</h1><p>If this persists, check the console for errors.</p></body></html>');
    });

    this.window.once('ready-to-show', () => {
      console.log('[Dashboard] Window ready to show');
      this.window?.show();
    });

    this.window.on('closed', () => {
      console.log('[Dashboard] Window closed');
      this.window = null;
    });

    this.window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error('[Dashboard] Failed to load:', errorCode, errorDescription);
    });
  }

  public hide(): void {
    this.window?.hide();
  }

  public close(): void {
    this.window?.close();
  }

  public isVisible(): boolean {
    return this.window?.isVisible() || false;
  }

  private setupIpcHandlers(): void {
    // Prevent duplicate registration
    if (Dashboard.ipcHandlersRegistered) {
      console.log('[Dashboard] IPC handlers already registered, skipping...');
      return;
    }

    console.log('[Dashboard] Setting up IPC handlers...');

    // Remove any existing handlers first
    try {
      ipcMain.removeHandler('dashboard:get-services');
      ipcMain.removeHandler('dashboard:get-groups');
      ipcMain.removeHandler('dashboard:start-service');
      ipcMain.removeHandler('dashboard:stop-service');
      ipcMain.removeHandler('dashboard:get-stats');
    } catch (error) {
      // Ignore errors if handlers don't exist
    }

    // Get services data
    ipcMain.handle('dashboard:get-services', async () => {
      console.log('[Dashboard] Getting services...');
      const { Storage } = require('./storage');
      const storage = new Storage();
      const services = await storage.getServices();
      console.log('[Dashboard] Services loaded:', services.length);
      return services;
    });

    // Get groups data
    ipcMain.handle('dashboard:get-groups', async () => {
      console.log('[Dashboard] Getting groups...');
      const { Storage } = require('./storage');
      const storage = new Storage();
      const groups = await storage.getGroups();
      console.log('[Dashboard] Groups loaded:', groups.length);
      return groups;
    });

    // Start service
    ipcMain.handle('dashboard:start-service', async (_event, servicePath: string) => {
      const { ProcessManager } = require('./processManager');
      const processManager = new ProcessManager();
      const { Storage } = require('./storage');
      const storage = new Storage();
      
      const services = await storage.getServices();
      const service = services.find((s: any) => s.path === servicePath);
      
      if (service) {
        await processManager.startService(service);
        return { success: true };
      }
      return { success: false, error: 'Service not found' };
    });

    // Stop service
    ipcMain.handle('dashboard:stop-service', async (_event, servicePath: string) => {
      const { ProcessManager } = require('./processManager');
      const processManager = new ProcessManager();
      const { Storage } = require('./storage');
      const storage = new Storage();
      
      const services = await storage.getServices();
      const service = services.find((s: any) => s.path === servicePath);
      
      if (service) {
        await processManager.stopService(service);
        return { success: true };
      }
      return { success: false, error: 'Service not found' };
    });

    // Get system stats
    ipcMain.handle('dashboard:get-stats', async () => {
      const { Storage } = require('./storage');
      const storage = new Storage();
      const services = await storage.getServices();
      const groups = await storage.getGroups();

      const runningServices = services.filter((s: any) => s.status === 'running');
      const stoppedServices = services.filter((s: any) => s.status === 'stopped');

      return {
        totalServices: services.length,
        runningServices: runningServices.length,
        stoppedServices: stoppedServices.length,
        totalGroups: groups.length
      };
    });

    Dashboard.ipcHandlersRegistered = true;
    console.log('[Dashboard] IPC handlers registered successfully');
  }
} 