import { Tray, Menu, app } from 'electron';
import { ProcessManager } from './processManager';
import { Storage } from './storage';

export class TrayMenu {
  private tray: Tray;
  private processManager: ProcessManager;
  private storage: Storage;

  constructor(tray: Tray, processManager: ProcessManager, storage: Storage) {
    this.tray = tray;
    this.processManager = processManager;
    this.storage = storage;
    console.log('[TrayMenu] Constructor called');
    
    // Listen for status changes and update menu
    this.processManager.onStatusChange((servicePath: string, status: string) => {
      console.log(`[TrayMenu] Status changed for ${servicePath}: ${status}`);
      this.updateMenu();
    });
    
    this.updateMenu();
  }

  async updateMenu(): Promise<void> {
    console.log('[TrayMenu] updateMenu called');
    let groupItems: any[] = [];
    try {
      const groups = await this.storage.getGroups();
      const allServices = await this.storage.getServices();
      groupItems = groups.map((group) => {
        const groupServices = allServices.filter(s => group.services.includes(s.name));
        return {
          label: `Group: ${group.name}`,
          submenu: [
            {
              label: 'Add Service to Group',
              click: async () => {
                const { dialog } = require('electron');
                const fs = require('fs');
                const path = require('path');
                const pathResult = await dialog.showOpenDialog({
                  properties: ['openDirectory'],
                  title: 'Select service/project folder'
                });
                if (pathResult.canceled || pathResult.filePaths.length === 0) return;
                const folderPath = pathResult.filePaths[0];
                let detectedName = path.basename(folderPath);
                let scripts: string[] = [];
                let defaultCommand = '';
                const pkgPath = path.join(folderPath, 'package.json');
                if (fs.existsSync(pkgPath)) {
                  try {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                    if (pkg.name) detectedName = pkg.name;
                    if (pkg.scripts) {
                      scripts = Object.keys(pkg.scripts);
                      if (scripts.includes('dev')) defaultCommand = 'npm run dev';
                      else if (scripts.includes('start')) defaultCommand = 'npm start';
                      else defaultCommand = scripts.length > 0 ? `npm run ${scripts[0]}` : '';
                    }
                  } catch (e) { /* ignore */ }
                }
                const { BrowserWindow, ipcMain } = require('electron');
                const editWin = new BrowserWindow({
                  width: 400,
                  height: 350,
                  modal: false,
                  show: false,
                  alwaysOnTop: true,
                  focusable: true,
                  webPreferences: { nodeIntegration: true, contextIsolation: false }
                });
                const scriptOptions = scripts.length > 0 ? `<label>Scripts:<br><select id='script'>${scripts.map(s => `<option value='${s}'>${s}</option>`)}</select></label><br><br>` : '';
                const html = `
                  <html><body style='font-family:sans-serif;background:#222;color:#eee;'>
                  <h2>Add Service to Group</h2>
                  <form id='f'>
                    <label>Name:<br><input id='name' value='${detectedName.replace(/'/g, '&#39;')}' style='width:95%'></label><br><br>
                    ${scriptOptions}
                    <label>Command:<br><input id='cmd' value='${defaultCommand.replace(/'/g, '&#39;')}' style='width:95%'></label><br><br>
                    <button type='submit'>Save</button>
                  </form>
                  <script>
                    const { ipcRenderer } = require('electron');
                    const scriptSel = document.getElementById('script');
                    if (scriptSel) {
                      scriptSel.value = '';
                      scriptSel.onchange = () => {
                        document.getElementById('cmd').value = 'npm run ' + scriptSel.value;
                      };
                    }
                    document.getElementById('f').onsubmit = (e) => {
                      e.preventDefault();
                      ipcRenderer.send('edit-service', {
                        name: document.getElementById('name').value,
                        command: document.getElementById('cmd').value
                      });
                    };
                    ipcRenderer.on('close', () => window.close());
                  </script>
                  </body></html>
                `;
                editWin.loadURL('data:text/html,' + encodeURIComponent(html));
                editWin.once('ready-to-show', () => {
                  editWin.show();
                  editWin.focus();
                });
                ipcMain.once('edit-service', async (_: any, data: { name: string, command: string }) => {
                  const service = {
                    name: data.name,
                    path: folderPath,
                    command: data.command,
                    autoStart: false
                  };
                  await this.storage.addService(service);
                  const groups = await this.storage.getGroups();
                  const g = groups.find(g => g.name === group.name);
                  if (g) {
                    g.services = Array.from(new Set([...g.services, data.name]));
                    await this.storage.saveGroups(groups);
                  }
                  await this.updateMenu();
                  if (!editWin.isDestroyed()) {
                    editWin.webContents.send('close');
                    editWin.close();
                  }
                });
              },
            },
            {
              label: 'Start All',
              click: async () => {
                // Sequentially start each service, awaiting user action for port conflicts
                for (const svc of groupServices) {
                  await this.processManager.startService(svc);
                }
                // After all services are handled, open the group logs window
                const { BrowserWindow, ipcMain } = require('electron');
                let logHtml = `<html><body style='background:#181A1B;margin:0;padding:0;overflow:hidden;'><div style='font-family:monospace;background:#23272E;color:#D1D5DB;margin:0;padding:0;height:100vh;overflow:hidden;'><h2 style='margin:0 0 10px 0;padding:18px 18px 0 18px;font-size:1.3em;font-weight:600;letter-spacing:1px;'>Logs for Group: ${group.name}</h2>`;
                logHtml += `<div style='display:flex;flex-direction:row;height:calc(100vh - 56px);'>`;
                // Tabs (vertical, right)
                logHtml += `<div id='tabs' style='display:flex;flex-direction:column;align-items:stretch;min-width:180px;background:#23272E;padding:18px 0 18px 0;height:100%;'>`;
                groupServices.forEach((service, i) => {
                  logHtml += `<button onclick='showTab(${i})' id='tabbtn${i}' style='margin:0 0 8px 0;background:#23272E;color:#D1D5DB;border:none;padding:12px 10px;cursor:pointer;font-size:1em;text-align:left;height:auto;'>${service.name}</button>`;
                });
                logHtml += `</div>`;
                // Log areas (left)
                logHtml += `<div style='flex:1;background:#181A1B;padding:0 0 0 0;height:100%;min-height:0;'>`;
                groupServices.forEach((service, i) => {
                  const logs = this.processManager.getServiceLogs(service.path);
                  logHtml += `<div id='tab${i}' style='display:${i === 0 ? 'block' : 'none'};height:100%;'>`;
                  logHtml += `<pre id='logpre${i}' style='white-space:pre-wrap;word-break:break-all;background:#181A1B;padding:18px 18px 64px 18px;height:100%;overflow:auto;font-size:1.1em;line-height:1.5;margin:0;box-sizing:border-box;'>${(logs && logs.length > 0 ? logs.join('\n') : 'No logs available.').replace(/</g, '&lt;')}</pre>`;
                  logHtml += `</div>`;
                });
                logHtml += `</div></div>`;
                logHtml += `<script>
                  const { ipcRenderer } = require('electron');
                  function showTab(idx) {
                    var n = ${groupServices.length};
                    for (var i = 0; i < n; i++) {
                      document.getElementById('tab'+i).style.display = (i === idx ? 'block' : 'none');
                      document.getElementById('tabbtn'+i).style.background = (i === idx ? '#181A1B' : '#23272E');
                    }
                  }
                  showTab(0);
                  ipcRenderer.on('log-update', (event, data) => {
                    const idx = ${JSON.stringify(groupServices.map(s => s.path))}.indexOf(data.path);
                    if (idx !== -1) {
                      const pre = document.getElementById('logpre'+idx);
                      if (pre) {
                        pre.textContent += data.line;
                        pre.scrollTop = pre.scrollHeight;
                      }
                    }
                  });
                </script></div></body></html>`;
                const logWin = new BrowserWindow({
                  width: 900,
                  height: 650,
                  title: `Logs for Group: ${group.name}`,
                  focusable: true,
                  webPreferences: { nodeIntegration: true, contextIsolation: false }
                });
                logWin.loadURL('data:text/html,' + encodeURIComponent(logHtml));
                logWin.on('closed', () => {
                  ipcMain.removeAllListeners('log-update');
                });
                await this.updateMenu();
              }
            },
            {
              label: 'Stop All',
              click: async () => {
                for (const svc of groupServices) {
                  await this.processManager.stopService(svc);
                }
                await this.updateMenu();
              }
            },
            {
              label: 'Restart All',
              click: async () => {
                for (const svc of groupServices) {
                  await this.processManager.stopService(svc);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                for (const svc of groupServices) {
                  await this.processManager.startService(svc);
                }
                await this.updateMenu();
              }
            },
            {
              label: 'View Group Logs',
              click: async () => {
                const { BrowserWindow, ipcMain } = require('electron');
                let logHtml = `<html><body style='background:#181A1B;margin:0;padding:0;overflow:hidden;'><div style='font-family:monospace;background:#23272E;color:#D1D5DB;margin:0;padding:0;height:100vh;overflow:hidden;'><h2 style='margin:0 0 10px 0;padding:18px 18px 0 18px;font-size:1.3em;font-weight:600;letter-spacing:1px;'>Logs for Group: ${group.name}</h2>`;
                logHtml += `<div style='display:flex;flex-direction:row;height:calc(100vh - 56px);'>`;
                // Tabs (vertical, right)
                logHtml += `<div id='tabs' style='display:flex;flex-direction:column;align-items:stretch;min-width:180px;background:#23272E;padding:18px 0 18px 0;height:100%;'>`;
                groupServices.forEach((service, i) => {
                  logHtml += `<button onclick='showTab(${i})' id='tabbtn${i}' style='margin:0 0 8px 0;background:#23272E;color:#D1D5DB;border:none;padding:12px 10px;cursor:pointer;font-size:1em;text-align:left;height:auto;'>${service.name}</button>`;
                });
                logHtml += `</div>`;
                // Log areas (left)
                logHtml += `<div style='flex:1;background:#181A1B;padding:0 0 0 0;height:100%;min-height:0;'>`;
                groupServices.forEach((service, i) => {
                  const logs = this.processManager.getServiceLogs(service.path);
                  logHtml += `<div id='tab${i}' style='display:${i === 0 ? 'block' : 'none'};height:100%;'>`;
                  logHtml += `<pre id='logpre${i}' style='white-space:pre-wrap;word-break:break-all;background:#181A1B;padding:18px 18px 64px 18px;height:100%;overflow:auto;font-size:1.1em;line-height:1.5;margin:0;box-sizing:border-box;'>${(logs && logs.length > 0 ? logs.join('\n') : 'No logs available.').replace(/</g, '&lt;')}</pre>`;
                  logHtml += `</div>`;
                });
                logHtml += `</div></div>`;
                logHtml += `<script>
                  const { ipcRenderer } = require('electron');
                  function showTab(idx) {
                    var n = ${groupServices.length};
                    for (var i = 0; i < n; i++) {
                      document.getElementById('tab'+i).style.display = (i === idx ? 'block' : 'none');
                      document.getElementById('tabbtn'+i).style.background = (i === idx ? '#181A1B' : '#23272E');
                    }
                  }
                  showTab(0);
                  ipcRenderer.on('log-update', (event, data) => {
                    const idx = ${JSON.stringify(groupServices.map(s => s.path))}.indexOf(data.path);
                    if (idx !== -1) {
                      const pre = document.getElementById('logpre'+idx);
                      if (pre) {
                        pre.textContent += data.line;
                        pre.scrollTop = pre.scrollHeight;
                      }
                    }
                  });
                </script></div></body></html>`;
                const logWin = new BrowserWindow({
                  width: 900,
                  height: 650,
                  title: `Logs for Group: ${group.name}`,
                  focusable: true,
                  webPreferences: { nodeIntegration: true, contextIsolation: false }
                });
                logWin.loadURL('data:text/html,' + encodeURIComponent(logHtml));
                logWin.on('closed', () => {
                  ipcMain.removeAllListeners('log-update');
                });
              }
            },
            {
              label: 'Delete Group',
                            click: async () => {
                const { dialog, BrowserWindow } = require('electron');
                const result = await dialog.showMessageBox(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], {
                        type: 'warning',
                        buttons: ['Cancel', 'Delete'],
                        defaultId: 0,
                        cancelId: 0,
                        title: 'Delete Group',
                        message: `Are you sure you want to delete the group '${group.name}'? This will remove the group but keep the services.`
                      });
                if (result.response === 1) {
                  await this.storage.removeGroup(group.name);
                  await this.updateMenu();
                }
              }
            },
            { type: 'separator' },
            ...groupServices.map(service => {
              const status = this.processManager.getServiceStatus(service.path);
              return {
                label: `${service.name} [${status}]`,
                submenu: [
                  {
                    label: status === 'running' ? 'Stop' : 'Start',
                    click: async () => {
                      if (status === 'running') {
                        await this.processManager.stopService(service);
                        service.status = 'stopped';
                      } else {
                        await this.processManager.startService(service);
                        service.status = 'running';
                      }
                      await this.storage.addService(service);
                      await this.updateMenu();
                    }
                  },
                  {
                    label: 'Restart',
                    click: async () => {
                      await this.processManager.stopService(service);
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      await this.processManager.startService(service);
                      service.status = 'running';
                      await this.storage.addService(service);
                      await this.updateMenu();
                    }
                  },
                  {
                    label: 'View Logs',
                    click: async () => {
                      const logs = this.processManager.getServiceLogs(service.path);
                      const { BrowserWindow } = require('electron');
                      const logWin = new BrowserWindow({
                        width: 700,
                        height: 500,
                        title: `Logs for ${service.name}`,
                        focusable: true,
                        webPreferences: { nodeIntegration: true, contextIsolation: false }
                      });
                      const logHtml = `
                        <html><body style='font-family:monospace;background:#222;color:#eee;margin:0;padding:0;'>
                        <h2 style='margin:10px;'>Logs for ${service.name}</h2>
                        <pre style='white-space:pre-wrap;word-break:break-all;background:#111;padding:10px;height:80vh;overflow:auto;border-radius:6px;'>${(logs && logs.length > 0 ? logs.join('\n') : 'No logs available.').replace(/</g, '&lt;')}</pre>
                        </body></html>
                      `;
                      logWin.loadURL('data:text/html,' + encodeURIComponent(logHtml));
                    }
                  },
                  {
                    label: 'Edit Service',
                    click: async () => {
                      const { BrowserWindow, ipcMain } = require('electron');
                      let scripts: string[] = [];
                      let isNode = service.projectType === 'nodejs';
                      if (isNode && service.path) {
                        try {
                          const fs = require('fs');
                          const path = require('path');
                          const pkgPath = path.join(service.path, 'package.json');
                          if (fs.existsSync(pkgPath)) {
                            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                            if (pkg.scripts) {
                              scripts = Object.keys(pkg.scripts);
                            }
                          }
                        } catch (e) { /* ignore */ }
                      }
                      const editWin = new BrowserWindow({
                        width: 400,
                        height: 350,
                        modal: false,
                        show: false,
                        alwaysOnTop: true,
                        focusable: true,
                        webPreferences: { nodeIntegration: true, contextIsolation: false }
                      });
                      const scriptOptions = scripts.length > 0 ? `<label>Scripts:<br><select id='script'>${scripts.map(s => `<option value='${s}'>${s}</option>`)}</select></label><br><br>` : '';
                      const html = `
                        <html><body style='font-family:sans-serif;background:#222;color:#eee;'>
                        <h2>Edit Service</h2>
                        <form id='f'>
                          <label>Name:<br><input id='name' value='${service.name.replace(/'/g, '&#39;')}' style='width:95%'></label><br><br>
                          ${scriptOptions}
                          <label>Command:<br><input id='cmd' value='${service.command.replace(/'/g, '&#39;')}' style='width:95%'></label><br><br>
                          <button type='submit'>Save</button>
                        </form>
                        <script>
                          const { ipcRenderer } = require('electron');
                          const scriptSel = document.getElementById('script');
                          if (scriptSel) {
                            scriptSel.value = '';
                            scriptSel.onchange = () => {
                              document.getElementById('cmd').value = 'npm run ' + scriptSel.value;
                            };
                          }
                          document.getElementById('f').onsubmit = (e) => {
                            e.preventDefault();
                            ipcRenderer.send('edit-service', {
                              name: document.getElementById('name').value,
                              command: document.getElementById('cmd').value
                            });
                          };
                          ipcRenderer.on('close', () => window.close());
                        </script>
                        </body></html>
                      `;
                      editWin.loadURL('data:text/html,' + encodeURIComponent(html));
                      editWin.once('ready-to-show', () => {
                        editWin.show();
                        editWin.focus();
                      });
                      ipcMain.once('edit-service', async (_: any, data: { name: string, command: string }) => {
                        service.name = data.name;
                        service.command = data.command;
                        await this.storage.addService(service);
                        await this.updateMenu();
                        if (!editWin.isDestroyed()) {
                          editWin.webContents.send('close');
                          editWin.close();
                        }
                      });
                    }
                  },
                  {
                    label: 'Remove Service',
                    click: async () => {
                      const { dialog, BrowserWindow } = require('electron');
                      const result = await dialog.showMessageBox(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], {
                        type: 'warning',
                        buttons: ['Cancel', 'Remove'],
                        defaultId: 0,
                        cancelId: 0,
                        title: 'Remove Service',
                        message: `Are you sure you want to remove the service '${service.name}'? This cannot be undone.`
                      });
                      if (result.response === 1) {
                        await this.storage.removeService(service.path);
                        const groups = await this.storage.getGroups();
                        for (const g of groups) {
                          g.services = g.services.filter(n => n !== service.name);
                        }
                        const nonEmptyGroups = groups.filter(g => g.services.length > 0);
                        await this.storage.saveGroups(nonEmptyGroups);
                        await this.updateMenu();
                      }
                    }
                  }
                ]
              };
            })
          ]
        };
      });
    } catch (e) {
      groupItems = [{ label: 'Error loading groups', enabled: false }];
    }

