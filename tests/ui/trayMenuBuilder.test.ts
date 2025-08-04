import { jest } from '@jest/globals';
import { Menu } from 'electron';
import { TrayMenuBuilder } from '../../src/ui/trayMenuBuilder';
import type { Service, Group } from '../../src/shared/types';

// Mock Electron Menu
jest.mock('electron', () => ({
  Menu: {
    buildFromTemplate: jest.fn(() => ({})),
  },
}));

describe('TrayMenuBuilder', () => {
  let menuBuilder: TrayMenuBuilder;
  let mockOptions: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOptions = {
      onServiceToggle: jest.fn(),
      onGroupToggle: jest.fn(),
      onAddFolder: jest.fn(),
      onAddService: jest.fn(),
      onOpenSettings: jest.fn(),
      onQuit: jest.fn(),
    };
    
    menuBuilder = new TrayMenuBuilder(mockOptions);
  });

  describe('buildMenu', () => {
    it('should build menu with services and groups', () => {
      const services: Service[] = [
        {
          id: '1',
          name: 'Test Service',
          path: '/test/path',
          command: 'npm start',
          status: 'running',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      const groups: Group[] = [
        {
          id: '1',
          name: 'Test Group',
          services: ['1'],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      menuBuilder.buildMenu(services, groups);

      expect(Menu.buildFromTemplate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: expect.stringContaining('Test Service'),
          }),
          expect.objectContaining({
            label: expect.stringContaining('Test Group'),
          }),
        ])
      );
    });

    it('should handle empty services and groups', () => {
      const services: Service[] = [];
      const groups: Group[] = [];

      menuBuilder.buildMenu(services, groups);

      expect(Menu.buildFromTemplate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'No services configured',
            enabled: false,
          }),
          expect.objectContaining({
            label: 'No groups configured',
            enabled: false,
          }),
        ])
      );
    });

    it('should include action menu items', () => {
      const services: Service[] = [];
      const groups: Group[] = [];

      menuBuilder.buildMenu(services, groups);

      const mockCalls = (Menu.buildFromTemplate as jest.Mock).mock.calls;
      expect(mockCalls.length).toBeGreaterThan(0);
      expect(mockCalls[0]).toBeDefined();
      
      const template = mockCalls[0]![0] as any[];
      const actionLabels = template
        .filter((item: any) => item.label && typeof item.label === 'string')
        .map((item: any) => item.label);

      expect(actionLabels).toContain('Add Folder to Scan');
      expect(actionLabels).toContain('Add Service Manually');
      expect(actionLabels).toContain('Settings');
      expect(actionLabels).toContain('Quit Runbar');
    });
  });

  describe('service status icons', () => {
    it('should return correct icons for different service statuses', () => {
      const services: Service[] = [
        {
          id: '1',
          name: 'Running Service',
          path: '/test/path',
          command: 'npm start',
          status: 'running',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Stopped Service',
          path: '/test/path',
          command: 'npm start',
          status: 'stopped',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          id: '3',
          name: 'Error Service',
          path: '/test/path',
          command: 'npm start',
          status: 'error',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      const groups: Group[] = [];

      menuBuilder.buildMenu(services, groups);

      const mockCalls = (Menu.buildFromTemplate as jest.Mock).mock.calls;
      expect(mockCalls.length).toBeGreaterThan(0);
      expect(mockCalls[0]).toBeDefined();
      
      const template = mockCalls[0]![0] as any[];
      const serviceItems = template.filter((item: any) => item.label && item.label.includes('Service'));

      expect(serviceItems[0].label).toContain('🟢'); // running
      expect(serviceItems[1].label).toContain('⚪'); // stopped
      expect(serviceItems[2].label).toContain('🔴'); // error
    });
  });

  describe('group status icons', () => {
    it('should return correct icons for group statuses', () => {
      const services: Service[] = [
        {
          id: '1',
          name: 'Service 1',
          path: '/test/path',
          command: 'npm start',
          status: 'running',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Service 2',
          path: '/test/path',
          command: 'npm start',
          status: 'stopped',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      const groups: Group[] = [
        {
          id: '1',
          name: 'Mixed Group',
          services: ['1', '2'],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      menuBuilder.buildMenu(services, groups);

      const mockCalls = (Menu.buildFromTemplate as jest.Mock).mock.calls;
      expect(mockCalls.length).toBeGreaterThan(0);
      expect(mockCalls[0]).toBeDefined();
      
      const template = mockCalls[0]![0] as any[];
      const groupItems = template.filter((item: any) => item.label && item.label.includes('Mixed Group'));

      expect(groupItems[0].label).toContain('🟡'); // mixed status
    });
  });
}); 