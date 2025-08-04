import fs from 'fs-extra';
import path from 'path';
import type { DiscoveredService, ServiceDiscoveryOptions, ProjectType } from '../shared/types';
import { createServiceLogger } from '../shared/logger';
import { config } from '../shared/config';

const log = createServiceLogger('Discovery');

export class ServiceDiscoveryService {
  private options: ServiceDiscoveryOptions;

  constructor(options: Partial<ServiceDiscoveryOptions> = {}) {
    this.options = {
      markers: config.defaults.settings.discoveryMarkers,
      maxDepth: config.defaults.discovery.maxDepth,
      ignorePatterns: config.defaults.discovery.ignorePatterns,
      ...options,
    };
  }

  async discoverServices(rootPath: string): Promise<DiscoveredService[]> {
    log.info('Starting service discovery', { rootPath });
    
    try {
      const discoveredServices: DiscoveredService[] = [];
      await this.scanDirectory(rootPath, 0, discoveredServices);
      
      log.info('Service discovery completed', { 
        rootPath, 
        discoveredCount: discoveredServices.length 
      });
      
      return discoveredServices;
    } catch (error) {
      log.error('Service discovery failed', error as Error);
      throw error;
    }
  }

  private async scanDirectory(
    dirPath: string, 
    depth: number, 
    discoveredServices: DiscoveredService[]
  ): Promise<void> {
    if (depth > (this.options.maxDepth || 5)) {
      return;
    }

    try {
      const entries = await fs.readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          // Check if this directory should be ignored
          if (this.shouldIgnoreDirectory(entry)) {
            continue;
          }
          
          // Check if this directory contains a project marker
          const discoveredService = await this.checkForProjectMarker(fullPath);
          if (discoveredService) {
            discoveredServices.push(discoveredService);
          } else {
            // Recursively scan subdirectories
            await this.scanDirectory(fullPath, depth + 1, discoveredServices);
          }
        }
      }
    } catch (error) {
      log.warn('Failed to scan directory', { dirPath, error });
    }
  }

  private shouldIgnoreDirectory(dirName: string): boolean {
    return (this.options.ignorePatterns || []).some(pattern => 
      dirName.includes(pattern) || new RegExp(pattern).test(dirName)
    );
  }

  private async checkForProjectMarker(dirPath: string): Promise<DiscoveredService | null> {
    for (const marker of this.options.markers || []) {
      const markerPath = path.join(dirPath, marker);
      
      if (await fs.pathExists(markerPath)) {
        return await this.analyzeProject(dirPath, marker);
      }
    }
    
    return null;
  }

  private async analyzeProject(dirPath: string, configFile: string): Promise<DiscoveredService> {
    const dirName = path.basename(dirPath);
    let projectName = dirName;
    let command = '';
    let projectType: ProjectType = 'unknown';
    let packageManager = '';
    let scripts: Record<string, string> = {};

    try {
      switch (configFile) {
        case 'package.json':
          projectType = 'nodejs';
          packageManager = 'npm';
          const packageData = await this.parsePackageJson(dirPath);
          projectName = packageData.name || dirName;
          scripts = packageData.scripts || {};
          command = this.determineNodeCommand(scripts);
          break;

        case 'Gemfile':
          projectType = 'ruby';
          packageManager = 'bundle';
          command = 'bundle exec rails server';
          break;

        case 'go.mod':
          projectType = 'go';
          packageManager = 'go';
          command = 'go run .';
          break;

        case 'Cargo.toml':
          projectType = 'rust';
          packageManager = 'cargo';
          command = 'cargo run';
          break;

        case 'requirements.txt':
          projectType = 'python';
          packageManager = 'pip';
          command = 'python app.py';
          break;

        case 'pom.xml':
          projectType = 'java';
          packageManager = 'maven';
          command = 'mvn spring-boot:run';
          break;

        case 'build.gradle':
          projectType = 'java';
          packageManager = 'gradle';
          command = 'gradle bootRun';
          break;

        case 'docker-compose.yml':
          projectType = 'docker';
          packageManager = 'docker-compose';
          command = 'docker-compose up';
          break;

        default:
          projectType = 'unknown';
          command = '';
      }
    } catch (error) {
      log.warn('Failed to analyze project', { dirPath, configFile, error });
    }

    return {
      name: projectName,
      path: dirPath,
      command,
      projectType,
      configFile,
      packageManager,
      scripts,
    };
  }

  private async parsePackageJson(dirPath: string): Promise<{ name?: string; scripts?: Record<string, string> }> {
    const packagePath = path.join(dirPath, 'package.json');
    const packageContent = await fs.readFile(packagePath, 'utf-8');
    return JSON.parse(packageContent);
  }

  private determineNodeCommand(scripts: Record<string, string>): string {
    const scriptNames = Object.keys(scripts);
    
    // Priority order for scripts
    const priorityScripts = ['dev', 'start', 'serve', 'develop'];
    
    for (const script of priorityScripts) {
      if (scriptNames.includes(script)) {
        return `npm run ${script}`;
      }
    }
    
    // Fallback to first available script
    if (scriptNames.length > 0) {
      return `npm run ${scriptNames[0]}`;
    }
    
    return 'npm start';
  }

  async validateServicePath(servicePath: string): Promise<boolean> {
    try {
      const exists = await fs.pathExists(servicePath);
      if (!exists) {
        return false;
      }

      const stat = await fs.stat(servicePath);
      return stat.isDirectory();
    } catch (error) {
      log.warn('Failed to validate service path', { servicePath, error });
      return false;
    }
  }

  async getProjectInfo(servicePath: string): Promise<Partial<DiscoveredService> | null> {
    try {
      // Check for any project markers
      for (const marker of this.options.markers || []) {
        const markerPath = path.join(servicePath, marker);
        if (await fs.pathExists(markerPath)) {
          return await this.analyzeProject(servicePath, marker);
        }
      }
      
      return null;
    } catch (error) {
      log.warn('Failed to get project info', { servicePath, error });
      return null;
    }
  }
} 