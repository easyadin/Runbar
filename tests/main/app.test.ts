import { jest } from '@jest/globals';
import { RunbarApp } from '../../src/main/app';
import { StorageService } from '../../src/services/storage';
import { ServiceDiscoveryService } from '../../src/services/discovery';
import { TrayMenuController } from '../../src/ui/trayMenuController';

// Mock dependencies
jest.mock('../../src/services/storage');
jest.mock('../../src/services/discovery');
jest.mock('../../src/ui/trayMenuController');
jest.mock('../../src/shared/events', () => ({
  eventBus: {
    on: jest.fn(),
    emitAppReady: jest.fn(),
  },
}));

describe('RunbarApp', () => {
  let runbarApp: RunbarApp;
  let mockStorageService: jest.Mocked<StorageService>;
  let mockDiscoveryService: jest.Mocked<ServiceDiscoveryService>;
  let mockTrayController: jest.Mocked<TrayMenuController>;

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

    mockTrayController = {
      initialize: jest.fn().mockResolvedValue(undefined),
      updateMenu: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
    } as any;

    // Mock the constructors
    (StorageService as jest.MockedClass<typeof StorageService>).mockImplementation(() => mockStorageService);
    (ServiceDiscoveryService as jest.MockedClass<typeof ServiceDiscoveryService>).mockImplementation(() => mockDiscoveryService);
    (TrayMenuController as jest.MockedClass<typeof TrayMenuController>).mockImplementation(() => mockTrayController);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      runbarApp = new RunbarApp();
      
      await runbarApp.initialize();
      
      expect(mockStorageService.initialize).toHaveBeenCalled();
      expect(mockTrayController.initialize).toHaveBeenCalled();
      expect(runbarApp.isReady()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      mockStorageService.initialize.mockRejectedValue(new Error('Storage failed'));
      
      runbarApp = new RunbarApp();
      
      await expect(runbarApp.initialize()).rejects.toThrow('Storage failed');
      expect(runbarApp.isReady()).toBe(false);
    });
  });

  describe('service management', () => {
    beforeEach(async () => {
      runbarApp = new RunbarApp();
      await runbarApp.initialize();
    });

    it('should get services', async () => {
      const mockServices = [
        { id: '1', name: 'Test Service', path: '/test', command: 'npm start' },
      ];
      mockStorageService.getServices.mockResolvedValue(mockServices as any);
      
      const services = await runbarApp.getServices();
      
      expect(services).toEqual(mockServices);
      expect(mockStorageService.getServices).toHaveBeenCalled();
    });

    it('should add service', async () => {
      const serviceData = {
        name: 'New Service',
        path: '/new/path',
        command: 'npm start',
      };
      
      const mockService = { id: '1', ...serviceData };
      mockStorageService.addService.mockResolvedValue(mockService as any);
      
      const result = await runbarApp.addService(serviceData);
      
      expect(result).toEqual(mockService);
      expect(mockStorageService.addService).toHaveBeenCalledWith(serviceData);
      expect(mockTrayController.updateMenu).toHaveBeenCalled();
    });

    it('should update service', async () => {
      const updates = { name: 'Updated Service' };
      const mockService = { id: '1', name: 'Updated Service' };
      mockStorageService.updateService.mockResolvedValue(mockService as any);
      
      const result = await runbarApp.updateService('1', updates);
      
      expect(result).toEqual(mockService);
      expect(mockStorageService.updateService).toHaveBeenCalledWith('1', updates);
      expect(mockTrayController.updateMenu).toHaveBeenCalled();
    });

    it('should delete service', async () => {
      mockStorageService.deleteService.mockResolvedValue(undefined);
      
      await runbarApp.deleteService('1');
      
      expect(mockStorageService.deleteService).toHaveBeenCalledWith('1');
      expect(mockTrayController.updateMenu).toHaveBeenCalled();
    });
  });

  describe('discovery', () => {
    beforeEach(async () => {
      runbarApp = new RunbarApp();
      await runbarApp.initialize();
    });

    it('should discover services', async () => {
      const mockDiscoveredServices = [
        { name: 'Discovered Service', path: '/discovered', command: 'npm start' },
      ];
      mockDiscoveryService.discoverServices.mockResolvedValue(mockDiscoveredServices as any);
      
      const result = await runbarApp.discoverServices('/test/path');
      
      expect(result).toEqual(mockDiscoveredServices);
      expect(mockDiscoveryService.discoverServices).toHaveBeenCalledWith('/test/path');
    });
  });

  describe('configuration', () => {
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
}); 