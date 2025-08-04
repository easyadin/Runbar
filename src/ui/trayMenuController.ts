import { Tray } from 'electron';
import { nativeImage } from 'electron';
import path from 'path';
// Types are imported where needed
import { createServiceLogger } from '../shared/logger';
import { eventBus } from '../shared/events';
import { TrayMenuBuilder, type TrayMenuBuilderOptions } from './trayMenuBuilder';
import { DialogService } from './dialogService';
import { ServiceDiscoveryService } from '../services/discovery';
import { StorageService } from '../services/storage';

const log = createServiceLogger('TrayMenuController');

export interface TrayMenuControllerOptions {
  storageService: StorageService;
  processManager: any; // Will be properly typed when we refactor ProcessManager
  iconPath?: string;
}

export class TrayMenuController {
  private tray: Tray | null = null;
  private storageService: StorageService;
  private processManager: any;
  private menuBuilder: TrayMenuBuilder;
  private dialogService: DialogService;
  private discoveryService: ServiceDiscoveryService;
  private iconPath: string;

  constructor(options: TrayMenuControllerOptions) {
    this.storageService = options.storageService;
    this.processManager = options.processManager;
    this.iconPath = options.iconPath || path.join(__dirname, '..', '..', 'assets', 'icon.png');
    
    this.menuBuilder = new TrayMenuBuilder(this.createMenuBuilderOptions());
    this.dialogService = new DialogService();
    this.discoveryService = new ServiceDiscoveryService();
    
    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    try {
      log.info('Initializing tray menu controller');
      
      await this.createTray();
      await this.updateMenu();
      
      log.info('Tray menu controller initialized successfully');
    } catch (error) {
      log.error('Failed to initialize tray menu controller', error as Error);
      throw error;
    }
  }

  private async createTray(): Promise<void> {
    try {
      const icon = nativeImage.createFromPath(this.iconPath);
      const resizedIcon = icon.resize({ width: 16, height: 16 });
      
      this.tray = new Tray(resizedIcon);
      this.tray.setToolTip('Runbar - Click for menu');
      
      this.tray.on('click', () => {
        this.tray?.popUpContextMenu();
      });
      
      log.info('Tray created successfully');
    } catch (error) {
      log.error('Failed to create tray', error as Error);
      throw error;
    }
  }

  private createMenuBuilderOptions(): TrayMenuBuilderOptions {
    return {
      onServiceToggle: (serviceId: string) => this.handleServiceToggle(serviceId),
      onGroupToggle: (groupId: string) => this.handleGroupToggle(groupId),
      onAddFolder: () => this.handleAddFolder(),
      onAddService: () => this.handleAddService(),
      onOpenSettings: () => this.handleOpenSettings(),
      onQuit: () => this.handleQuit(),
    };
  }

  private setupEventListeners(): void {
    // Listen for service status changes
    eventBus.on('service:status-changed', () => {
      this.updateMenu();
    });

    // Listen for config changes
    eventBus.on('config:changed', () => {
      this.updateMenu();
    });

    // Listen for app events
    eventBus.on('app:ready', () => {
      this.updateMenu();
    });
  }

  async updateMenu(): Promise<void> {
    try {
      if (!this.tray) {
        log.warn('Tray not initialized, skipping menu update');
        return;
      }

      const [services, groups] = await Promise.all([
        this.storageService.getServices(),
        this.storageService.getGroups(),
      ]);

      const menu = this.menuBuilder.buildMenu(services, groups);
      this.tray.setContextMenu(menu);
      
      log.debug('Menu updated', { serviceCount: services.length, groupCount: groups.length });
    } catch (error) {
      log.error('Failed to update menu', error as Error);
    }
  }

  private async handleServiceToggle(serviceId: string): Promise<void> {
    try {
      log.info('Handling service toggle', { serviceId });
      
      const services = await this.storageService.getServices();
      const service = services.find(s => s.id === serviceId);
      
      if (!service) {
        log.warn('Service not found', { serviceId });
        return;
      }

      if (service.status === 'running') {
        await this.processManager.stopService(service);
      } else {
        await this.processManager.startService(service);
      }
    } catch (error) {
      log.error('Failed to toggle service', error as Error);
    }
  }

