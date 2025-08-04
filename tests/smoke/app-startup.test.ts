import { jest } from '@jest/globals';

// Mock Electron completely
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
  })),
  dialog: {
    showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
  },
  nativeImage: {
    createFromPath: jest.fn().mockReturnValue({}),
  },
  app: {
    setName: jest.fn(),
    setAppUserModelId: jest.fn(),
    dock: {
      setIcon: jest.fn(),
    },
    whenReady: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    quit: jest.fn(),
  },
}));

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(false),
  readJson: jest.fn().mockResolvedValue([]),
  writeJson: jest.fn().mockResolvedValue(undefined),
  copy: jest.fn().mockResolvedValue(undefined),
}));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    pid: 12345,
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn(),
    kill: jest.fn(),
    exitCode: null,
  }),
  execSync: jest.fn().mockReturnValue(Buffer.from('')),
}));

describe('Application Smoke Test', () => {
  it('should import all modules without errors', () => {
    // Test that all our modules can be imported
    expect(() => {
      require('../../src/shared/types');
      require('../../src/shared/logger');
      require('../../src/shared/events');
      require('../../src/shared/config');
      require('../../src/services/storage');
      require('../../src/services/discovery');
      require('../../src/core/processManager');
      require('../../src/core/scanner');
      require('../../src/core/serviceIgnore');
      require('../../src/ui/trayMenuBuilder');
      require('../../src/ui/dialogService');
      require('../../src/ui/trayMenuController');
      require('../../src/main/app');
      require('../../src/main/index');
    }).not.toThrow();
  });

  it('should create event bus singleton', () => {
    const { eventBus } = require('../../src/shared/events');
    expect(eventBus).toBeDefined();
    expect(typeof eventBus.emit).toBe('function');
    expect(typeof eventBus.on).toBe('function');
  });

  it('should create logger', () => {
    const { createServiceLogger } = require('../../src/shared/logger');
    const logger = createServiceLogger('test');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should load configuration', () => {
    const { config } = require('../../src/shared/config');
    expect(config).toBeDefined();
    expect(config.app).toBeDefined();
    expect(config.build).toBeDefined();
  });

  it('should create storage service', () => {
    const { StorageService } = require('../../src/services/storage');
    const storage = new StorageService();
    expect(storage).toBeDefined();
    expect(typeof storage.initialize).toBe('function');
  });

  it('should create discovery service', () => {
    const { ServiceDiscoveryService } = require('../../src/services/discovery');
    const discovery = new ServiceDiscoveryService();
    expect(discovery).toBeDefined();
    expect(typeof discovery.discoverServices).toBe('function');
  });

  it('should create process manager', () => {
    const { ProcessManager } = require('../../src/core/processManager');
    const processManager = new ProcessManager();
    expect(processManager).toBeDefined();
    expect(typeof processManager.startService).toBe('function');
  });

  it('should create scanner', () => {
    const { ServiceScanner } = require('../../src/core/scanner');
    const scanner = new ServiceScanner();
    expect(scanner).toBeDefined();
    expect(typeof scanner.scanFolder).toBe('function');
  });

  it('should create tray menu builder', () => {
    const { TrayMenuBuilder } = require('../../src/ui/trayMenuBuilder');
    const builder = new TrayMenuBuilder();
    expect(builder).toBeDefined();
    expect(typeof builder.buildMenu).toBe('function');
  });

  it('should create dialog service', () => {
    const { DialogService } = require('../../src/ui/dialogService');
    const dialogService = new DialogService();
    expect(dialogService).toBeDefined();
    expect(typeof dialogService.selectFolder).toBe('function');
  });

  it('should create tray menu controller', () => {
    const { TrayMenuController } = require('../../src/ui/trayMenuController');
    const mockStorage = { getServices: jest.fn(), getGroups: jest.fn() };
    const mockProcessManager = { startService: jest.fn(), stopService: jest.fn() };
    
    const controller = new TrayMenuController({
      storageService: mockStorage as any,
      processManager: mockProcessManager as any,
    });
    
    expect(controller).toBeDefined();
    expect(typeof controller.initialize).toBe('function');
  });

  it('should create main app', () => {
    const { RunbarApp } = require('../../src/main/app');
    const app = new RunbarApp();
    expect(app).toBeDefined();
    expect(typeof app.initialize).toBe('function');
    expect(typeof app.isReady).toBe('function');
  });

  it('should emit events without errors', () => {
    const { eventBus } = require('../../src/shared/events');
    
    expect(() => {
      eventBus.emitAppReady();
      eventBus.emitAppShutdown();
      eventBus.emitTrayUpdate();
    }).not.toThrow();
  });

  it('should handle service events', () => {
    const { eventBus } = require('../../src/shared/events');
    const mockService = { id: '1', name: 'Test Service', path: '/test' };
    
    expect(() => {
      eventBus.emitServiceStarted(mockService as any);
      eventBus.emitServiceStopped(mockService as any);
      eventBus.emitServiceError(mockService as any, new Error('Test error'));
    }).not.toThrow();
  });
}); 