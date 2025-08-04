import { readdir, stat, readFile } from 'fs/promises';
import { join, basename, sep } from 'path';
import type { ProjectType, DiscoveredService, ServiceDiscoveryOptions } from '../shared/types';
import { createServiceLogger } from '../shared/logger';
import { eventBus } from '../shared/events';
import { serviceIgnorePatterns } from './serviceIgnore';

const log = createServiceLogger('Scanner');

export interface ScannerInterface {
  scanFolder(folderPath: string): Promise<DiscoveredService[]>;
  detectServiceFromFile(filePath: string): Promise<DiscoveredService | null>;
  validateServicePath(path: string): Promise<boolean>;
}

export class ServiceScanner implements ScannerInterface {
  private options: ServiceDiscoveryOptions;
  private readonly serviceMarkers: Record<ProjectType, string[]> = {
    'nodejs': ['package.json'],
    'docker': ['docker-compose.yml', 'docker-compose.yaml', 'Dockerfile'],
    'python': ['requirements.txt', 'pyproject.toml', 'Pipfile'],
    'ruby': ['Gemfile', 'Rakefile'],
    'java': ['pom.xml', 'build.gradle'],
    'go': ['go.mod'],
    'rust': ['Cargo.toml'],
    'unknown': [
      'run.sh', 'start.sh', 'dev.sh', 'serve.sh',
      'run.bat', 'start.bat', 'dev.bat', 'serve.bat',
      'run.ps1', 'start.ps1', 'dev.ps1', 'serve.ps1',
      'run.exe', 'start.exe',
      'run.jar', 'start.jar',
      'run', 'start', // Unix executable
    ],
  };

  constructor(options?: Partial<ServiceDiscoveryOptions>) {
    this.options = {
      markers: [
        'package.json', 'Gemfile', 'go.mod', 'Cargo.toml', 'requirements.txt',
        'pom.xml', 'build.gradle', 'docker-compose.yml', 'start.bat', 'start.ps1',
        'start.sh', 'start.exe', 'start.jar',
      ],
      maxDepth: 10,
      ignorePatterns: [...serviceIgnorePatterns],
      ...options,
    };
  }

  async scanFolder(folderPath: string): Promise<DiscoveredService[]> {
    log.info('Scanning folder', { folderPath });
    eventBus.emitScanStarted(folderPath);
    
    try {
      const services = await this.scanDirectory(folderPath, 0);
      log.info('Scan completed', { folderPath, servicesFound: services.length });
      eventBus.emitScanCompleted(folderPath, services);
      return services;
    } catch (error) {
      log.warn('Scan failed', { folderPath, error: error as Error });
      eventBus.emitScanError(folderPath, error as Error);
      throw error;
    }
  }

  async detectServiceFromFile(filePath: string): Promise<DiscoveredService | null> {
    try {
      const fileName = basename(filePath);

      for (const [projectType, markers] of Object.entries(this.serviceMarkers)) {
        if (
          markers.includes(fileName) ||
          markers.some(marker =>
            marker.includes('*') && fileName.endsWith(marker.replace('*', ''))
          )
        ) {
          return await this.createServiceFromFile(filePath, projectType as ProjectType);
        }
      }

      return null;
    } catch (error) {
      log.warn('Error detecting service from file', { filePath, error: error as Error });
      return null;
    }
  }

  async validateServicePath(path: string): Promise<boolean> {
    try {
      const stats = await stat(path);
      return stats.isDirectory();
    } catch (error) {
      log.debug('Invalid service path', { path, error: error as Error });
      return false;
    }
  }

  private async scanDirectory(path: string, depth: number): Promise<DiscoveredService[]> {
    if (depth > (this.options.maxDepth || 10)) {
      return [];
    }

    if (
      (this.options.ignorePatterns || []).some((pattern: string) =>
        path.split(sep).includes(pattern)
      )
    ) {
      return [];
    }

    try {
      const services: DiscoveredService[] = [];
      const items = await readdir(path);

      for (const item of items) {
        const itemPath = join(path, item);
        const stats = await stat(itemPath);

        if (stats.isDirectory()) {
          const subServices = await this.scanDirectory(itemPath, depth + 1);
          services.push(...subServices);
        } else if (stats.isFile()) {
          const service = await this.detectServiceFromFile(itemPath);
          if (service) {
            services.push(service);
          }
        }
      }

      return services;
    } catch (error) {
      log.warn('Error scanning directory', { path, error: error as Error });
      return [];
    }
  }

  private async createServiceFromFile(
    filePath: string,
    projectType: ProjectType
  ): Promise<DiscoveredService> {
    const dirName = basename(filePath.substring(0, filePath.lastIndexOf(sep)));
    let serviceName = dirName;
    let startCommand = '';

    try {
      if (projectType === 'nodejs') {
        const packageJson = JSON.parse(await readFile(filePath, 'utf-8'));
        serviceName = packageJson.name || dirName;
        
        if (packageJson.scripts) {
          startCommand =
            packageJson.scripts.dev ||
            packageJson.scripts.start ||
            packageJson.scripts.serve ||
            this.getDefaultStartCommand(projectType);
        }
      } else if (projectType === 'docker') {
        startCommand = filePath.includes('docker-compose')
          ? 'docker-compose up'
          : 'docker build . && docker run .';
      } else {
        startCommand = this.getDefaultStartCommand(projectType, filePath);
      }
    } catch (error) {
      log.warn('Could not parse file', { filePath, error: error as Error });
    }

    const service: DiscoveredService = {
      name: serviceName,
      path: filePath.substring(0, filePath.lastIndexOf(sep)),
      command: startCommand || this.getDefaultStartCommand(projectType, filePath),
      projectType: projectType,
      configFile: filePath,
    };

    log.info('Detected service', {
      name: serviceName,
      projectType,
      path: service.path,
    });

    return service;
  }

  private getDefaultStartCommand(projectType: ProjectType, filePath?: string): string {
    if (projectType === 'unknown' && filePath) {
      const fileName = basename(filePath);

      if (fileName.endsWith('.bat')) {
        return `cmd /c ${fileName}`;
      }

      if (fileName.endsWith('.ps1')) {
        return `powershell -ExecutionPolicy Bypass -File ${fileName}`;
      }

      if (fileName.endsWith('.sh')) {
        return `./${fileName}`;
      }

      if (fileName.endsWith('.exe')) {
        return `${fileName}`;
      }

      if (fileName.endsWith('.jar')) {
        return `java -jar ${fileName}`;
      }

      // Unix-style extensionless executable
      if (!fileName.includes('.') && process.platform !== 'win32') {
        return `./${fileName}`;
      }
    }

    const defaults: Record<ProjectType, string> = {
      'nodejs': process.platform === 'win32' ? 'npm.cmd start' : 'npm start',
      'docker': 'docker-compose up',
      'python': process.platform === 'win32' ? 'python app.py' : 'python3 app.py',
      'ruby': 'bundle exec rails server',
      'go': 'go run .',
      'rust': 'cargo run',
      'java': 'mvn spring-boot:run',
      'unknown': process.platform === 'win32' ? 'start.bat' : './start.sh',
    };

    return defaults[projectType] || 'echo "No start command configured"';
  }
} 