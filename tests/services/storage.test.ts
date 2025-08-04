import { jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { StorageService } from '../../src/services/storage';
import type { Service, Group, Settings } from '../../src/shared/types';

// Mock fs-extra
jest.mock('fs-extra');

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

describe('StorageService', () => {
  let storageService: StorageService;
  let mockConfigDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigDir = '/tmp/runbar-test';
    storageService = new StorageService({
      configDir: mockConfigDir,
      backupOnError: false,
      validateOnLoad: true,
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      (fs.ensureDir as jest.MockedFunction<typeof fs.ensureDir>).mockResolvedValue(undefined);
      (fs.pathExists as jest.MockedFunction<typeof fs.pathExists>).mockResolvedValue(false);
      (fs.writeJson as jest.MockedFunction<typeof fs.writeJson>).mockResolvedValue(undefined);

      await storageService.initialize();

      expect(fs.ensureDir).toHaveBeenCalledWith(mockConfigDir);
      expect(fs.ensureDir).toHaveBeenCalledWith(path.join(mockConfigDir, 'backups'));
    });

    it('should handle initialization errors', async () => {
      (fs.ensureDir as jest.MockedFunction<typeof fs.ensureDir>).mockRejectedValue(new Error('Permission denied'));

      await expect(storageService.initialize()).rejects.toThrow('Failed to initialize storage');
    });
  });

  describe('service management', () => {
    beforeEach(async () => {
      (fs.ensureDir as jest.MockedFunction<typeof fs.ensureDir>).mockResolvedValue(undefined);
      (fs.pathExists as jest.MockedFunction<typeof fs.pathExists>).mockResolvedValue(false);
      (fs.writeJson as jest.MockedFunction<typeof fs.writeJson>).mockResolvedValue(undefined);
      await storageService.initialize();
    });

    it('should add a service successfully', async () => {
      const serviceData = {
        name: 'Test Service',
        path: '/test/path',
        command: 'npm start',
      };

      (fs.readJson as jest.MockedFunction<typeof fs.readJson>).mockResolvedValue([]);
      (fs.writeJson as jest.MockedFunction<typeof fs.writeJson>).mockResolvedValue(undefined);

      const result = await storageService.addService(serviceData);

      expect(result).toMatchObject({
        ...serviceData,
        id: 'test-uuid-123',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should get services successfully', async () => {
      const mockServices: Service[] = [
        {
          id: '1',
          name: 'Service 1',
          path: '/path/1',
          command: 'npm start',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      (fs.readJson as jest.MockedFunction<typeof fs.readJson>).mockResolvedValue(mockServices);

      const result = await storageService.getServices();

      expect(result).toEqual(mockServices);
    });

    it('should update a service successfully', async () => {
      const existingService: Service = {
        id: '1',
        name: 'Old Name',
        path: '/path/1',
        command: 'npm start',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      (fs.readJson as jest.MockedFunction<typeof fs.readJson>).mockResolvedValue([existingService]);
      (fs.writeJson as jest.MockedFunction<typeof fs.writeJson>).mockResolvedValue(undefined);

      const result = await storageService.updateService('1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(result.updatedAt).not.toBe(existingService.updatedAt);
    });

    it('should throw error when updating non-existent service', async () => {
      (fs.readJson as jest.MockedFunction<typeof fs.readJson>).mockResolvedValue([]);

      await expect(storageService.updateService('non-existent', { name: 'New Name' }))
        .rejects.toThrow('Service not found');
    });
  });

  describe('group management', () => {
    beforeEach(async () => {
      (fs.ensureDir as jest.MockedFunction<typeof fs.ensureDir>).mockResolvedValue(undefined);
      (fs.pathExists as jest.MockedFunction<typeof fs.pathExists>).mockResolvedValue(false);
      (fs.writeJson as jest.MockedFunction<typeof fs.writeJson>).mockResolvedValue(undefined);
      await storageService.initialize();
    });

    it('should add a group successfully', async () => {
      const groupData = {
        name: 'Test Group',
        services: [],
      };

      (fs.readJson as jest.MockedFunction<typeof fs.readJson>).mockResolvedValue([]);
      (fs.writeJson as jest.MockedFunction<typeof fs.writeJson>).mockResolvedValue(undefined);

      const result = await storageService.addGroup(groupData);

      expect(result).toMatchObject({
        ...groupData,
        id: 'test-uuid-123',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should get groups successfully', async () => {
      const mockGroups: Group[] = [
        {
          id: '1',
          name: 'Group 1',
          services: [],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      (fs.readJson as jest.MockedFunction<typeof fs.readJson>).mockResolvedValue(mockGroups);

      const result = await storageService.getGroups();

      expect(result).toEqual(mockGroups);
    });
  });

  describe('settings management', () => {
    beforeEach(async () => {
      (fs.ensureDir as jest.MockedFunction<typeof fs.ensureDir>).mockResolvedValue(undefined);
      (fs.pathExists as jest.MockedFunction<typeof fs.pathExists>).mockResolvedValue(false);
      (fs.writeJson as jest.MockedFunction<typeof fs.writeJson>).mockResolvedValue(undefined);
      await storageService.initialize();
    });

    it('should get settings successfully', async () => {
      const mockSettings: Settings = {
        version: '1.0.0',
        globalAutoStart: false,
        discoveryMarkers: ['package.json'],
      };

      (fs.readJson as jest.MockedFunction<typeof fs.readJson>).mockResolvedValue(mockSettings);

      const result = await storageService.getSettings();

      expect(result).toEqual(mockSettings);
    });

    it('should save settings successfully', async () => {
      const settings: Settings = {
        version: '1.0.0',
        globalAutoStart: true,
        discoveryMarkers: ['package.json', 'Gemfile'],
      };

      (fs.writeJson as jest.MockedFunction<typeof fs.writeJson>).mockResolvedValue(undefined);

      await expect(storageService.saveSettings(settings)).resolves.toBeUndefined();
    });
  });

  describe('validation', () => {
    it('should validate service data correctly', async () => {
      (fs.ensureDir as jest.MockedFunction<typeof fs.ensureDir>).mockResolvedValue(undefined);
      (fs.pathExists as jest.MockedFunction<typeof fs.pathExists>).mockResolvedValue(false);
      (fs.writeJson as jest.MockedFunction<typeof fs.writeJson>).mockResolvedValue(undefined);
      await storageService.initialize();

      const invalidService = {
        name: 'Test',
        // Missing required fields
      };

      (fs.readJson as jest.MockedFunction<typeof fs.readJson>).mockResolvedValue([invalidService]);

      await expect(storageService.getServices()).rejects.toThrow('Service missing required fields');
    });

    it('should validate group data correctly', async () => {
      (fs.ensureDir as jest.MockedFunction<typeof fs.ensureDir>).mockResolvedValue(undefined);
      (fs.pathExists as jest.MockedFunction<typeof fs.pathExists>).mockResolvedValue(false);
      (fs.writeJson as jest.MockedFunction<typeof fs.writeJson>).mockResolvedValue(undefined);
      await storageService.initialize();

      const invalidGroup = {
        name: 'Test',
        // Missing required fields
      };

      (fs.readJson as jest.MockedFunction<typeof fs.readJson>).mockResolvedValue([invalidGroup]);

      await expect(storageService.getGroups()).rejects.toThrow('Group missing required fields');
    });
  });
}); 