import { z } from 'zod';
import type { AppConfig, BuildConfig } from './types';

// Environment configuration schema
const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  CONFIG_DIR: z.string().optional(),
  AUTO_UPDATE_ENABLED: z.boolean().default(true),
  NOTIFICATIONS_ENABLED: z.boolean().default(true),
});

// App configuration
export const appConfig: AppConfig = {
  name: 'Runbar',
  version: '1.0.0',
  description: 'A macOS tray app that helps developers manage multiple local services from a single place',
  author: 'Runbar Team',
  license: 'MIT',
  repository: 'https://github.com/runbar/runbar',
  homepage: 'https://runbar.app',
};

// Build configuration
export const buildConfig: BuildConfig = {
  appId: 'com.runbar.app',
  productName: 'Runbar',
  directories: {
    output: 'dist',
  },
  files: [
    'dist/**/*',
    'assets/**/*',
    'node_modules/fs-extra/**/*',
    'node_modules/graceful-fs/**/*',
    'node_modules/jsonfile/**/*',
    'node_modules/universalify/**/*',
    '!src/**/*',
    '!**/*.test.ts',
  ],
  mac: {
    category: 'public.app-category.developer-tools',
    icon: 'assets/icon.icns',
    target: 'dmg',
  },
};

// Default settings
export const defaultSettings = {
  version: '1.0.0',
  globalAutoStart: false,
  discoveryMarkers: [
    'package.json',
    'Gemfile',
    'go.mod',
    'Cargo.toml',
    'requirements.txt',
    'pom.xml',
    'build.gradle',
    'docker-compose.yml',
  ],
  logStorageLimit: 100,
  statusPollingInterval: 3000,
  autoUpdateEnabled: true,
  theme: 'system' as const,
  notifications: true,
};

// Process manager defaults
export const processManagerDefaults = {
  logStorageLimit: 100,
  statusPollingInterval: 3000,
  gracefulShutdownTimeout: 5000,
};

// Discovery defaults
export const discoveryDefaults = {
  maxDepth: 5,
  ignorePatterns: [
    'node_modules',
    '.git',
    '.DS_Store',
    'dist',
    'build',
    'coverage',
  ],
};

// Get environment configuration
export function getEnvironmentConfig() {
  try {
    return EnvironmentSchema.parse(process.env);
  } catch (error) {
    console.warn('Invalid environment configuration, using defaults:', error);
    return EnvironmentSchema.parse({});
  }
}

// Get configuration directory
export function getConfigDir(): string {
  const env = getEnvironmentConfig();
  if (env.CONFIG_DIR) {
    return env.CONFIG_DIR;
  }
  
  const os = require('os');
  return require('path').join(os.homedir(), '.runbar');
}

// Get log directory
export function getLogDir(): string {
  return require('path').join(getConfigDir(), 'logs');
}

// Configuration validation
export function validateConfig(_config: unknown): boolean {
  try {
    // Add validation schemas here as needed
    return true;
  } catch (error) {
    console.error('Configuration validation failed:', error);
    return false;
  }
}

// Export configuration helpers
export const config = {
  app: appConfig,
  build: buildConfig,
  defaults: {
    settings: defaultSettings,
    processManager: processManagerDefaults,
    discovery: discoveryDefaults,
  },
  getEnvironment: getEnvironmentConfig,
  getConfigDir,
  getLogDir,
  validate: validateConfig,
}; 