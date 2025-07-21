import { Service, ServiceStatus, ProcessInfo, ProcessManagerOptions } from './types';
import { spawn, ChildProcess } from 'child_process';
import detectPort from 'detect-port';
const { webContents, dialog } = require('electron');

interface ManagedProcess {
  process: ChildProcess | null;
  info: ProcessInfo;
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
                }
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
}