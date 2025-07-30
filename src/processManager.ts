import { Service, ServiceStatus, ProcessInfo, ProcessManagerOptions } from './types';
import { spawn, ChildProcess } from 'child_process';
const { webContents, dialog } = require('electron');

interface ManagedProcess {
  process: ChildProcess | null;
  info: ProcessInfo;
}

export class ProcessManager {
  private processes: Map<string, ManagedProcess> = new Map();
  private _options: ProcessManagerOptions;
  private statusChangeCallbacks: ((servicePath: string, status: ServiceStatus) => void)[] = [];

  constructor(options?: ProcessManagerOptions) {
    this._options = {
      logStorageLimit: 100,
      statusPollingInterval: 3000,
      gracefulShutdownTimeout: 5000,
      ...options
    };
    // Add periodic status polling
    setInterval(() => {
      for (const [servicePath, managed] of this.processes.entries()) {
        if (managed.process && managed.info.status === 'running') {
          // Check if process has exited
          if (managed.process.exitCode !== null) {
            managed.info.status = 'stopped';
            managed.info.exitCode = managed.process.exitCode;
            console.log(`Service stopped (exit code ${managed.process.exitCode}): ${servicePath}`);
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
            console.log(`Service stopped (process killed): ${servicePath}`);
            this.notifyStatusChange(servicePath, 'stopped');
          }
        }
      }
    }, this._options.statusPollingInterval);
  }

  async startService(service: Service): Promise<boolean> {
    try {
      if (this.processes.has(service.path)) {
        console.log(`Service already running: ${service.name}`);
        return false;
      }
      // No up-front port detection or prompt. Always attempt to start the service.
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
        // Log monitoring for port-in-use errors
        if (/EADDRINUSE|address already in use/i.test(line)) {
          // Only match explicit port-in-use error patterns
          const portMatch =
            line.match(/EADDRINUSE.*(?:port |:)(\d{2,5})/i) ||
            line.match(/address already in use.*(?:port |:)(\d{2,5})/i) ||
            line.match(/listen EADDRINUSE.*:(\d{2,5})/i) ||
            line.match(/port (\d{2,5}) is already in use/i);
          const port = portMatch && portMatch[1] ? parseInt(portMatch[1], 10) : null;
          (async () => {
            let processInfo: { pid: string, command: string } | null = null;
            if (port) {
              try {
                const { execSync } = require('child_process');
                const lsofOut = execSync(`lsof -i :${port} -sTCP:LISTEN -Pn | awk 'NR>1 {print $2, $1}'`).toString().trim();
                if (lsofOut) {
                  const [pid, command] = lsofOut.split(' ');
                  processInfo = { pid, command };
                }
              } catch (e) { /* ignore */ }
            }
            let dialogOpts: any;
            if (port) {
              dialogOpts = {
                type: 'error',
                buttons: ['Ignore', 'Mark as Running', 'Kill Process and Start'],
                defaultId: 0,
                cancelId: 0,
                title: 'Port In Use Error',
                message: `Service '${service.name}' failed to start: Port ${port} is already in use.`
              };
              if (processInfo) {
                dialogOpts.message += `\nProcess: PID ${processInfo.pid}, Command: ${processInfo.command}`;
              }
            } else {
              dialogOpts = {
                type: 'error',
                buttons: ['Ignore', 'Mark as Running'],
                defaultId: 0,
                cancelId: 0,
                title: 'Port In Use Error',
                message: `Service '${service.name}' failed to start due to a port conflict, but the port could not be determined from the error message. Please check your logs or configuration.`
              };
            }
            const result = await dialog.showMessageBox(dialogOpts);
            if (result.response === 1) { // Mark as Running
              this.processes.set(service.path, {
                process: null,
                info: {
                  pid: processInfo ? parseInt(processInfo.pid, 10) : -1,
                  status: 'running',
                  startTime: new Date(),
                  logs: [...logs, `Adopted running process PID ${processInfo ? processInfo.pid : '?'}${port ? ' on port ' + port : ''}`]
                }
              });
            } else if (result.response === 2 && processInfo && port) { // Kill Process and Start
              try {
                process.kill(parseInt(processInfo.pid, 10));
                logs.push(`Killed process PID ${processInfo.pid} on port ${port}`);
                // After killing, try to start again
                await this.startService(service);
              } catch (e) {
                logs.push(`Failed to kill process PID ${processInfo.pid}: ${e}`);
              }
            }
          })();
        }
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
      });
      child.on('error', (err: Error) => {
        info.status = 'error';
        info.error = err.message;
        emitLog(`Process error: ${err.message}`);
      });
      this.processes.set(service.path, { process: child, info });
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

  onStatusChange(callback: (servicePath: string, status: ServiceStatus) => void): void {
    this.statusChangeCallbacks.push(callback);
  }

  private notifyStatusChange(servicePath: string, status: ServiceStatus): void {
    for (const callback of this.statusChangeCallbacks) {
      try {
        callback(servicePath, status);
      } catch (error) {
        console.error('Error in status change callback:', error);
      }
    }
  }
}