  private async handleGroupToggle(groupId: string): Promise<void> {
    try {
      log.info('Handling group toggle', { groupId });
      
      const groups = await this.storageService.getGroups();
      const group = groups.find(g => g.id === groupId);
      
      if (!group) {
        log.warn('Group not found', { groupId });
        return;
      }

      const services = await this.storageService.getServices();
      const groupServices = services.filter(s => group.services.includes(s.id));
      
      const allRunning = groupServices.every(s => s.status === 'running');
      
      if (allRunning) {
        // Stop all services in group
        for (const service of groupServices) {
          await this.processManager.stopService(service);
        }
      } else {
        // Start all services in group
        for (const service of groupServices) {
          await this.processManager.startService(service);
        }
      }
    } catch (error) {
      log.error('Failed to toggle group', error as Error);
    }
  }

  private async handleAddFolder(): Promise<void> {
    try {
      log.info('Handling add folder request');
      
      const folderPath = await this.dialogService.selectFolder('Select folder to scan for services');
      if (!folderPath) {
        return;
      }

      const discoveredServices = await this.discoveryService.discoverServices(folderPath);
      
      if (discoveredServices.length === 0) {
        log.info('No services found in selected folder', { folderPath });
        // Could show a notification here
        return;
      }

      const selectedServices = await this.dialogService.showServicePreviewDialog({
        discoveredServices,
        selectedFolders: [folderPath],
      });

      if (selectedServices.length === 0) {
        return;
      }

      // Convert discovered services to storage format and save
      for (const discoveredService of selectedServices) {
        await this.storageService.addService({
          name: discoveredService.name,
          path: discoveredService.path,
          command: discoveredService.command,
          projectType: discoveredService.projectType,
        });
      }

      log.info('Services added from folder', { 
        folderPath, 
        addedCount: selectedServices.length 
      });
      
      await this.updateMenu();
    } catch (error) {
      log.error('Failed to add folder', error as Error);
    }
  }

  private async handleAddService(): Promise<void> {
    try {
      log.info('Handling add service request');
      
      const formData = await this.dialogService.showServiceFormDialog();
      if (!formData) {
        return;
      }

      // Validate the service path
      const isValid = await this.discoveryService.validateServicePath(formData.path);
      if (!isValid) {
        log.warn('Invalid service path', { path: formData.path });
        // Could show an error dialog here
        return;
      }

      // Get additional project info if available
      const projectInfo = await this.discoveryService.getProjectInfo(formData.path);
      
      await this.storageService.addService({
        name: formData.name,
        path: formData.path,
        command: formData.command,
        projectType: formData.projectType as any || projectInfo?.projectType,
      });

      log.info('Service added manually', { name: formData.name });
      await this.updateMenu();
    } catch (error) {
      log.error('Failed to add service', error as Error);
    }
  }

  private async handleOpenSettings(): Promise<void> {
    try {
      log.info('Handling open settings request');
      // TODO: Implement settings window
      log.info('Settings window not yet implemented');
    } catch (error) {
      log.error('Failed to open settings', error as Error);
    }
  }

  private async handleQuit(): Promise<void> {
    try {
      log.info('Handling quit request');
      
      // Close all dialog windows
      this.dialogService.closeAllWindows();
      
      // Emit app shutdown event
      eventBus.emitAppShutdown();
      
      // The main app will handle the actual quit
    } catch (error) {
      log.error('Failed to handle quit', error as Error);
    }
  }

  destroy(): void {
    try {
      if (this.tray) {
        this.tray.destroy();
        this.tray = null;
      }
      
      this.dialogService.closeAllWindows();
      
      log.info('Tray menu controller destroyed');
    } catch (error) {
      log.error('Failed to destroy tray menu controller', error as Error);
    }
  }
} 