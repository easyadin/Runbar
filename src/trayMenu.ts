import { Tray } from 'electron';
import { ProcessManager } from './processManager';
import { Storage } from './storage';
import { MenuManager } from './menuManager';

export class TrayMenu {
  private tray: Tray;
  private menuManager: MenuManager;

  constructor(tray: Tray, _processManager: ProcessManager, _storage: Storage, menuManager: MenuManager) {
    this.tray = tray;
    this.menuManager = menuManager;
    console.log('[TrayMenu] Constructor called');
    this.updateMenu();
  }

  async updateMenu(): Promise<void> {
    console.log('[TrayMenu] updateMenu called');
    try {
      const menu = await this.menuManager.createMainMenu();
      this.tray.setContextMenu(menu);
      console.log('[TrayMenu] Menu set on tray');
    } catch (menuError) {
      console.error('[TrayMenu] Failed to set tray menu:', menuError);
      // Fallback menu
      const { Menu, app } = require('electron');
      const fallbackMenu = Menu.buildFromTemplate([
        { label: 'Runbar (Error)', enabled: false },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ]);
      this.tray.setContextMenu(fallbackMenu);
    }
  }
}

// Export the promptInput function needed by MenuManager
export async function promptInput(message: string): Promise<string | null> {
  const { BrowserWindow, ipcMain } = require('electron');
  
  return new Promise((resolve) => {
    const inputWin = new BrowserWindow({
      width: 400,
      height: 200,
      modal: true,
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    
    const html = `
      <html>
        <body style="font-family: sans-serif; padding: 20px; background: #f5f5f5;">
          <h3>${message}</h3>
          <input id="input" type="text" style="width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px;" placeholder="Enter value...">
          <div style="text-align: right; margin-top: 20px;">
            <button onclick="cancel()" style="margin-right: 10px; padding: 8px 16px; border: 1px solid #ccc; background: #fff; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button onclick="submit()" style="padding: 8px 16px; border: none; background: #007cba; color: white; border-radius: 4px; cursor: pointer;">OK</button>
          </div>
          <script>
            const { ipcRenderer } = require('electron');
            document.getElementById('input').focus();
            document.getElementById('input').onkeyup = function(e) {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') cancel();
            };
            function submit() {
              const value = document.getElementById('input').value;
              ipcRenderer.send('input-result', value);
            }
            function cancel() {
              ipcRenderer.send('input-result', null);
            }
          </script>
        </body>
      </html>
    `;
    
    inputWin.loadURL('data:text/html,' + encodeURIComponent(html));
    inputWin.once('ready-to-show', () => inputWin.show());
    
    ipcMain.once('input-result', (_: any, value: string | null) => {
      inputWin.close();
      resolve(value);
    });
  });
} 