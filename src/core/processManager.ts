import { spawn, ChildProcess, execSync } from 'child_process';
import { dialog } from 'electron';
import type { Service, ServiceStatus, ProcessInfo, ProcessManagerOptions } from '../shared/types';
import { createServiceLogger } from '../shared/logger';
import { eventBus } from '../shared/events';

const log = createServiceLogger('ProcessManager');

interface ManagedProcess {
  process: ChildProcess | null;
  info: ProcessInfo;
}

export interface ProcessManagerInterface {
  startService(service: Service): Promise<boolean>;
  stopService(service: Service): Promise<boolean>;
  getServiceStatus(servicePath: string): ServiceStatus;
  getServiceLogs(servicePath: string): string[];
  stopAllServices(): Promise<void>;
  getRunningServices(): string[];
}

export class ProcessManager implements ProcessManagerInterface {
  private processes: Map<string, ManagedProcess> = new Map();
  private options: ProcessManagerOptions;
  private statusPollingInterval: NodeJS.Timeout | null = null;

  constructor(options: ProcessManagerOptions = {}) {
    this.options = {
      logStorageLimit: 100,
      statusPollingInterval: 3000,
      gracefulShutdownTimeout: 5000,
      ...options,
    };

    this.startStatusPolling();
  }

  async startService(service: Service): Promise<boolean> {
    try {
      if (this.processes.has(service.path)) {
        log.info('Service already running', { service: service.name });
        return false;
      }

      const command = typeof service.command === 'string' ? service.command : '';
      if (!command.trim()) {
        log.warn('No start command specified', { service: service.name });
        return false;
      }

      log.info('Starting service', { 
        service: service.name, 
        command,
        logLimit: this.options.logStorageLimit 
      });

      const cwd = service.path || process.cwd();
      const child: ChildProcess = spawn(command, [], { cwd, shell: true });
      
      const logs: string[] = [];
      const info: ProcessInfo = {
        pid: child.pid ?? -1,
        status: 'running',
        startTime: new Date(),
        logs,
      };

      this.setupProcessEventHandlers(child, service, logs, info);
      this.processes.set(service.path, { process: child, info });

      eventBus.emitServiceStarted(service);
      log.info('Service started successfully', { service: service.name, pid: child.pid });

      return true;
    } catch (error) {
      log.warn('Failed to start service', { service: service.name, error: error as Error });
      eventBus.emitServiceError(service, error as Error);
      return false;
    }
  }

  private setupProcessEventHandlers(
    child: ChildProcess,
    service: Service,
    logs: string[],
    info: ProcessInfo
  ): void {
    const emitLog = (line: string) => {
      logs.push(line);
      if (logs.length > (this.options.logStorageLimit || 100)) {
        logs.shift();
      }

      // Emit log update event
      eventBus.emitServiceLogUpdate(service, line);

      // Check for port-in-use errors
      this.handlePortInUseError(line, service, logs);
    };

    child.stdout?.on('data', (data: Buffer) => {
      emitLog(data.toString());
    });

    child.stderr?.on('data', (data: Buffer) => {
      emitLog(data.toString());
    });

    child.on('exit', (code: number | null) => {
      info.status = 'stopped';
      info.exitCode = code || -1;
      emitLog(`Process exited with code ${code}`);
      
      eventBus.emitServiceStopped(service);
      log.info('Service stopped', { service: service.name, exitCode: code });
    });

    child.on('error', (err: Error) => {
      info.status = 'error';
      info.error = err.message;
      emitLog(`Process error: ${err.message}`);
      
      eventBus.emitServiceError(service, err);
      log.warn('Service error', { service: service.name, error: err });
    });
  }

  private async handlePortInUseError(line: string, service: Service, logs: string[]): Promise<void> {
    if (!/EADDRINUSE|address already in use/i.test(line)) {
      return;
    }

    const portMatch =
      line.match(/EADDRINUSE.*(?:port |:)(\d{2,5})/i) ||
      line.match(/address already in use.*(?:port |:)(\d{2,5})/i) ||
      line.match(/listen EADDRINUSE.*:(\d{2,5})/i) ||
      line.match(/port (\d{2,5}) is already in use/i);

    const port = portMatch && portMatch[1] ? parseInt(portMatch[1], 10) : null;
    
    try {
      const processInfo = port ? await this.getProcessUsingPort(port) : null;
      await this.showPortInUseDialog(service, port, processInfo, logs);
    } catch (error) {
      log.warn('Error handling port in use', { service: service.name, port, error: error as Error });
    }
  }

