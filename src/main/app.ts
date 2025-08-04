// BrowserWindow no longer needed
import type { Service, Group, Settings } from '../shared/types';
import { createServiceLogger } from '../shared/logger';
import { eventBus } from '../shared/events';
import { StorageService } from '../services/storage';
import { ServiceDiscoveryService } from '../services/discovery';
import { TrayMenuController } from '../ui/trayMenuController';
import { ProcessManager } from '../core/processManager';
import { SettingsWindow } from '../ui/settingsWindow';

const log = createServiceLogger('App');

export interface AppOptions {
  configDir?: string;
  iconPath?: string;
  enableLogging?: boolean;
}

export class RunbarApp {
  private storageService: StorageService;
  private discoveryService: ServiceDiscoveryService;
  private processManager: ProcessManager;
  private trayController: TrayMenuController | null = null;
  private settingsWindow: SettingsWindow | null = null;
  private options: AppOptions;
  private isInitialized = false;

  constructor(options: AppOptions = {}) {
    this.options = {
      enableLogging: true,
      ...options,
    };
    
    this.storageService = new StorageService(
      this.options.configDir ? { configDir: this.options.configDir } : {}
    );
    
    this.discoveryService = new ServiceDiscoveryService();
    this.processManager = new ProcessManager();
    
    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    try {
      log.info('Initializing Runbar application');
      
      // Initialize storage first
      await this.storageService.initialize();
      
      // Validate existing services
      await this.validateServices();
      
      // Initialize tray controller
      await this.initializeTrayController();
      
      // Auto-start services if enabled
      await this.handleAutoStart();
      
      this.isInitialized = true;
      eventBus.emitAppReady();
      
      log.info('Runbar application initialized successfully');
    } catch (error) {
      log.error('Failed to initialize Runbar application', error as Error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Listen for app lifecycle events
    eventBus.on('app:shutdown', () => {
      this.shutdown();
    });

    // Listen for service events
    eventBus.on('service:started', (event) => {
      log.info('Service started', { service: event.service.name });
    });

    eventBus.on('service:stopped', (event) => {
      log.info('Service stopped', { service: event.service.name });
    });

    eventBus.on('service:error', (event) => {
      log.warn('Service error', { 
        service: event.service.name, 
        error: event.data as unknown
      });
    });

    // Listen for config changes
    eventBus.on('config:changed', (event) => {
      log.info('Configuration changed', { type: event.type });
    });
  }

  private async validateServices(): Promise<void> {
    try {
      log.info('Validating existing services');
      
      const services = await this.storageService.getServices();
      const invalidServices: Service[] = [];
      
      for (const service of services) {
        const isValid = await this.discoveryService.validateServicePath(service.path);
        if (!isValid) {
          invalidServices.push(service);
          log.warn('Invalid service path', { 
            service: service.name, 
            path: service.path 
          });
        }
      }
      
      if (invalidServices.length > 0) {
        log.warn('Found invalid services', { 
          count: invalidServices.length,
          services: invalidServices.map(s => s.name)
        });
        // TODO: Show notification to user about invalid services
      }
      
      log.info('Service validation completed', { 
        total: services.length, 
        invalid: invalidServices.length 
      });
    } catch (error) {
      log.error('Failed to validate services', error as Error);
    }
  }

  private async initializeTrayController(): Promise<void> {
    try {
      log.info('Initializing tray controller');
      
      this.trayController = new TrayMenuController({
        storageService: this.storageService,
        processManager: this.processManager,
        ...(this.options.iconPath && { iconPath: this.options.iconPath }),
      });
      
      await this.trayController.initialize();
      
      log.info('Tray controller initialized successfully');
    } catch (error) {
      log.error('Failed to initialize tray controller', error as Error);
      throw error;
    }
  }

  private async handleAutoStart(): Promise<void> {
    try {
      const settings = await this.storageService.getSettings();
      
      if (!settings.globalAutoStart) {
        log.info('Auto-start disabled globally');
        return;
      }
      
      log.info('Handling auto-start for services');
      
      const services = await this.storageService.getServices();
      const autoStartServices = services.filter(s => s.autoStart);
      
      if (autoStartServices.length === 0) {
        log.info('No services configured for auto-start');
        return;
      }
      
      log.info('Auto-starting services', { 
        count: autoStartServices.length,
        services: autoStartServices.map(s => s.name)
      });
      
      for (const service of autoStartServices) {
        log.info('Auto-starting service', { service: service.name });
        await this.processManager.startService(service);
      }
    } catch (error) {
      log.error('Failed to handle auto-start', error as Error);
    }
  }

  async openSettings(): Promise<void> {
    try {
      if (this.settingsWindow && this.settingsWindow.isVisible()) {
        this.settingsWindow.show();
        return;
      }

      log.info('Opening settings window');
      
      this.settingsWindow = new SettingsWindow({
        width: 900,
        height: 700,
        title: 'Runbar Settings',
      });

      await this.settingsWindow.create();
    } catch (error) {
      log.error('Failed to open settings', error as Error);
    }
  }

  async exportConfig(): Promise<void> {
    try {
      log.info('Exporting configuration');
      
      const configData = await this.storageService.exportConfig();
      
      // TODO: Implement file save dialog
      log.info('Configuration exported', { 
        services: configData.services.length,
        groups: configData.groups.length
      });
    } catch (error) {
      log.error('Failed to export configuration', error as Error);
    }
  }

  async importConfig(configData: any): Promise<void> {
    try {
      log.info('Importing configuration');
      
      await this.storageService.importConfig(configData);
      
      log.info('Configuration imported successfully');
      
      // Update tray menu after import
      if (this.trayController) {
        await this.trayController.updateMenu();
      }
    } catch (error) {
      log.error('Failed to import configuration', error as Error);
      throw error;
    }
  }

  async getServices(): Promise<Service[]> {
    return this.storageService.getServices();
  }

  async getGroups(): Promise<Group[]> {
    return this.storageService.getGroups();
  }

  async getSettings(): Promise<Settings> {
    return this.storageService.getSettings();
  }

  async addService(serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Promise<Service> {
    try {
      const service = await this.storageService.addService(serviceData);
      
      // Update tray menu after adding service
      if (this.trayController) {
        await this.trayController.updateMenu();
      }
      
      return service;
    } catch (error) {
      log.error('Failed to add service', error as Error);
      throw error;
    }
  }

  async updateService(id: string, updates: Partial<Service>): Promise<Service> {
    try {
      const service = await this.storageService.updateService(id, updates);
      
      // Update tray menu after updating service
      if (this.trayController) {
        await this.trayController.updateMenu();
      }
      
      return service;
    } catch (error) {
      log.error('Failed to update service', error as Error);
      throw error;
    }
  }

  async deleteService(id: string): Promise<void> {
    try {
      await this.storageService.deleteService(id);
      
      // Update tray menu after deleting service
      if (this.trayController) {
        await this.trayController.updateMenu();
      }
    } catch (error) {
      log.error('Failed to delete service', error as Error);
      throw error;
    }
  }

  async discoverServices(folderPath: string): Promise<any[]> {
    try {
      return await this.discoveryService.discoverServices(folderPath);
    } catch (error) {
      log.error('Failed to discover services', error as Error);
      throw error;
    }
  }

  private async shutdown(): Promise<void> {
    try {
      log.info('Shutting down Runbar application');
      
      // Close settings window
      if (this.settingsWindow) {
        this.settingsWindow.close();
        this.settingsWindow = null;
      }
      
      // Destroy tray controller
      if (this.trayController) {
        this.trayController.destroy();
        this.trayController = null;
      }
      
      // Stop all running services
      await this.processManager.stopAllServices();
      
      log.info('Runbar application shutdown completed');
    } catch (error) {
      log.error('Error during shutdown', error as Error);
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
} 