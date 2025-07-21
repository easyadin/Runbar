import { readdir, stat, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { ProjectType, DiscoveredService, ServiceDiscoveryOptions } from './types';
import serviceIgnorePatterns from './serviceIgnore';

export class ServiceDiscovery {
  private _options: ServiceDiscoveryOptions;

  /**
   * Common service markers
   */
  private readonly serviceMarkers: Record<ProjectType, string[]> = {
    'nodejs': ['package.json'],
    'docker': ['docker-compose.yml', 'docker-compose.yaml', 'Dockerfile'],
    'python': ['requirements.txt', 'pyproject.toml', 'Pipfile'],
    'ruby': ['Gemfile', 'Rakefile'],
    'java': ['pom.xml', 'build.gradle'],
    'go': ['go.mod'],
    'rust': ['Cargo.toml'],
    'unknown': ['run.sh', 'start.sh', 'dev.sh', 'serve.sh']
  };

  constructor(options?: ServiceDiscoveryOptions) {
    this._options = {
      markers: [
        'package.json',
        'Gemfile',
        'go.mod',
        'Cargo.toml',
        'requirements.txt',
        'pom.xml',
        'build.gradle',
        'docker-compose.yml'
      ],
      maxDepth: 10,
      ignorePatterns: [...serviceIgnorePatterns],
      ...options
    };
  }

  async scanFolder(folderPath: string): Promise<DiscoveredService[]> {
    console.log(`🔍 Scanning folder: ${folderPath}`);
    return this.scanDirectory(folderPath, 0);
  }

  private async scanDirectory(path: string, depth: number): Promise<DiscoveredService[]> {
    if (depth > (this._options.maxDepth || 10)) {
      return [];
    }

    // If the path contains any ignored pattern, skip it
    if ((this._options.ignorePatterns || []).some(pattern => path.split(/[\/]/).includes(pattern))) {
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
      console.error(`❌ Error scanning directory ${path}:`, error);
      return [];
    }
  }

  private async detectServiceFromFile(filePath: string): Promise<DiscoveredService | null> {
    const fileName = basename(filePath);

    // Check each service type for markers
    for (const [projectType, markers] of Object.entries(this.serviceMarkers)) {
      if (markers.includes(fileName) || markers.some(marker =>
        marker.includes('*') && fileName.endsWith(marker.replace('*', ''))
      )) {
        return await this.createServiceFromFile(filePath, projectType as ProjectType);
      }
    }

    return null;
  }

  private async createServiceFromFile(filePath: string, projectType: ProjectType): Promise<DiscoveredService> {
    const dirName = basename(filePath.substring(0, filePath.lastIndexOf('/')));

    // Try to get service name from package.json or similar
    let serviceName = dirName;
    let startCommand = '';

    try {
      if (projectType === 'nodejs') {
        const packageJson = JSON.parse(await readFile(filePath, 'utf-8'));
        serviceName = packageJson.name || dirName;

        // Look for start scripts
        if (packageJson.scripts) {
          startCommand = packageJson.scripts.dev ||
            packageJson.scripts.start ||
            packageJson.scripts.serve ||
            'npm start';
        }
      } else if (projectType === 'docker') {
        if (filePath.includes('docker-compose')) {
          startCommand = 'docker-compose up';
        } else {
          startCommand = 'docker build . && docker run .';
        }
      } else if (projectType === 'python') {
        startCommand = 'python app.py';
      } else if (projectType === 'ruby') {
        startCommand = 'bundle exec rails server';
      } else if (projectType === 'go') {
        startCommand = 'go run .';
      } else if (projectType === 'rust') {
        startCommand = 'cargo run';
      } else if (projectType === 'java') {
        startCommand = 'mvn spring-boot:run';
      } else if (projectType === 'unknown') {
        startCommand = `./${basename(filePath)}`;
      }
    } catch (error) {
      console.warn(`⚠️ Could not parse ${filePath}:`, error);
    }

    const service: DiscoveredService = {
      name: serviceName,
      path: filePath.substring(0, filePath.lastIndexOf('/')),
      command: startCommand || this.getDefaultStartCommand(projectType),
      projectType: projectType,
      configFile: filePath
    };

    console.log(`🎯 Detected service: ${serviceName} (${projectType}) in ${filePath.substring(0, filePath.lastIndexOf('/'))}`);
    return service;
  }

  private getDefaultStartCommand(projectType: ProjectType): string {
    const defaults: Record<ProjectType, string> = {
      'nodejs': 'npm start',
      'docker': 'docker-compose up',
      'python': 'python app.py',
      'ruby': 'bundle exec rails server',
      'go': 'go run .',
      'rust': 'cargo run',
      'java': 'mvn spring-boot:run',
      'unknown': './start.sh'
    };

    return defaults[projectType] || 'echo "No start command configured"';
  }
} 