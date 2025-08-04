import { BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';

export class Widget {
  private window: BrowserWindow | null = null;
  private widgetType: 'status' | 'logs' | 'quick-actions' = 'status';
  private static ipcHandlersRegistered = false;

  constructor(widgetType: 'status' | 'logs' | 'quick-actions' = 'status') {
    this.widgetType = widgetType;
    this.setupIpcHandlers();
  }

  public show(): void {
    if (this.window) {
      this.window.show();
      this.window.focus();
      return;
    }

    // Get screen size for positioning
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;

    // Position widget in top-right corner
    const widgetWidth = 300;
    const widgetHeight = this.widgetType === 'logs' ? 400 : 200;
    const x = width - widgetWidth - 20;
    const y = 20;

    this.window = new BrowserWindow({
      width: widgetWidth,
      height: widgetHeight,
      x,
      y,
      title: 'Runbar',
      icon: path.join(__dirname, '../assets/icon.png'),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      show: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: true
    });

    // Load the widget HTML
    this.window.loadFile(path.join(__dirname, `widget-${this.widgetType}.html`));

    this.window.once('ready-to-show', () => {
      this.window?.show();
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    // Make window draggable
    this.window.setMovable(true);
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

  public updatePosition(x: number, y: number): void {
    this.window?.setPosition(x, y);
  }

  private setupIpcHandlers(): void {
    // Prevent duplicate registration
    if (Widget.ipcHandlersRegistered) {
      console.log('[Widget] IPC handlers already registered, skipping...');
      return;
    }

    console.log('[Widget] Setting up IPC handlers...');

    // Remove any existing handlers first
    try {
      ipcMain.removeHandler('widget:get-services');
      ipcMain.removeHandler('widget:get-stats');
      ipcMain.removeHandler('widget:start-all');
      ipcMain.removeHandler('widget:stop-all');
      ipcMain.removeHandler('widget:get-logs');
      ipcMain.removeHandler('widget:close');
    } catch (error) {
      // Ignore errors if handlers don't exist
    }

    // Get services data for status widget
    ipcMain.handle('widget:get-services', async () => {
      const { Storage } = require('./storage');
      const storage = new Storage();
      return await storage.getServices();
    });

    // Get system stats
    ipcMain.handle('widget:get-stats', async () => {
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

    // Start all services
    ipcMain.handle('widget:start-all', async () => {
      const { ProcessManager } = require('./processManager');
      const { Storage } = require('./storage');
      const processManager = new ProcessManager();
      const storage = new Storage();
      
      const services = await storage.getServices();
      for (const service of services) {
        await processManager.startService(service);
      }
      return { success: true };
    });

    // Stop all services
    ipcMain.handle('widget:stop-all', async () => {
      const { ProcessManager } = require('./processManager');
      const { Storage } = require('./storage');
      const processManager = new ProcessManager();
      const storage = new Storage();
      
      const services = await storage.getServices();
      for (const service of services) {
        await processManager.stopService(service);
      }
      return { success: true };
    });

    // Get logs for logs widget
    ipcMain.handle('widget:get-logs', async () => {
      const { ProcessManager } = require('./processManager');
      const { Storage } = require('./storage');
      const processManager = new ProcessManager();
      const storage = new Storage();
      
      const services = await storage.getServices();
      const logs: any = {};
      
      for (const service of services) {
        logs[service.name] = processManager.getServiceLogs(service.path);
      }
      
      return logs;
    });

    // Close widget
    ipcMain.handle('widget:close', async () => {
      this.close();
      return { success: true };
    });

    Widget.ipcHandlersRegistered = true;
    console.log('[Widget] IPC handlers registered successfully');
  }
}

// Widget manager to handle multiple widgets
export class WidgetManager {
  private widgets: Map<string, Widget> = new Map();

  public showStatusWidget(): void {
    const widget = new Widget('status');
    this.widgets.set('status', widget);
    widget.show();
  }

  public showLogsWidget(): void {
    const widget = new Widget('logs');
    this.widgets.set('logs', widget);
    widget.show();
  }

  public showQuickActionsWidget(): void {
    const widget = new Widget('quick-actions');
    this.widgets.set('quick-actions', widget);
    widget.show();
  }

  public hideWidget(widgetType: string): void {
    const widget = this.widgets.get(widgetType);
    if (widget) {
      widget.hide();
    }
  }

  public closeWidget(widgetType: string): void {
    const widget = this.widgets.get(widgetType);
    if (widget) {
      widget.close();
      this.widgets.delete(widgetType);
    }
  }

  public closeAllWidgets(): void {
    for (const [_type, widget] of this.widgets) {
      widget.close();
    }
    this.widgets.clear();
  }

  public isWidgetVisible(widgetType: string): boolean {
    const widget = this.widgets.get(widgetType);
    return widget ? widget.isVisible() : false;
  }
} 