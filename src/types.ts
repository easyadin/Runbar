export interface Service {
  name: string;
  path: string;
  command: string;
  autoStart?: boolean;
  projectType?: ProjectType;
  status?: ServiceStatus;
  logs?: string[];
  lastStarted?: string;
  lastStopped?: string;
}

export interface Group {
  name: string;
  services: string[]; // Service names
  autoStart?: boolean;
  lastRun?: string;
}

export interface Settings {
  version: string;
  globalAutoStart: boolean;
  discoveryMarkers: string[];
  logStorageLimit?: number;
  statusPollingInterval?: number;
  autoUpdateEnabled?: boolean;
}

export interface ConfigData {
  version: string;
  exportDate?: string;
  services: Service[];
  groups: Group[];
  settings: Settings;
}

export type ServiceStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error';

export type ProjectType = 
  | 'nodejs' 
  | 'ruby' 
  | 'go' 
  | 'rust' 
  | 'python' 
  | 'java' 
  | 'docker' 
  | 'unknown';

export interface DiscoveredService {
  name: string;
  path: string;
  command: string;
  projectType: ProjectType;
  configFile: string;
  packageManager?: string;
  scripts?: Record<string, string>;
}

export interface ProcessInfo {
  pid: number;
  status: ServiceStatus;
  startTime: Date;
  logs: string[];
  exitCode?: number;
  error?: string;
}

export interface TrayStatus {
  overall: 'running' | 'starting' | 'stopped' | 'error';
  runningCount: number;
  totalCount: number;
  errorCount: number;
}

export interface ServiceDiscoveryOptions {
  markers: string[];
  maxDepth?: number;
  ignorePatterns?: string[];
}

export interface ProcessManagerOptions {
  logStorageLimit?: number;
  statusPollingInterval?: number;
  gracefulShutdownTimeout?: number;
}

export interface StorageOptions {
  configDir?: string;
  backupOnError?: boolean;
  validateOnLoad?: boolean;
}

// Event types for the app
export interface ServiceEvent {
  type: 'started' | 'stopped' | 'error' | 'status-changed';
  service: Service;
  timestamp: Date;
  data?: any;
}

export interface GroupEvent {
  type: 'started' | 'stopped' | 'error';
  group: Group;
  timestamp: Date;
  results: Array<{ service: string; success: boolean; error?: string }>;
}

// Error types
export class RunbarError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'RunbarError';
  }
}

export class ServiceError extends RunbarError {
  constructor(
    message: string,
    public service: Service,
    details?: any
  ) {
    super(message, 'SERVICE_ERROR', details);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends RunbarError {
  constructor(
    message: string,
    public field: string,
    public value?: any
  ) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
} 