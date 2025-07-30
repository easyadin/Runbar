import { readdir, stat, readFile } from 'fs/promises';
import { join, basename, sep } from 'path';
import { ProjectType, DiscoveredService, ServiceDiscoveryOptions } from './types';
import serviceIgnorePatterns from './serviceIgnore';

export class ServiceDiscovery {
  private _options: ServiceDiscoveryOptions;

  /**
   * Service markers to detect type
   */
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
      'run', 'start' // Unix executable
    ]
  };

  constructor(options?: ServiceDiscoveryOptions) {
    this._options = {
      markers: [
        'package.json', 'Gemfile', 'go.mod', 'Cargo.toml', 'requirements.txt',
        'pom.xml', 'build.gradle', 'docker-compose.yml', 'start.bat', 'start.ps1',
        'start.sh', 'start.exe', 'start.jar'
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
    if (depth > (this._options.maxDepth || 10)) return [];

    if ((this._options.ignorePatterns || []).some(pattern => path.split(sep).includes(pattern))) {
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
    const dirName = basename(filePath.substring(0, filePath.lastIndexOf(sep)));
    let serviceName = dirName;
    let startCommand = '';

    try {
      if (projectType === 'nodejs') {
        const packageJson = JSON.parse(await readFile(filePath, 'utf-8'));
        serviceName = packageJson.name || dirName;
        if (packageJson.scripts) {
          startCommand = packageJson.scripts.dev ||
            packageJson.scripts.start ||
            packageJson.scripts.serve ||
            this.getDefaultStartCommand(projectType);
        }
      } else if (projectType === 'docker') {
        startCommand = filePath.includes('docker-compose') ? 'docker-compose up' : 'docker build . && docker run .';
      } else {
        startCommand = this.getDefaultStartCommand(projectType, filePath);
      }
    } catch (error) {
      console.warn(`⚠️ Could not parse ${filePath}:`, error);
    }

    const service: DiscoveredService = {
      name: serviceName,
      path: filePath.substring(0, filePath.lastIndexOf(sep)),
      command: startCommand || this.getDefaultStartCommand(projectType, filePath),
      projectType: projectType,
      configFile: filePath
    };

    console.log(`🎯 Detected service: ${serviceName} (${projectType}) in ${service.path}`);
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
      'unknown': process.platform === 'win32' ? 'start.bat' : './start.sh'
    };

    return defaults[projectType] || 'echo "No start command configured"';
  }
}