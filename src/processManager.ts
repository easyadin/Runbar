import { Service, ServiceStatus, ProcessInfo, ProcessManagerOptions } from './types';
import { spawn, ChildProcess } from 'child_process';
import detectPort from 'detect-port';
const { webContents, dialog } = require('electron');

interface ManagedProcess {
  process: ChildProcess | null;
  info: ProcessInfo;
  healthCheck?: NodeJS.Timeout | undefined;
  restartAttempts: number;
  lastRestart: Date | null;
}

export class ProcessManager {
  private processes: Map<string, ManagedProcess> = new Map();
  private _options: ProcessManagerOptions;

  constructor(options?: ProcessManagerOptions) {
    this._options = {
      logStorageLimit: 100,
      statusPollingInterval: 3000,
      gracefulShutdownTimeout: 5000,
      ...options
    };
  }

  async startService(service: Service): Promise<boolean> {
    try {
      if (this.processes.has(service.path)) {
        console.log(`Service already running: ${service.name}`);
        return false;
      }

      // Check and start dependencies first
      if (service.dependencies && service.dependencies.length > 0) {
        console.log(`Starting dependencies for ${service.name}: ${service.dependencies.join(', ')}`);
        await this.startDependencies(service);
      }
      let port: number | null = null;
      const cmdStr = typeof service.command === 'string' ? service.command : '';
      const portMatch = (cmdStr as string).match(/--port[= ](\d+)/) || (cmdStr as string).match(/PORT=(\d+)/);
      if (portMatch && portMatch[1]) {
        port = parseInt(portMatch[1], 10);
      }
      let processInfo: { pid: string, command: string } | null = null;
      if (port) {
        const available = await detectPort(port);
        if (available !== port) {
          try {
            const { execSync } = require('child_process');
            const lsofOut = execSync(`lsof -i :${port} -sTCP:LISTEN -Pn | awk 'NR>1 {print $2, $1}'`).toString().trim();
            if (lsofOut) {
              const [pid, command] = lsofOut.split(' ');
              processInfo = { pid, command };
            }
          } catch (e) { /* ignore */ }
          let dialogOpts: any = {
            type: 'warning',
            buttons: ['Cancel', 'Start Anyway'],
            defaultId: 0,
            cancelId: 0,
            title: 'Port In Use',
            message: `Port ${port} is already in use. The service may already be running.`
          };
          if (processInfo) {
            dialogOpts.message += `\nProcess: PID ${processInfo.pid}, Command: ${processInfo.command}`;
            dialogOpts.buttons = ['Cancel', 'Mark as Running', 'Start Anyway', 'Kill Process'];
          }
          const result = await dialog.showMessageBox(dialogOpts);
          if (processInfo) {
            if (result.response === 1) { // Mark as Running
              // Mark as running in Runbar (but unforunately no logs)
              this.processes.set(service.path, {
                process: null,
                info: {
                  pid: parseInt(processInfo.pid, 10),
                  status: 'running',
                  startTime: new Date(),
                  logs: [`Adopted running process PID ${processInfo.pid}`]
                },
                restartAttempts: 0,
                lastRestart: null
              });
              return true;
            } else if (result.response === 3) { // Kill Process
              try {
                process.kill(parseInt(processInfo.pid, 10));
                return false;
              } catch (e) {
                console.error('Failed to kill process:', e);
                return false;
              }
            } else if (result.response !== 2) {
              return false;
            }
          } else {
            if (result.response !== 1) {
              return false;
            }
          }
        }
      }
      console.log(`Starting service: ${service.name} with log limit: ${this._options.logStorageLimit}`);
      const command = typeof service.command === 'string' ? service.command : '';
      if (!command.trim()) {
        console.error(`No start command specified for service: ${service.name}`);
        return false;
      }
      const cwd = service.path || process.cwd();
      const child: ChildProcess = spawn(command, [], { cwd, shell: true });
      const logs: string[] = [];
      const info: ProcessInfo = {
        pid: child.pid ?? -1,
        status: 'running',
        startTime: new Date(),
        logs
      };
      const emitLog = (line: string) => {
        logs.push(line);
        if (logs.length > (this._options.logStorageLimit || 100)) logs.shift();
        // Send log update to all renderer windows
        for (const wc of webContents.getAllWebContents()) {
          wc.send('log-update', { path: service.path, line });
        }
      };
      child.stdout?.on('data', (data: Buffer) => {
        emitLog(data.toString());
      });
      child.stderr?.on('data', (data: Buffer) => {
        const logLine = data.toString();
        emitLog(logLine);
        
        // Check for port conflicts
        if (logLine.includes('EADDRINUSE') || logLine.includes('port already in use') || logLine.includes('Address already in use')) {
          this.handlePortConflict(service, logLine);
        }
      });
      child.on('exit', (code: number | null) => {
        info.status = 'stopped';
        info.exitCode = code || -1;
        emitLog(`Process exited with code ${code}`);
        
        // Auto-restart if service was configured for it and exited unexpectedly
        if (service.autoStart && code !== 0) {
          setTimeout(() => {
            console.log(`Auto-restarting service: ${service.name}`);
            this.startService(service);
          }, 2000); // Wait 2 seconds before restart
        }
      });
      child.on('error', (err: Error) => {
        info.status = 'error';
        info.error = err.message;
        emitLog(`Process error: ${err.message}`);
      });
      this.processes.set(service.path, { 
        process: child, 
        info,
        restartAttempts: 0,
        lastRestart: null
      });
      
      // Start health monitoring if auto-restart is enabled
      if (service.autoStart) {
        this.startHealthMonitoring(service);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to start service ${service.name}:`, error);
      return false;
    }
  }

  async stopService(service: Service): Promise<boolean> {
    try {
      const managed = this.processes.get(service.path);
      if (!managed) {
        console.log(`Service not running: ${service.name}`);
        return false;
      }
      managed.info.status = 'stopping';
      if (managed.process) managed.process.kill();
      
      // Stop health monitoring
      this.stopHealthMonitoring(service.path);
      
      this.processes.delete(service.path);
      return true;
    } catch (error) {
      console.error(`Failed to stop service ${service.name}:`, error);
      return false;
    }
  }

  getServiceStatus(servicePath: string): ServiceStatus {
    const managedProcess = this.processes.get(servicePath);
    if (!managedProcess) {
      return 'stopped';
    }

    const process = managedProcess.process;
    if (!process) {
      return managedProcess.info.status;
    }

    if (process.exitCode !== null) {
      return 'stopped';
    }

    return 'running';
  }

  getServiceLogs(servicePath: string): string[] {
    const managed = this.processes.get(servicePath);
    return managed?.info.logs || [];
  }

  private async handlePortConflict(service: Service, logLine: string): Promise<void> {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox({
        type: 'warning',
        title: 'Port Conflict Detected',
        message: `Service "${service.name}" failed to start due to a port conflict.`,
        detail: logLine,
        buttons: ['Stop Conflicting Process', 'Ignore', 'Cancel'],
        defaultId: 0,
        cancelId: 2
      });

      if (result.response === 0) {
        // Try to find and kill the conflicting process
        const portMatch = logLine.match(/:(\d+)/);
        if (portMatch && portMatch[1]) {
          const port = parseInt(portMatch[1]);
          await this.killProcessOnPort(port);
          // Restart the service
          setTimeout(() => {
            this.startService(service);
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Error handling port conflict:', error);
    }
  }

  private async killProcessOnPort(port: number): Promise<void> {
    try {
      const { execSync } = require('child_process');
      // Find process using the port
      const cmd = `lsof -ti:${port}`;
      const output = execSync(cmd, { encoding: 'utf8' });
      const pid = output.trim();
      if (pid && pid.length > 0) {
        execSync(`kill -9 ${pid}`);
        console.log(`Killed process ${pid} on port ${port}`);
      }
    } catch (error) {
      console.error(`Failed to kill process on port ${port}:`, error);
    }
  }

  private startHealthMonitoring(service: Service): void {
    const managed = this.processes.get(service.path);
    if (!managed) return;

    // Clear any existing health check
    if (managed.healthCheck) {
      clearInterval(managed.healthCheck);
    }

    // Start health monitoring every 10 seconds
    managed.healthCheck = setInterval(() => {
      this.checkServiceHealth(service);
    }, 10000);
  }

  private async checkServiceHealth(service: Service): Promise<void> {
    const managed = this.processes.get(service.path);
    if (!managed || !managed.process) return;

    // Check if process has exited
    if (managed.process.exitCode !== null) {
      console.log(`Service ${service.name} has crashed, attempting restart...`);
      
      // Stop health monitoring
      if (managed.healthCheck) {
        clearInterval(managed.healthCheck);
        managed.healthCheck = undefined;
      }

      // Check restart limits
      const now = new Date();
      const timeSinceLastRestart = managed.lastRestart ? now.getTime() - managed.lastRestart.getTime() : Infinity;
      
      if (managed.restartAttempts >= 5) {
        console.log(`Service ${service.name} has exceeded restart attempts (5), stopping auto-restart`);
        this.processes.delete(service.path);
        return;
      }

      if (timeSinceLastRestart < 30000) { // 30 seconds
        console.log(`Service ${service.name} restarting too frequently, waiting...`);
        return;
      }

      // Attempt restart
      managed.restartAttempts++;
      managed.lastRestart = now;
      
      console.log(`Auto-restarting service: ${service.name} (attempt ${managed.restartAttempts}/5)`);
      
      // Remove from processes map and restart
      this.processes.delete(service.path);
      setTimeout(() => {
        this.startService(service);
      }, 2000);
    }
  }

  stopHealthMonitoring(servicePath: string): void {
    const managed = this.processes.get(servicePath);
    if (managed && managed.healthCheck) {
      clearInterval(managed.healthCheck);
      managed.healthCheck = undefined;
    }
  }

  private async startDependencies(service: Service): Promise<void> {
    if (!service.dependencies) return;

    const { Storage } = require('./storage');
    const storage = new Storage();
    const allServices = await storage.getServices();

    for (const depName of service.dependencies) {
      const dependency = allServices.find((s: Service) => s.name === depName);
      if (!dependency) {
        console.warn(`Dependency ${depName} not found for service ${service.name}`);
        continue;
      }

      // Check if dependency is already running
      if (this.processes.has(dependency.path)) {
        console.log(`Dependency ${depName} is already running`);
        continue;
      }

      // Start dependency
      console.log(`Starting dependency: ${depName}`);
      const success = await this.startService(dependency);
      if (!success) {
        console.error(`Failed to start dependency ${depName} for service ${service.name}`);
        throw new Error(`Dependency ${depName} failed to start`);
      }

      // Wait for dependency to be ready (if it has a startup delay)
      if (dependency.startupDelay) {
        console.log(`Waiting ${dependency.startupDelay}ms for ${depName} to be ready...`);
        await new Promise(resolve => setTimeout(resolve, dependency.startupDelay));
      }
    }
  }

  async startServicesWithDependencies(services: Service[]): Promise<boolean[]> {
    // Sort services by dependencies (topological sort)
    const sortedServices = this.sortServicesByDependencies(services);
    const results: boolean[] = [];

    for (const service of sortedServices) {
      try {
        const success = await this.startService(service);
        results.push(success);
        
        // Add startup delay if specified
        if (service.startupDelay) {
          console.log(`Waiting ${service.startupDelay}ms for ${service.name} to be ready...`);
          await new Promise(resolve => setTimeout(resolve, service.startupDelay));
        }
      } catch (error) {
        console.error(`Failed to start service ${service.name}:`, error);
        results.push(false);
      }
    }

    return results;
  }

  private sortServicesByDependencies(services: Service[]): Service[] {
    const visited = new Set<string>();
    const sorted: Service[] = [];

    const visit = (service: Service) => {
      if (visited.has(service.name)) return;
      visited.add(service.name);

      if (service.dependencies) {
        for (const depName of service.dependencies) {
          const dependency = services.find((s: Service) => s.name === depName);
          if (dependency) {
            visit(dependency);
          }
        }
      }

      sorted.push(service);
    };

    for (const service of services) {
      visit(service);
    }

    return sorted;
  }
}