import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Service, Group, Settings, ConfigData, StorageOptions } from '../shared/types';
import { StorageError, ValidationError } from '../shared/types';
import { createServiceLogger } from '../shared/logger';
import { config } from '../shared/config';
import { eventBus } from '../shared/events';

const log = createServiceLogger('Storage');

export class StorageService {
  private configDir: string;
  private servicesFile: string;
  private groupsFile: string;
  private settingsFile: string;
  private backupDir: string;
  private options: StorageOptions;

  constructor(options: StorageOptions = {}) {
    this.options = {
      configDir: config.getConfigDir(),
      backupOnError: true,
      validateOnLoad: true,
      ...options,
    };
    
    this.configDir = this.options.configDir!;
    this.servicesFile = path.join(this.configDir, 'services.json');
    this.groupsFile = path.join(this.configDir, 'groups.json');
    this.settingsFile = path.join(this.configDir, 'settings.json');
    this.backupDir = path.join(this.configDir, 'backups');
  }

  async initialize(): Promise<void> {
    try {
      log.info('Initializing storage service');
      
      // Ensure config directory exists
      await fs.ensureDir(this.configDir);
      await fs.ensureDir(this.backupDir);
      
      // Initialize files if they don't exist
      await this.initializeFiles();
      
      log.info('Storage service initialized successfully');
    } catch (error) {
      log.error('Failed to initialize storage service', error as Error);
      throw new StorageError('Failed to initialize storage', 'initialize', { error });
    }
  }

  private async initializeFiles(): Promise<void> {
    const files = [
      { path: this.servicesFile, default: [] },
      { path: this.groupsFile, default: [] },
      { path: this.settingsFile, default: config.defaults.settings },
    ];

    for (const file of files) {
      if (!(await fs.pathExists(file.path))) {
        await fs.writeJson(file.path, file.default, { spaces: 2 });
        log.info(`Created ${file.path}`);
      }
    }
  }

  // Service management
  async getServices(): Promise<Service[]> {
    try {
      if (!(await fs.pathExists(this.servicesFile))) {
        log.info('Services file does not exist, returning empty array');
        return [];
      }
      
      const data = await fs.readJson(this.servicesFile);
      
      // Handle migration from old format
      let services: unknown;
      if (data && typeof data === 'object' && 'services' in data) {
        log.info('Migrating services from old format');
        services = (data as any).services;
        // Save in new format
        await fs.writeJson(this.servicesFile, services, { spaces: 2 });
      } else {
        services = data;
      }
      
      return this.options.validateOnLoad ? this.validateServices(services) : (services as Service[]);
    } catch (error) {
      log.warn('Failed to read services, returning empty array', error as Error);
      return [];
    }
  }

  async saveServices(services: Service[]): Promise<void> {
    try {
      const validatedServices = this.validateServices(services);
      await this.backupFile(this.servicesFile);
      await fs.writeJson(this.servicesFile, validatedServices, { spaces: 2 });
      
      eventBus.emitConfigChanged('service', validatedServices);
      log.info(`Saved ${validatedServices.length} services`);
    } catch (error) {
      log.error('Failed to save services', error as Error);
      throw new StorageError('Failed to save services', 'saveServices', { error });
    }
  }

