import { SettingsWindow } from '../../src/ui/settingsWindow';
import { eventBus } from '../../src/shared/events';

// Mock Electron
const mockBrowserWindow = {
  loadURL: jest.fn(),
  once: jest.fn(),
  on: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  close: jest.fn(),
  focus: jest.fn(),
  isDestroyed: jest.fn().mockReturnValue(false),
  isVisible: jest.fn().mockReturnValue(true),
};

jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => mockBrowserWindow),
  ipcMain: {
    handle: jest.fn(),
  },
}));

describe('SettingsWindow', () => {
  let settingsWindow: SettingsWindow;

  beforeEach(() => {
    jest.clearAllMocks();
    settingsWindow = new SettingsWindow();
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      expect(settingsWindow).toBeInstanceOf(SettingsWindow);
    });

    it('should create with custom options', () => {
      const customWindow = new SettingsWindow({
        width: 1000,
        height: 800,
        title: 'Custom Settings',
      });
      expect(customWindow).toBeInstanceOf(SettingsWindow);
    });
  });

  describe('create', () => {
    it('should create browser window with correct options', async () => {
      const { BrowserWindow } = require('electron');
      
      await settingsWindow.create();

      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 900,
        height: 700,
        title: 'Runbar Settings',
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
        resizable: true,
        minimizable: true,
        maximizable: true,
        show: false,
      });
    });

    it('should load settings HTML', async () => {
      await settingsWindow.create();

      expect(mockBrowserWindow.loadURL).toHaveBeenCalledWith(
        expect.stringContaining('data:text/html,')
      );
    });

    it('should set up event handlers', async () => {
      await settingsWindow.create();

      expect(mockBrowserWindow.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('closed', expect.any(Function));
    });
  });

  describe('window management', () => {
    beforeEach(async () => {
      await settingsWindow.create();
    });

    it('should show window', () => {
      settingsWindow.show();
      expect(mockBrowserWindow.show).toHaveBeenCalled();
    });

    it('should hide window', () => {
      settingsWindow.hide();
      expect(mockBrowserWindow.hide).toHaveBeenCalled();
    });

    it('should close window', () => {
      settingsWindow.close();
      expect(mockBrowserWindow.close).toHaveBeenCalled();
    });

    it('should check if window is visible', () => {
      const isVisible = settingsWindow.isVisible();
      expect(mockBrowserWindow.isVisible).toHaveBeenCalled();
      expect(isVisible).toBe(true);
    });
  });

  describe('HTML content', () => {
    it('should generate valid HTML', async () => {
      await settingsWindow.create();
      
      const { BrowserWindow } = require('electron');
      const callArgs = (BrowserWindow as jest.Mock).mock.calls[0][0];
      
      expect(callArgs).toBeDefined();
      expect(callArgs.width).toBe(900);
      expect(callArgs.height).toBe(700);
    });
  });

  describe('IPC handlers', () => {
    it('should set up IPC handlers when window is created', async () => {
      const { ipcMain } = require('electron');
      
      await settingsWindow.create();

      expect(ipcMain.handle).toHaveBeenCalledWith('settings:save', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('settings:load', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('settings:close', expect.any(Function));
    });
  });

  describe('event bus integration', () => {
    it('should emit config changed event when settings are saved', async () => {
      const emitSpy = jest.spyOn(eventBus, 'emitConfigChanged');
      
      await settingsWindow.create();
      
      const { ipcMain } = require('electron');
      const saveHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === 'settings:save'
      )[1];

      const testSettings = {
        version: '1.0.0',
        globalAutoStart: true,
        discoveryMarkers: ['package.json'],
        theme: 'dark' as const,
        notifications: true,
      };

      await saveHandler(null, testSettings);

      expect(emitSpy).toHaveBeenCalledWith('settings', testSettings);
    });
  });
}); 