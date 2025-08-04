// Global test setup
import { jest } from '@jest/globals';

// Mock Electron
jest.mock('electron', () => ({
  app: {
    setName: jest.fn(),
    setAppUserModelId: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
    dock: {
      setIcon: jest.fn(),
    },
  },
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip: jest.fn(),
    on: jest.fn(),
    popUpContextMenu: jest.fn(),
  })),
  Menu: {
    buildFromTemplate: jest.fn(() => []),
    setApplicationMenu: jest.fn(),
  },
  nativeImage: {
    createFromPath: jest.fn(() => ({
      resize: jest.fn(() => ({
        getSize: jest.fn(() => ({ width: 16, height: 16 })),
      })),
      getSize: jest.fn(() => ({ width: 32, height: 32 })),
    })),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
  })),
  dialog: {
    showOpenDialog: jest.fn(),
  },
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
  },
  ipcRenderer: {
    send: jest.fn(),
    on: jest.fn(),
  },
}));

// Mock fs-extra
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  ensureDir: jest.fn(),
  readJson: jest.fn(),
  writeJson: jest.fn(),
  copy: jest.fn(),
}));

// Mock detect-port
jest.mock('detect-port', () => jest.fn());

// Global test timeout
jest.setTimeout(10000);

// Suppress console logs during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
}); 