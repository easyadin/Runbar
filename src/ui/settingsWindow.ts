import { BrowserWindow, ipcMain } from 'electron';
import type { Settings } from '../shared/types';
import { createServiceLogger } from '../shared/logger';
import { eventBus } from '../shared/events';

const log = createServiceLogger('SettingsWindow');

export interface SettingsWindowOptions {
  width?: number;
  height?: number;
  title?: string;
}

export class SettingsWindow {
  private window: BrowserWindow | null = null;
  private options: SettingsWindowOptions;

  constructor(options: SettingsWindowOptions = {}) {
    this.options = {
      width: 900,
      height: 700,
      title: 'Runbar Settings',
      ...options,
    };
  }

  async create(): Promise<void> {
    try {
      log.info('Creating settings window');

      this.window = new BrowserWindow({
        width: this.options.width || 900,
        height: this.options.height || 700,
        title: this.options.title || 'Runbar Settings',
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
        resizable: true,
        minimizable: true,
        maximizable: true,
        show: false,
      });

      // Load the settings HTML
      this.window.loadURL('data:text/html,' + this.getSettingsHTML());

      // Show window when ready
      this.window.once('ready-to-show', () => {
        this.window?.show();
        log.info('Settings window ready');
      });

      // Handle window close
      this.window.on('closed', () => {
        this.window = null;
        log.info('Settings window closed');
      });

      // Set up IPC handlers
      this.setupIPCHandlers();

    } catch (error) {
      log.error('Failed to create settings window', error as Error);
      throw error;
    }
  }