    try {
      const menu = Menu.buildFromTemplate([
        { label: 'Runbar', enabled: false },
        { type: 'separator' },
        ...groupItems,
        { type: 'separator' },
        {
          label: 'Edit Raw Config', click: () => {
            const { shell } = require('electron');
            const os = require('os');
            const path = require('path');
            const configDir = path.join(os.homedir(), '.runbar');
            shell.openPath(configDir);
          }
        },
        { label: 'Refresh', click: () => this.updateMenu() },
        {
          label: 'Clear All Services', click: async () => {
            const { dialog, BrowserWindow } = require('electron');
            const result = await dialog.showMessageBox(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], {
              type: 'warning',
              buttons: ['Cancel', 'Clear All'],
              defaultId: 0,
              cancelId: 0,
              title: 'Clear All Services',
              message: 'Are you sure you want to remove all services? This cannot be undone.'
            });
            if (result.response === 1) {
              await this.storage.clearServices();
              await this.updateMenu();
            }
          }
        },
        { label: 'Add Folder to Scan...', click: () => this.addFolder() },
        { label: 'Add Service Manually...', click: () => this.addService() },
        { type: 'separator' },
        { label: 'Settings', click: () => this.openSettings() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ]);
      this.tray.setContextMenu(menu);
      console.log('[TrayMenu] Menu set on tray');
    } catch (menuError) {
      console.error('[TrayMenu] Failed to set tray menu:', menuError);
      // Fallback menu
      const fallbackMenu = Menu.buildFromTemplate([
        { label: 'Runbar (Error)', enabled: false },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ]);
      this.tray.setContextMenu(fallbackMenu);
    }
  }

  private async addFolder(): Promise<void> {
    const { dialog, BrowserWindow } = require('electron');
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], {
      properties: ['openDirectory', 'multiSelections'],
      title: 'Select folders to scan for services (you can select multiple folders)'
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const { ServiceDiscovery } = require('./scanner');
      const scanner = new ServiceDiscovery();
      const allDiscoveredServices: any[] = [];
      
      // Collect all discovered services from all folders
      for (const folderPath of result.filePaths) {
        const discoveredServices = await scanner.scanFolder(folderPath);
        allDiscoveredServices.push(...discoveredServices);
      }
      
      if (allDiscoveredServices.length > 0) {
        // Show preview dialog for all discovered services
        await this.showServicePreviewDialog(allDiscoveredServices, result.filePaths);
      } else {
        const { dialog, BrowserWindow } = require('electron');
        await dialog.showMessageBox(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], {
          type: 'info',
          title: 'No Services Found',
          message: 'No services were found in the selected folders.'
        });
      }
    }
  }

  private async showServicePreviewDialog(discoveredServices: any[], selectedFolders: string[]): Promise<void> {
    const { BrowserWindow, ipcMain } = require('electron');
    const fs = require('fs');
    const path = require('path');
    
    // Enhance discovered services with available scripts
    const enhancedServices = discoveredServices.map(ds => {
      let scripts: string[] = [];
      if (ds.projectType === 'nodejs' && ds.path) {
        try {
          const pkgPath = path.join(ds.path, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts) {
              scripts = Object.keys(pkg.scripts);
            }
          }
        } catch (e) { /* ignore */ }
      }
      return { ...ds, scripts, selected: true };
    });

    const previewWin = new BrowserWindow({
      width: 800,
      height: 700,
      title: 'Review Discovered Services',
      modal: false,
      show: false,
      resizable: true,
      alwaysOnTop: true,
      focusable: true,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    let serviceHtml = '';
    enhancedServices.forEach((service, index) => {
      const scriptOptions = service.scripts.length > 0 
        ? `<select id='script${index}' onchange='updateCommand(${index})' style='width:200px;margin-left:10px;'>
            <option value=''>Select script...</option>
            ${service.scripts.map((s: string) => `<option value='${s}'>${s}</option>`).join('')}
           </select>`
        : '';
      
      serviceHtml += `
        <div style='border:1px solid #444;margin:10px 0;padding:15px;border-radius:5px;background:#2a2a2a;'>
          <div style='display:flex;align-items:center;margin-bottom:10px;'>
            <input type='checkbox' id='select${index}' checked onchange='toggleService(${index})' style='margin-right:10px;'>
            <strong style='color:#fff;font-size:16px;'>${service.name}</strong>
            <span style='color:#888;margin-left:10px;'>(${service.projectType})</span>
          </div>
          <div style='color:#ccc;margin-bottom:10px;font-family:monospace;font-size:12px;'>${service.path}</div>
          <div style='display:flex;align-items:center;margin-bottom:10px;'>
            <label style='color:#ccc;min-width:80px;'>Command:</label>
            <input type='text' id='cmd${index}' value='${service.command.replace(/'/g, '&#39;')}' style='flex:1;background:#333;color:#fff;border:1px solid #555;padding:5px;border-radius:3px;'>
            ${scriptOptions}
          </div>
        </div>
      `;
    });

    const html = `
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1e1e1e; color: #fff; margin: 0; padding: 20px; }
            .header { margin-bottom: 20px; }
            .header h2 { margin: 0 0 10px 0; color: #fff; }
            .header p { margin: 0; color: #ccc; }
            .actions { margin: 20px 0; padding: 15px; background: #2a2a2a; border-radius: 5px; }
            .actions button { background: #007acc; color: white; border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; margin-right: 10px; }
            .actions button:hover { background: #005a9e; }
            .actions button.secondary { background: #555; }
            .actions button.secondary:hover { background: #666; }
            .services-container { height: calc(100vh - 200px); overflow-y: auto; }
          </style>
        </head>
        <body>
          <div class='header'>
            <h2>Review Discovered Services</h2>
            <p>Found ${enhancedServices.length} services in ${selectedFolders.length} folder(s). Select which ones to add and customize their commands.</p>
            <div style='margin-top: 15px;'>
              <label style='color: #ccc; display: block; margin-bottom: 5px;'>Group Name:</label>
              <input type='text' id='groupName' value='${path.basename(path.dirname(enhancedServices[0]?.path || ''))}' style='width: 100%; background: #333; color: #fff; border: 1px solid #555; padding: 8px; border-radius: 3px; font-size: 14px;'>
            </div>
          </div>
          
          <div class='actions'>
            <button onclick='selectAll()'>Select All</button>
            <button onclick='deselectAll()'>Deselect All</button>
            <button onclick='saveServices()' style='background: #28a745;'>Save Selected Services</button>
            <button onclick='window.close()' class='secondary'>Cancel</button>
          </div>
          
          <div class='services-container'>
            ${serviceHtml}
          </div>
          
          <script>
            const { ipcRenderer } = require('electron');
            
            function toggleService(index) {
              const checkbox = document.getElementById('select' + index);
              const cmdInput = document.getElementById('cmd' + index);
              cmdInput.disabled = !checkbox.checked;
              if (document.getElementById('script' + index)) {
                document.getElementById('script' + index).disabled = !checkbox.checked;
              }
            }
            
            function selectAll() {
              for (let i = 0; i < ${enhancedServices.length}; i++) {
                document.getElementById('select' + i).checked = true;
                document.getElementById('cmd' + i).disabled = false;
                if (document.getElementById('script' + i)) {
                  document.getElementById('script' + i).disabled = false;
                }
              }
            }
            
            function deselectAll() {
              for (let i = 0; i < ${enhancedServices.length}; i++) {
                document.getElementById('select' + i).checked = false;
                document.getElementById('cmd' + i).disabled = true;
                if (document.getElementById('script' + i)) {
                  document.getElementById('script' + i).disabled = true;
                }
              }
            }
            
            function updateCommand(index) {
              const scriptSelect = document.getElementById('script' + index);
              const cmdInput = document.getElementById('cmd' + index);
              if (scriptSelect.value) {
                cmdInput.value = 'npm run ' + scriptSelect.value;
              }
            }
            
                                     function saveServices() {
              const selectedServices = [];
              const serviceNames = ${JSON.stringify(enhancedServices.map(s => s.name))};
              const servicePaths = ${JSON.stringify(enhancedServices.map(s => s.path))};
              const serviceTypes = ${JSON.stringify(enhancedServices.map(s => s.projectType))};
              const groupName = document.getElementById('groupName').value.trim() || 'New Group';
              
              for (let i = 0; i < ${enhancedServices.length}; i++) {
                const checkbox = document.getElementById('select' + i);
                if (checkbox.checked) {
                  selectedServices.push({
                    name: serviceNames[i],
                    path: servicePaths[i],
                    command: document.getElementById('cmd' + i).value,
                    projectType: serviceTypes[i]
                  });
                }
              }
              ipcRenderer.send('save-services', selectedServices, groupName);
            }
          </script>
        </body>
      </html>
    `;

    previewWin.loadURL('data:text/html,' + encodeURIComponent(html));
    previewWin.once('ready-to-show', () => {
      previewWin.show();
      previewWin.focus();
    });

        ipcMain.once('save-services', async (_: any, selectedServices: any[], groupName: string) => {
      if (selectedServices.length > 0) {
        // Add all services first
        for (const service of selectedServices) {
          const serviceObj = {
            name: service.name,
            path: service.path,
            command: service.command,
            projectType: service.projectType,
            autoStart: false
          };
          await this.storage.addService(serviceObj);
        }

        // Create a single group for all selected services
        const groupServices = selectedServices.map((s: { name: string }) => s.name);
        const groups = await this.storage.getGroups();
        
        // Use the provided group name or fallback to a default
        const finalGroupName = groupName || 'New Group';
        
        let group = groups.find(g => g.name === finalGroupName);
        if (group) {
          // Merge new services into existing group
          group.services = Array.from(new Set([...group.services, ...groupServices]));
        } else {
          // Create new group
          group = { name: finalGroupName, services: groupServices };
          groups.push(group);
        }
        await this.storage.saveGroups(groups);

        await this.updateMenu();
        
        if (!previewWin.isDestroyed()) {
          previewWin.close();
        }

        const { dialog, BrowserWindow } = require('electron');
        await dialog.showMessageBox(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], {
          type: 'info',
          title: 'Services Added',
          message: `Successfully added ${selectedServices.length} services to Runbar.`
        });
      } else {
        if (!previewWin.isDestroyed()) {
          previewWin.close();
        }
      }
    });
  }

  private async addService(): Promise<void> {
    const { dialog, BrowserWindow } = require('electron');
    // Prompt for service name
    const nameResult = await dialog.showMessageBox(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], {
      type: 'question',
      buttons: ['OK'],
      title: 'Add Service',
      message: 'Enter the service name in the next prompt.'
    });
    if (nameResult.response !== 0) return;
    const name = await dialog.showInputBox ? await dialog.showInputBox({ prompt: 'Service Name:' }) : await this.promptInput('Service Name:');
    if (!name) return;
    // Prompt for path
    const pathResult = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], {
      properties: ['openDirectory'],
      title: 'Select service folder'
    });
    if (pathResult.canceled || pathResult.filePaths.length === 0) return;
    const path = pathResult.filePaths[0];
    // Prompt for command
    const commandResult = await dialog.showMessageBox(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0], {
      type: 'question',
      buttons: ['OK'],
      title: 'Add Service',
      message: 'Enter the start command in the next prompt.'
    });
    if (commandResult.response !== 0) return;
    const command = await dialog.showInputBox ? await dialog.showInputBox({ prompt: 'Start Command:' }) : await this.promptInput('Start Command:');
    if (!command) return;
    // Add service
    const service = {
      name,
      path,
      command,
      autoStart: false
    };
    await this.storage.addService(service);
    await this.updateMenu();
  }

  private async promptInput(prompt: string): Promise<string | null> {
    const { BrowserWindow } = require('electron');
    const inputWin = new BrowserWindow({
      width: 400,
      height: 200,
      modal: false,
      show: false,
      alwaysOnTop: true,
      focusable: true,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    inputWin.loadURL(`data:text/html,<body style='font-family:sans-serif'><h3>${prompt}</h3><input id='val' style='width:90%' autofocus/><br/><button onclick='require(\'electron\').ipcRenderer.send(\'input\', document.getElementById(\'val\').value)'>OK</button><script>require('electron').ipcRenderer.on('close', () => window.close())</script></body>`);
    inputWin.once('ready-to-show', () => {
      inputWin.show();
      inputWin.focus();
    });
    return new Promise(resolve => {
      const { ipcMain } = require('electron');
      ipcMain.once('input', (_: any, value: string) => {
        resolve(value);
        inputWin.webContents.send('close');
        setTimeout(() => inputWin.close(), 100);
      });
    });
  }

  private openSettings(): void {
    console.log('Opening settings...');
  }
} 