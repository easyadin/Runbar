// Core domain types
export interface Service {
  id: string;
  name: string;
  path: string;
  command: string;
  port?: number;
  autoStart?: boolean;
  projectType?: ProjectType;
  status?: ServiceStatus;
  logs?: string[];
  lastStarted?: string;
  lastStopped?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  services: string[]; // Service IDs
  autoStart?: boolean;
  lastRun?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  version: string;
  globalAutoStart: boolean;
  discoveryMarkers: string[];
  logStorageLimit?: number;
  statusPollingInterval?: number;
  autoUpdateEnabled?: boolean;
  theme?: 'light' | 'dark' | 'system';
  notifications?: boolean;
}

export interface ConfigData {
  version: string;
  exportDate?: string;
  services: Service[];
  groups: Group[];
  settings: Settings;
}

// Status and type enums
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

// Discovery types
export interface DiscoveredService {
  name: string;
  path: string;
  command: string;
  projectType: ProjectType;
  configFile: string;
  packageManager?: string;
  scripts?: Record<string, string>;
}

export interface ServiceDiscoveryOptions {
  markers: string[];
  maxDepth?: number;
  ignorePatterns?: string[];
}

// Process management types
export interface ProcessInfo {
  pid: number;
  status: ServiceStatus;
  startTime: Date;
  logs: string[];
  exitCode?: number;
  error?: string;
}

export interface ProcessManagerOptions {
  logStorageLimit?: number;
  statusPollingInterval?: number;
  gracefulShutdownTimeout?: number;
}

// UI types
export interface TrayStatus {
  overall: 'running' | 'starting' | 'stopped' | 'error';
  runningCount: number;
  totalCount: number;
  errorCount: number;
}

// Storage types
export interface StorageOptions {
  configDir?: string;
  backupOnError?: boolean;
  validateOnLoad?: boolean;
}

// Event types
export interface ServiceEvent {
  type: 'started' | 'stopped' | 'error' | 'status-changed';
  service: Service;
  timestamp: Date;
  data?: unknown;
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
    public details?: unknown
  ) {
    super(message);
    this.name = 'RunbarError';
  }
}

export class ServiceError extends RunbarError {
  constructor(
    message: string,
    public service: Service,
    details?: unknown
  ) {
    super(message, 'SERVICE_ERROR', details);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends RunbarError {
  constructor(
    message: string,
    public field: string,
    public value?: unknown
  ) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

export class StorageError extends RunbarError {
  constructor(
    message: string,
    public operation: string,
    details?: unknown
  ) {
    super(message, 'STORAGE_ERROR', { operation, ...(details as Record<string, unknown>) });
    this.name = 'StorageError';
  }
}

// Configuration types
export interface AppConfig {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  repository: string;
  homepage: string;
}

export interface BuildConfig {
  appId: string;
  productName: string;
  directories: {
    output: string;
  };
  files: string[];
  mac: {
    category: string;
    icon: string;
    target: string;
  };
} 