import { jest } from '@jest/globals';
import { RunbarApp } from '../../src/main/app';
import { StorageService } from '../../src/services/storage';
import { ServiceDiscoveryService } from '../../src/services/discovery';
import { ProcessManager } from '../../src/core/processManager';
import { ServiceScanner } from '../../src/core/scanner';
import { eventBus } from '../../src/shared/events';
import type { Service, Group, Settings } from '../../src/shared/types';

// Mock Electron
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

describe('Architecture Integration', () => {
  let runbarApp: RunbarApp;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockDiscoveryService: jest.Mocked<ServiceDiscoveryService>;
  let mockProcessManager: jest.Mocked<ProcessManager>;
  let mockScanner: jest.Mocked<ServiceScanner>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockStorageService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getServices: jest.fn().mockResolvedValue([]),
      getGroups: jest.fn().mockResolvedValue([]),
      getSettings: jest.fn().mockResolvedValue({
        version: '1.0.0',
        globalAutoStart: false,
        discoveryMarkers: ['package.json'],
      }),
      addService: jest.fn(),
      updateService: jest.fn(),
      deleteService: jest.fn(),
      exportConfig: jest.fn(),
      importConfig: jest.fn(),
    } as any;

    mockDiscoveryService = {
      validateServicePath: jest.fn().mockResolvedValue(true),
      discoverServices: jest.fn().mockResolvedValue([]),
      getProjectInfo: jest.fn().mockResolvedValue(null),
    } as any;

    mockProcessManager = {
      startService: jest.fn().mockResolvedValue(true),
      stopService: jest.fn().mockResolvedValue(true),
      getServiceStatus: jest.fn().mockReturnValue('stopped'),
      getServiceLogs: jest.fn().mockReturnValue([]),
      stopAllServices: jest.fn().mockResolvedValue(undefined),
      getRunningServices: jest.fn().mockReturnValue([]),
      destroy: jest.fn(),
    } as any;

    mockScanner = {
      scanFolder: jest.fn().mockResolvedValue([]),
      detectServiceFromFile: jest.fn().mockResolvedValue(null),
      validateServicePath: jest.fn().mockResolvedValue(true),
    } as any;

    // Mock the constructors
    (StorageService as jest.MockedClass<typeof StorageService>).mockImplementation(() => mockStorageService);
    (ServiceDiscoveryService as jest.MockedClass<typeof ServiceDiscoveryService>).mockImplementation(() => mockDiscoveryService);
    (ProcessManager as jest.MockedClass<typeof ProcessManager>).mockImplementation(() => mockProcessManager);
    (ServiceScanner as jest.MockedClass<typeof ServiceScanner>).mockImplementation(() => mockScanner);
  });

  describe('Application Initialization', () => {
    it('should initialize all components successfully', async () => {
      runbarApp = new RunbarApp();
      
      await runbarApp.initialize();
      
      expect(mockStorageService.initialize).toHaveBeenCalled();
      expect(runbarApp.isReady()).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      mockStorageService.initialize.mockRejectedValue(new Error('Storage failed'));
      
      runbarApp = new RunbarApp();
      
      await expect(runbarApp.initialize()).rejects.toThrow('Storage failed');
      expect(runbarApp.isReady()).toBe(false);
    });
  });

  describe('Service Management Integration', () => {
    beforeEach(async () => {
      runbarApp = new RunbarApp();
      await runbarApp.initialize();
    });

    it('should add service and update tray menu', async () => {
      const serviceData = {
        name: 'Test Service',
        path: '/test/path',
        command: 'npm start',
      };
      
      const mockService = { id: '1', ...serviceData };
      mockStorageService.addService.mockResolvedValue(mockService as any);
      
      const result = await runbarApp.addService(serviceData);
      
      expect(result).toEqual(mockService);
      expect(mockStorageService.addService).toHaveBeenCalledWith(serviceData);
    });

    it('should update service and notify components', async () => {
      const updates = { name: 'Updated Service' };
      const mockService = { id: '1', name: 'Updated Service' };
      mockStorageService.updateService.mockResolvedValue(mockService as any);
      
      const result = await runbarApp.updateService('1', updates);
      
      expect(result).toEqual(mockService);
      expect(mockStorageService.updateService).toHaveBeenCalledWith('1', updates);
    });

    it('should delete service and clean up', async () => {
      mockStorageService.deleteService.mockResolvedValue(undefined);
      
      await runbarApp.deleteService('1');
      
      expect(mockStorageService.deleteService).toHaveBeenCalledWith('1');
    });
  });

  describe('Service Discovery Integration', () => {
    beforeEach(async () => {
      runbarApp = new RunbarApp();
      await runbarApp.initialize();
    });

    it('should discover services from folder', async () => {
      const mockDiscoveredServices = [
        { name: 'Discovered Service', path: '/discovered', command: 'npm start' },
      ];
      mockDiscoveryService.discoverServices.mockResolvedValue(mockDiscoveredServices as any);
      
      const result = await runbarApp.discoverServices('/test/path');
      
      expect(result).toEqual(mockDiscoveredServices);
      expect(mockDiscoveryService.discoverServices).toHaveBeenCalledWith('/test/path');
    });
  });

  describe('Event System Integration', () => {
    it('should emit and handle events correctly', () => {
      const mockListener = jest.fn();
      eventBus.on('service:started', mockListener);
      
      const mockService = { id: '1', name: 'Test Service' } as Service;
      eventBus.emitServiceStarted(mockService);
      
      expect(mockListener).toHaveBeenCalledWith({
        type: 'started',
        service: mockService,
        timestamp: expect.any(Date),
      });
    });

    it('should handle multiple event types', () => {
      const mockListener = jest.fn();
      eventBus.on('config:changed', mockListener);
      
      const mockService = { id: '1', name: 'Test Service' } as Service;
      eventBus.emitConfigChanged('service', mockService);
      
      expect(mockListener).toHaveBeenCalledWith({
        type: 'service',
        data: mockService,
      });
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      runbarApp = new RunbarApp();
      await runbarApp.initialize();
    });

    it('should get settings', async () => {
      const mockSettings = {
        version: '1.0.0',
        globalAutoStart: true,
        discoveryMarkers: ['package.json'],
      };
      mockStorageService.getSettings.mockResolvedValue(mockSettings as any);
      
      const settings = await runbarApp.getSettings();
      
      expect(settings).toEqual(mockSettings);
      expect(mockStorageService.getSettings).toHaveBeenCalled();
    });

    it('should get groups', async () => {
      const mockGroups = [
        { id: '1', name: 'Test Group', services: [] },
      ];
      mockStorageService.getGroups.mockResolvedValue(mockGroups as any);
      
      const groups = await runbarApp.getGroups();
      
      expect(groups).toEqual(mockGroups);
      expect(mockStorageService.getGroups).toHaveBeenCalled();
    });
  });

  describe('Process Management Integration', () => {
    beforeEach(async () => {
      runbarApp = new RunbarApp();
      await runbarApp.initialize();
    });

    it('should start services through process manager', async () => {
      const mockService = { id: '1', name: 'Test Service', path: '/test' } as Service;
      mockStorageService.getServices.mockResolvedValue([mockService]);
      mockStorageService.getSettings.mockResolvedValue({
        version: '1.0.0',
        globalAutoStart: true,
        discoveryMarkers: ['package.json'],
      } as any);
      
      // Re-initialize to trigger auto-start
      await runbarApp.initialize();
      
      expect(mockProcessManager.startService).toHaveBeenCalledWith(mockService);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockStorageService.getServices.mockRejectedValue(new Error('Storage error'));
      
      runbarApp = new RunbarApp();
      
      await expect(runbarApp.getServices()).rejects.toThrow('Storage error');
    });

    it('should handle discovery errors gracefully', async () => {
      mockDiscoveryService.discoverServices.mockRejectedValue(new Error('Discovery error'));
      
      runbarApp = new RunbarApp();
      await runbarApp.initialize();
      
      await expect(runbarApp.discoverServices('/test')).rejects.toThrow('Discovery error');
    });
  });

  describe('Component Communication', () => {
    it('should communicate between components via events', () => {
      const mockListener = jest.fn();
      eventBus.on('tray:update', mockListener);
      
      eventBus.emitTrayUpdate();
      
      expect(mockListener).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
      });
    });
  });
}); 