  private async getProcessUsingPort(port: number): Promise<{ pid: string; command: string } | null> {
    try {
      const lsofOut = execSync(
        `lsof -i :${port} -sTCP:LISTEN -Pn | awk 'NR>1 {print $2, $1}'`
      ).toString().trim();

      if (lsofOut) {
        const [pid, command] = lsofOut.split(' ');
        return { pid: pid!, command: command! };
      }
    } catch (error) {
      log.debug('Could not get process info for port', { port, error: error as Error });
    }

    return null;
  }

  private async showPortInUseDialog(
    service: Service,
    port: number | null,
    processInfo: { pid: string; command: string } | null,
    logs: string[]
  ): Promise<void> {
    const dialogOptions = {
      type: 'error' as const,
      buttons: ['Ignore', 'Mark as Running', 'Kill Process and Start'],
      defaultId: 0,
      cancelId: 0,
      title: 'Port In Use Error',
      message: port
        ? `Service '${service.name}' failed to start: Port ${port} is already in use.`
        : `Service '${service.name}' failed to start due to a port conflict, but the port could not be determined from the error message. Please check your logs or configuration.`,
    };

    if (processInfo) {
      dialogOptions.message += `\nProcess: PID ${processInfo.pid}, Command: ${processInfo.command}`;
    }

    const result = await dialog.showMessageBox(dialogOptions);

    switch (result.response) {
      case 1: // Mark as Running
        this.processes.set(service.path, {
          process: null,
          info: {
            pid: processInfo ? parseInt(processInfo.pid, 10) : -1,
            status: 'running',
            startTime: new Date(),
            logs: [...logs, `Adopted running process PID ${processInfo?.pid || '?'}${port ? ` on port ${port}` : ''}`],
          },
        });
        eventBus.emitServiceStarted(service);
        break;

      case 2: // Kill Process and Start
        if (processInfo && port) {
          try {
            process.kill(parseInt(processInfo.pid, 10));
            logs.push(`Killed process PID ${processInfo.pid} on port ${port}`);
            await this.startService(service);
          } catch (error) {
            logs.push(`Failed to kill process PID ${processInfo.pid}: ${error}`);
            log.warn('Failed to kill process', { pid: processInfo.pid, error: error as Error });
          }
        }
        break;
    }
  }

  async stopService(service: Service): Promise<boolean> {
    try {
      const managed = this.processes.get(service.path);
      if (!managed) {
        log.info('Service not running', { service: service.name });
        return false;
      }

      log.info('Stopping service', { service: service.name });
      managed.info.status = 'stopping';

      if (managed.process) {
        managed.process.kill();
      }

      this.processes.delete(service.path);
      eventBus.emitServiceStopped(service);
      
      log.info('Service stopped successfully', { service: service.name });
      return true;
    } catch (error) {
      log.warn('Failed to stop service', { service: service.name, error: error as Error });
      return false;
    }
  }

  async stopAllServices(): Promise<void> {
    log.info('Stopping all services', { count: this.processes.size });
    
    const stopPromises = Array.from(this.processes.keys()).map(async (servicePath) => {
      const managed = this.processes.get(servicePath);
      if (managed?.process) {
        try {
          managed.process.kill();
        } catch (error) {
          log.warn('Error killing process', { servicePath, error: error as Error });
        }
      }
    });

    await Promise.all(stopPromises);
    this.processes.clear();
    
    log.info('All services stopped');
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

  getRunningServices(): string[] {
    return Array.from(this.processes.keys()).filter(path => 
      this.getServiceStatus(path) === 'running'
    );
  }

  private startStatusPolling(): void {
    this.statusPollingInterval = setInterval(() => {
      for (const [servicePath, managed] of this.processes.entries()) {
        if (managed.process && managed.info.status === 'running') {
          // Check if process has exited
          if (managed.process.exitCode !== null) {
            managed.info.status = 'stopped';
            managed.info.exitCode = managed.process.exitCode;
            log.info('Service stopped (exit code)', { 
              servicePath, 
              exitCode: managed.process.exitCode 
            });
            this.notifyStatusChange(servicePath, 'stopped');
            continue;
          }

          // Check if process is still alive by sending a signal 0
          try {
            if (managed.process.pid) {
              process.kill(managed.process.pid, 0);
            }
          } catch (error) {
            // Process is no longer alive
            managed.info.status = 'stopped';
            managed.info.exitCode = -1;
            log.info('Service stopped (process killed)', { servicePath });
            this.notifyStatusChange(servicePath, 'stopped');
          }
        }
      }
    }, this.options.statusPollingInterval);
  }

  private notifyStatusChange(servicePath: string, status: ServiceStatus): void {
    eventBus.emitServiceStatusChanged(servicePath, status);
  }

  destroy(): void {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
    
    this.stopAllServices().catch(error => {
      log.error('Error during cleanup', error as Error);
    });
  }
} 