  private setupIPCHandlers(): void {
    if (!this.window) return;

    // Handle settings save
    ipcMain.handle('settings:save', async (_event, settings: Settings) => {
      try {
        log.info('Saving settings', { settings });
        eventBus.emitConfigChanged('settings', settings);
        return { success: true };
      } catch (error) {
        log.error('Failed to save settings', error as Error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Handle settings load
    ipcMain.handle('settings:load', async () => {
      try {
        log.info('Loading settings');
        // This would typically load from storage
        const defaultSettings: Settings = {
          version: '1.0.0',
          globalAutoStart: false,
          discoveryMarkers: ['package.json', 'Gemfile', 'go.mod'],
          logStorageLimit: 1000,
          statusPollingInterval: 3000,
          autoUpdateEnabled: true,
          theme: 'system',
          notifications: true,
        };
        return { success: true, settings: defaultSettings };
      } catch (error) {
        log.error('Failed to load settings', error as Error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Handle window close
    ipcMain.handle('settings:close', () => {
      this.window?.close();
      return { success: true };
    });
  }

  private getSettingsHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Runbar Settings</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f7;
            color: #1d1d1f;
            line-height: 1.5;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px 0;
            border-bottom: 1px solid #e5e5e7;
        }

        .header h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .header p {
            color: #86868b;
            font-size: 16px;
        }

        .settings-section {
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .section-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #1d1d1f;
        }

        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #f2f2f2;
        }

        .setting-item:last-child {
            border-bottom: none;
        }

        .setting-label {
            font-weight: 500;
            color: #1d1d1f;
        }

        .setting-description {
            font-size: 14px;
            color: #86868b;
            margin-top: 4px;
        }

        .toggle-switch {
            position: relative;
            width: 50px;
            height: 28px;
            background: #e5e5e7;
            border-radius: 14px;
            cursor: pointer;
            transition: background 0.3s;
        }

        .toggle-switch.active {
            background: #007aff;
        }

        .toggle-switch::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 24px;
            height: 24px;
            background: white;
            border-radius: 50%;
            transition: transform 0.3s;
        }

        .toggle-switch.active::after {
            transform: translateX(22px);
        }

        .input-field {
            padding: 8px 12px;
            border: 1px solid #e5e5e7;
            border-radius: 6px;
            font-size: 14px;
            width: 200px;
        }

        .input-field:focus {
            outline: none;
            border-color: #007aff;
            box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
        }

        .select-field {
            padding: 8px 12px;
            border: 1px solid #e5e5e7;
            border-radius: 6px;
            font-size: 14px;
            width: 200px;
            background: white;
        }

        .button {
            background: #007aff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.3s;
        }

        .button:hover {
            background: #0056cc;
        }

        .button.secondary {
            background: #e5e5e7;
            color: #1d1d1f;
        }

        .button.secondary:hover {
            background: #d1d1d6;
        }

        .button-group {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 24px;
        }

        .status-message {
            padding: 12px;
            border-radius: 6px;
            margin: 16px 0;
            display: none;
        }

        .status-message.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .status-message.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Runbar Settings</h1>
            <p>Configure your development environment preferences</p>
        </div>

        <div id="status-message" class="status-message"></div>

        <div class="settings-section">
            <h2 class="section-title">General</h2>
            
            <div class="setting-item">
                <div>
                    <div class="setting-label">Global Auto-Start</div>
                    <div class="setting-description">Automatically start services when Runbar launches</div>
                </div>
                <div class="toggle-switch" id="globalAutoStart" onclick="toggleSetting(this, 'globalAutoStart')"></div>
            </div>

            <div class="setting-item">
                <div>
                    <div class="setting-label">Auto Backup</div>
                    <div class="setting-description">Automatically backup configuration files</div>
                </div>
                <div class="toggle-switch" id="autoBackup" onclick="toggleSetting(this, 'autoBackup')"></div>
            </div>

            <div class="setting-item">
                <div>
                    <div class="setting-label">Backup Interval (hours)</div>
                    <div class="setting-description">How often to create backup files</div>
                </div>
                <input type="number" class="input-field" id="backupInterval" min="1" max="168" value="24">
            </div>
        </div>

        <div class="settings-section">
            <h2 class="section-title">Discovery</h2>
            
            <div class="setting-item">
                <div>
                    <div class="setting-label">Discovery Markers</div>
                    <div class="setting-description">Files that indicate a project directory</div>
                </div>
                <input type="text" class="input-field" id="discoveryMarkers" value="package.json,Gemfile,go.mod">
            </div>

            <div class="setting-item">
                <div>
                    <div class="setting-label">Max Log Lines</div>
                    <div class="setting-description">Maximum number of log lines to store per service</div>
                </div>
                <input type="number" class="input-field" id="maxLogLines" min="100" max="10000" value="1000">
            </div>
        </div>

        <div class="settings-section">
            <h2 class="section-title">Appearance</h2>
            
            <div class="setting-item">
                <div>
                    <div class="setting-label">Theme</div>
                    <div class="setting-description">Choose your preferred theme</div>
                </div>
                <select class="select-field" id="theme">
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </div>

            <div class="setting-item">
                <div>
                    <div class="setting-label">Language</div>
                    <div class="setting-description">Choose your preferred language</div>
                </div>
                <select class="select-field" id="language">
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                </select>
            </div>
        </div>

        <div class="button-group">
            <button class="button secondary" onclick="resetSettings()">Reset to Defaults</button>
            <button class="button" onclick="saveSettings()">Save Settings</button>
        </div>
    </div>

    <script>
        let currentSettings = {};

        // Load settings when page loads
        window.addEventListener('DOMContentLoaded', async () => {
            await loadSettings();
        });

        async function loadSettings() {
            try {
                const result = await window.electronAPI.invoke('settings:load');
                if (result.success) {
                    currentSettings = result.settings;
                    updateUI();
                } else {
                    showStatus('Failed to load settings: ' + result.error, 'error');
                }
            } catch (error) {
                showStatus('Failed to load settings', 'error');
            }
        }

        async function saveSettings() {
            try {
                const settings = collectSettings();
                const result = await window.electronAPI.invoke('settings:save', settings);
                if (result.success) {
                    showStatus('Settings saved successfully!', 'success');
                    currentSettings = settings;
                } else {
                    showStatus('Failed to save settings: ' + result.error, 'error');
                }
            } catch (error) {
                showStatus('Failed to save settings', 'error');
            }
        }

        function collectSettings() {
            return {
                version: currentSettings.version || '1.0.0',
                globalAutoStart: document.getElementById('globalAutoStart').classList.contains('active'),
                autoBackup: document.getElementById('autoBackup').classList.contains('active'),
                backupInterval: parseInt(document.getElementById('backupInterval').value),
                discoveryMarkers: document.getElementById('discoveryMarkers').value.split(',').map(s => s.trim()),
                maxLogLines: parseInt(document.getElementById('maxLogLines').value),
                theme: document.getElementById('theme').value,
                language: document.getElementById('language').value,
            };
        }

        function updateUI() {
            // Update toggles
            document.getElementById('globalAutoStart').classList.toggle('active', currentSettings.globalAutoStart);
            document.getElementById('autoBackup').classList.toggle('active', currentSettings.autoBackup);
            
            // Update inputs
            document.getElementById('backupInterval').value = currentSettings.backupInterval || 24;
            document.getElementById('discoveryMarkers').value = (currentSettings.discoveryMarkers || ['package.json']).join(', ');
            document.getElementById('maxLogLines').value = currentSettings.maxLogLines || 1000;
            document.getElementById('theme').value = currentSettings.theme || 'system';
            document.getElementById('language').value = currentSettings.language || 'en';
        }

        function toggleSetting(element, settingName) {
            element.classList.toggle('active');
        }

        function resetSettings() {
            if (confirm('Are you sure you want to reset all settings to defaults?')) {
                currentSettings = {
                    version: '1.0.0',
                    globalAutoStart: false,
                    autoBackup: true,
                    backupInterval: 24,
                    discoveryMarkers: ['package.json', 'Gemfile', 'go.mod'],
                    maxLogLines: 1000,
                    theme: 'system',
                    language: 'en',
                };
                updateUI();
                showStatus('Settings reset to defaults', 'success');
            }
        }

        function showStatus(message, type) {
            const statusElement = document.getElementById('status-message');
            statusElement.textContent = message;
            statusElement.className = \`status-message \${type}\`;
            statusElement.style.display = 'block';
            
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }

        // Mock electron API for testing
        if (typeof window.electronAPI === 'undefined') {
            window.electronAPI = {
                invoke: async (channel, data) => {
                    console.log('Mock IPC call:', channel, data);
                    return { success: true };
                }
            };
        }
    </script>
</body>
</html>
    `;
  }

  show(): void {
    if (this.window) {
      this.window.show();
    }
  }

  hide(): void {
    if (this.window) {
      this.window.hide();
    }
  }

  close(): void {
    if (this.window) {
      this.window.close();
    }
  }

  isVisible(): boolean {
    return this.window ? !this.window.isDestroyed() && this.window.isVisible() : false;
  }
} 