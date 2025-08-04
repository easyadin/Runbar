import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { 
  Service, 
  Group, 
  Settings, 
  ConfigData, 
  StorageOptions,
  ValidationError 
} from './types';

export class Storage {
  private configDir: string;
  private servicesFile: string;
  private groupsFile: string;
  private settingsFile: string;
  
  private readonly defaultSettings: Settings = {
    version: '1.0',
    globalAutoStart: false,
    discoveryMarkers: [
      'package.json',
      'Gemfile',
      'go.mod',
      'Cargo.toml',
      'requirements.txt',
      'pom.xml',
      'build.gradle',
      'docker-compose.yml'
    ],
    logStorageLimit: 100,
    statusPollingInterval: 3000,
    autoUpdateEnabled: true
  };

  constructor(options?: StorageOptions) {
    this.configDir = options?.configDir || path.join(os.homedir(), '.runbar');
    this.servicesFile = path.join(this.configDir, 'services.json');
    this.groupsFile = path.join(this.configDir, 'groups.json');
    this.settingsFile = path.join(this.configDir, 'settings.json');
  }

  async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.configDir);
      
      await this.initializeFile(this.servicesFile, { version: '1.0', services: [] });
      await this.initializeFile(this.groupsFile, { version: '1.0', groups: [] });
      await this.initializeFile(this.settingsFile, this.defaultSettings);
      
      console.log('Storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  private async initializeFile(filePath: string, defaultData: any): Promise<void> {
    try {
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        await fs.writeJson(filePath, defaultData, { spaces: 2 });
        console.log(`Created default file: ${filePath}`);
      } else {
        await this.validateFile(filePath, defaultData);
      }
    } catch (error) {
      console.error(`Error initializing file ${filePath}:`, error);
      await this.backupAndRecreate(filePath, defaultData);
    }
  }

  private async validateFile(filePath: string, defaultData: any): Promise<any> {
    try {
      const data = await fs.readJson(filePath);
      
      if (!data || typeof data !== 'object') {
        throw new ValidationError('Invalid file structure', 'fileStructure');
      }
      
      if (data.version !== defaultData.version) {
        console.warn(`Version mismatch in ${filePath}, may need migration`);
      }
      
      return data;
    } catch (error) {
      console.error(`Validation failed for ${filePath}:`, error);
      throw error;
    }
  }

  private async backupAndRecreate(filePath: string, defaultData: any): Promise<void> {
    try {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      
      if (await fs.pathExists(filePath)) {
        await fs.copy(filePath, backupPath);
        console.log(`Created backup: ${backupPath}`);
      }
      
      await fs.writeJson(filePath, defaultData, { spaces: 2 });
      console.log(`Recreated file with defaults: ${filePath}`);
    } catch (error) {
      console.error(`Failed to backup and recreate ${filePath}:`, error);
      throw error;
    }
  }

  async getServices(): Promise<Service[]> {
    try {
      const data = await fs.readJson(this.servicesFile);
      // Handle both old format { version: '1.0', services: [] } and new format []
      if (Array.isArray(data)) {
        return data;
      } else if (data && typeof data === 'object' && 'services' in data) {
        return data.services || [];
      } else {
        return [];
      }
    } catch (error) {
      console.error('Failed to read services:', error);
      return [];
    }
  }

  async saveServices(services: Service[]): Promise<void> {
    try {
      const data = {
        version: '1.0',
        services: services
      };
      await fs.writeJson(this.servicesFile, data, { spaces: 2 });
      console.log('Services saved successfully');
    } catch (error) {
      console.error('Failed to save services:', error);
      throw error;
    }
  }

  async clearServices(): Promise<void> {
    await this.saveServices([]);
    console.log('All services cleared.');
  }

  async getGroups(): Promise<Group[]> {
    try {
      const data = await fs.readJson(this.groupsFile);
      // Handle both old format { version: '1.0', groups: [] } and new format []
      if (Array.isArray(data)) {
        return data;
      } else if (data && typeof data === 'object' && 'groups' in data) {
        return data.groups || [];
      } else {
        return [];
      }
    } catch (error) {
      console.error('Failed to read groups:', error);
      return [];
    }
  }

  async saveGroups(groups: Group[]): Promise<void> {
    try {
      const data = {
        version: '1.0',
        groups: groups
      };
      await fs.writeJson(this.groupsFile, data, { spaces: 2 });
      console.log('Groups saved successfully');
    } catch (error) {
      console.error('Failed to save groups:', error);
      throw error;
    }
  }

  async getSettings(): Promise<Settings> {
    try {
      const data = await fs.readJson(this.settingsFile);
      return { ...this.defaultSettings, ...data };
    } catch (error) {
      console.error('Failed to read settings:', error);
      return this.defaultSettings;
    }
  }

  async saveSettings(settings: Partial<Settings>): Promise<void> {
    try {
      const data = {
        ...this.defaultSettings,
        ...settings,
        version: '1.0'
      };
      await fs.writeJson(this.settingsFile, data, { spaces: 2 });
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  async addService(service: Omit<Service, 'autoStart'> & { autoStart?: boolean }): Promise<boolean> {
    try {
      const services = await this.getServices();
      
      if (!service.name || !service.path || !service.command) {
        throw new ValidationError('Service must have name, path, and command', 'serviceFields');
      }
      
      const existingIndex = services.findIndex(s => s.path === service.path);
      if (existingIndex !== -1) {
        services[existingIndex] = { ...services[existingIndex], ...service };
      } else {
        services.push({
          ...service,
          autoStart: service.autoStart !== undefined ? service.autoStart : false
        });
      }
      
      await this.saveServices(services);
      return true;
    } catch (error) {
      console.error('Failed to add service:', error);
      throw error;
    }
  }

  async removeService(servicePath: string): Promise<boolean> {
    try {
      const services = await this.getServices();
      const filteredServices = services.filter(s => s.path !== servicePath);
      await this.saveServices(filteredServices);
      return true;
    } catch (error) {
      console.error('Failed to remove service:', error);
      throw error;
    }
  }

  async addGroup(group: Omit<Group, 'services' | 'autoStart'> & { 
    services?: string[]; 
    autoStart?: boolean; 
  }): Promise<boolean> {
    try {
      const groups = await this.getGroups();
      
      if (!group.name) {
        throw new ValidationError('Group must have a name', 'groupName');
      }
      
      const existingIndex = groups.findIndex(g => g.name === group.name);
      if (existingIndex !== -1) {
        const existingGroup = groups[existingIndex];
        if (existingGroup) {
          groups[existingIndex] = { 
            ...existingGroup, 
            ...group,
            services: group.services || existingGroup.services
          };
        }
      } else {
        groups.push({
          ...group,
          services: group.services || [],
          autoStart: group.autoStart !== undefined ? group.autoStart : false
        });
      }
      
      await this.saveGroups(groups);
      return true;
    } catch (error) {
      console.error('Failed to add group:', error);
      throw error;
    }
  }

  async removeGroup(groupName: string): Promise<boolean> {
    try {
      const groups = await this.getGroups();
      const filteredGroups = groups.filter(g => g.name !== groupName);
      await this.saveGroups(filteredGroups);
      return true;
    } catch (error) {
      console.error('Failed to remove group:', error);
      throw error;
    }
  }

  async exportConfig(): Promise<ConfigData> {
    try {
      const services = await this.getServices();
      const groups = await this.getGroups();
      const settings = await this.getSettings();
      
      return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        services,
        groups,
        settings
      };
    } catch (error) {
      console.error('Failed to export config:', error);
      throw error;
    }
  }

  async importConfig(configData: ConfigData): Promise<boolean> {
    try {
      if (!configData || configData.version !== '1.0') {
        throw new ValidationError('Invalid config format or version', 'configVersion');
      }
      
      if (configData.services) {
        await this.saveServices(configData.services);
      }
      
      if (configData.groups) {
        await this.saveGroups(configData.groups);
      }
      
      if (configData.settings) {
        await this.saveSettings(configData.settings);
      }
      
      console.log('Config imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import config:', error);
      throw error;
    }
  }
} 