  async addService(service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>): Promise<Service> {
    try {
      const newService: Service = {
        ...service,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const services = await this.getServices();
      services.push(newService);
      await this.saveServices(services);
      
      log.info(`Added service: ${newService.name}`);
      return newService;
    } catch (error) {
      log.error('Failed to add service', error as Error);
      throw new StorageError('Failed to add service', 'addService', { error });
    }
  }

  async updateService(id: string, updates: Partial<Service>): Promise<Service> {
    try {
      const services = await this.getServices();
      const index = services.findIndex(s => s.id === id);
      
      if (index === -1) {
        throw new ValidationError('Service not found', 'id', id);
      }

      const updatedService = {
        ...services[index]!,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      services[index] = updatedService;
      await this.saveServices(services);
      
      log.info(`Updated service: ${updatedService.name}`);
      return updatedService;
    } catch (error) {
      log.error('Failed to update service', error as Error);
      throw new StorageError('Failed to update service', 'updateService', { error });
    }
  }

  async deleteService(id: string): Promise<void> {
    try {
      const services = await this.getServices();
      const filteredServices = services.filter(s => s.id !== id);
      
      if (filteredServices.length === services.length) {
        throw new ValidationError('Service not found', 'id', id);
      }

      await this.saveServices(filteredServices);
      
      // Remove from groups
      const groups = await this.getGroups();
      const updatedGroups = groups.map(group => ({
        ...group,
        services: group.services.filter(serviceId => serviceId !== id),
      }));
      await this.saveGroups(updatedGroups);
      
      log.info(`Deleted service: ${id}`);
    } catch (error) {
      log.error('Failed to delete service', error as Error);
      throw new StorageError('Failed to delete service', 'deleteService', { error });
    }
  }

  // Group management
  async getGroups(): Promise<Group[]> {
    try {
      if (!(await fs.pathExists(this.groupsFile))) {
        log.info('Groups file does not exist, returning empty array');
        return [];
      }
      
      const data = await fs.readJson(this.groupsFile);
      
      // Handle migration from old format
      let groups: unknown;
      if (data && typeof data === 'object' && 'groups' in data) {
        log.info('Migrating groups from old format');
        groups = (data as any).groups;
        // Save in new format
        await fs.writeJson(this.groupsFile, groups, { spaces: 2 });
      } else {
        groups = data;
      }
      
      return this.options.validateOnLoad ? this.validateGroups(groups) : (groups as Group[]);
    } catch (error) {
      log.warn('Failed to read groups, returning empty array', error as Error);
      return [];
    }
  }

  async saveGroups(groups: Group[]): Promise<void> {
    try {
      const validatedGroups = this.validateGroups(groups);
      await this.backupFile(this.groupsFile);
      await fs.writeJson(this.groupsFile, validatedGroups, { spaces: 2 });
      
      eventBus.emitConfigChanged('group', validatedGroups);
      log.info(`Saved ${validatedGroups.length} groups`);
    } catch (error) {
      log.error('Failed to save groups', error as Error);
      throw new StorageError('Failed to save groups', 'saveGroups', { error });
    }
  }

  async addGroup(group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Promise<Group> {
    try {
      const newGroup: Group = {
        ...group,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const groups = await this.getGroups();
      groups.push(newGroup);
      await this.saveGroups(groups);
      
      log.info(`Added group: ${newGroup.name}`);
      return newGroup;
    } catch (error) {
      log.error('Failed to add group', error as Error);
      throw new StorageError('Failed to add group', 'addGroup', { error });
    }
  }

  async updateGroup(id: string, updates: Partial<Group>): Promise<Group> {
    try {
      const groups = await this.getGroups();
      const index = groups.findIndex(g => g.id === id);
      
      if (index === -1) {
        throw new ValidationError('Group not found', 'id', id);
      }

      const updatedGroup = {
        ...groups[index]!,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      groups[index] = updatedGroup;
      await this.saveGroups(groups);
      
      log.info(`Updated group: ${updatedGroup.name}`);
      return updatedGroup;
    } catch (error) {
      log.error('Failed to update group', error as Error);
      throw new StorageError('Failed to update group', 'updateGroup', { error });
    }
  }

  async deleteGroup(id: string): Promise<void> {
    try {
      const groups = await this.getGroups();
      const filteredGroups = groups.filter(g => g.id !== id);
      
      if (filteredGroups.length === groups.length) {
        throw new ValidationError('Group not found', 'id', id);
      }

      await this.saveGroups(filteredGroups);
      
      log.info(`Deleted group: ${id}`);
    } catch (error) {
      log.error('Failed to delete group', error as Error);
      throw new StorageError('Failed to delete group', 'deleteGroup', { error });
    }
  }

  // Settings management
  async getSettings(): Promise<Settings> {
    try {
      if (!(await fs.pathExists(this.settingsFile))) {
        log.info('Settings file does not exist, returning defaults');
        return config.defaults.settings;
      }
      
      const settings = await fs.readJson(this.settingsFile);
      return this.options.validateOnLoad ? this.validateSettings(settings) : settings;
    } catch (error) {
      log.warn('Failed to read settings, returning defaults', error as Error);
      return config.defaults.settings;
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    try {
      const validatedSettings = this.validateSettings(settings);
      await this.backupFile(this.settingsFile);
      await fs.writeJson(this.settingsFile, validatedSettings, { spaces: 2 });
      
      eventBus.emitConfigChanged('settings', validatedSettings);
      log.info('Settings saved successfully');
    } catch (error) {
      log.error('Failed to save settings', error as Error);
      throw new StorageError('Failed to save settings', 'saveSettings', { error });
    }
  }

  // Export/Import
  async exportConfig(): Promise<ConfigData> {
    try {
      const [services, groups, settings] = await Promise.all([
        this.getServices(),
        this.getGroups(),
        this.getSettings(),
      ]);

      return {
        version: config.app.version,
        exportDate: new Date().toISOString(),
        services,
        groups,
        settings,
      };
    } catch (error) {
      log.error('Failed to export config', error as Error);
      throw new StorageError('Failed to export config', 'exportConfig', { error });
    }
  }

  async importConfig(configData: ConfigData): Promise<void> {
    try {
      // Validate imported data
      this.validateServices(configData.services);
      this.validateGroups(configData.groups);
      this.validateSettings(configData.settings);

      // Backup current config
      await this.backupAll();

      // Import new config
      await Promise.all([
        this.saveServices(configData.services),
        this.saveGroups(configData.groups),
        this.saveSettings(configData.settings),
      ]);

      log.info('Config imported successfully');
    } catch (error) {
      log.error('Failed to import config', error as Error);
      throw new StorageError('Failed to import config', 'importConfig', { error });
    }
  }

  // Validation methods
  private validateServices(services: unknown): Service[] {
    if (!Array.isArray(services)) {
      throw new ValidationError('Services must be an array', 'services', services);
    }

    return services.map((service, index) => {
      if (!service || typeof service !== 'object') {
        throw new ValidationError('Service must be an object', `services[${index}]`, service);
      }

      const s = service as any;
      
      // Handle migration: add missing required fields
      const validatedService: Service = {
        id: s.id || uuidv4(),
        name: s.name || `Service ${index + 1}`,
        path: s.path || '',
        command: s.command || '',
        port: s.port,
        autoStart: s.autoStart || false,
        projectType: s.projectType || 'unknown',
        status: 'stopped', // Always start as stopped - ProcessManager will update this
        logs: s.logs || [],
        lastStarted: s.lastStarted,
        lastStopped: s.lastStopped,
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: s.updatedAt || new Date().toISOString(),
      };

      if (!validatedService.name || !validatedService.path || !validatedService.command) {
        throw new ValidationError('Service missing required fields', `services[${index}]`, service);
      }

      return validatedService;
    });
  }

  private validateGroups(groups: unknown): Group[] {
    if (!Array.isArray(groups)) {
      throw new ValidationError('Groups must be an array', 'groups', groups);
    }

    return groups.map((group, index) => {
      if (!group || typeof group !== 'object') {
        throw new ValidationError('Group must be an object', `groups[${index}]`, group);
      }

      const g = group as any;
      
      // Handle migration: add missing required fields
      const validatedGroup: Group = {
        id: g.id || uuidv4(),
        name: g.name || `Group ${index + 1}`,
        services: Array.isArray(g.services) ? g.services : [],
        autoStart: g.autoStart || false,
        lastRun: g.lastRun,
        createdAt: g.createdAt || new Date().toISOString(),
        updatedAt: g.updatedAt || new Date().toISOString(),
      };

      if (!validatedGroup.name) {
        throw new ValidationError('Group missing required fields', `groups[${index}]`, group);
      }

      return validatedGroup;
    });
  }

  private validateSettings(settings: unknown): Settings {
    if (!settings || typeof settings !== 'object') {
      throw new ValidationError('Settings must be an object', 'settings', settings);
    }

    const s = settings as Settings;
    if (!s.version || typeof s.globalAutoStart !== 'boolean' || !Array.isArray(s.discoveryMarkers)) {
      throw new ValidationError('Settings missing required fields', 'settings', settings);
    }

    return s;
  }

  // Backup methods
  private async backupFile(filePath: string): Promise<void> {
    if (!this.options.backupOnError) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = path.basename(filePath);
      const backupPath = path.join(this.backupDir, `${fileName}.${timestamp}.backup`);
      
      if (await fs.pathExists(filePath)) {
        await fs.copy(filePath, backupPath);
        log.debug(`Backed up ${filePath} to ${backupPath}`);
      }
    } catch (error) {
      log.warn('Failed to backup file', { filePath, error });
    }
  }

  private async backupAll(): Promise<void> {
    const files = [this.servicesFile, this.groupsFile, this.settingsFile];
    await Promise.all(files.map(file => this.backupFile(file)));
  }
} 