import { Menu, dialog, app, MenuItemConstructorOptions } from 'electron';
import { ProcessManager } from './processManager';
import { Storage } from './storage';
import { Dashboard } from './dashboard';
import { WidgetManager } from './widget';
import { Service, Group, ProjectType } from './types';

export class MenuManager {
  private processManager: ProcessManager;
  private storage: Storage;
  private dashboard: Dashboard;
  private widgetManager: WidgetManager;

  constructor(processManager: ProcessManager, storage: Storage, dashboard: Dashboard, widgetManager: WidgetManager) {
    this.processManager = processManager;
    this.storage = storage;
    this.dashboard = dashboard;
    this.widgetManager = widgetManager;
  }

  async createMainMenu(): Promise<Menu> {
    const groups = await this.storage.getGroups();
    const allServices = await this.storage.getServices();
    
    const groupItems = groups.map((group) => this.createGroupMenuItem(group, allServices));
    const mainMenuItems = this.createMainMenuItems();
    
    const menuTemplate: MenuItemConstructorOptions[] = [
      ...groupItems,
      { type: 'separator' },
      ...mainMenuItems
    ];

    return Menu.buildFromTemplate(menuTemplate);
  }

  async createDockMenu(): Promise<Menu> {
    const groups = await this.storage.getGroups();
    const allServices = await this.storage.getServices();
    
    const groupItems = groups.map((group) => this.createGroupMenuItem(group, allServices));
    
    const menuTemplate: MenuItemConstructorOptions[] = [
      ...groupItems,
      { type: 'separator' },
      { label: 'Add Folder to Scan...', click: () => this.addFolder() },
      { type: 'separator' },
      { label: 'Dashboard', click: () => this.dashboard.show() },
      { label: 'Status Widget', click: () => this.widgetManager.showStatusWidget() },
      { type: 'separator' },
      { label: 'Settings', click: () => this.openSettings() }
    ];
    return Menu.buildFromTemplate(menuTemplate);
  }

  // Private helper methods for DRY principle
  private createGroupMenuItem(group: Group, allServices: Service[]): MenuItemConstructorOptions {
    const groupServices = allServices.filter(s => group.services.includes(s.name));
    const runningCount = groupServices.filter(s => this.processManager.getServiceStatus(s.path) === 'running').length;
    const totalCount = groupServices.length;
    const statusIndicator = runningCount > 0 ? ` (${runningCount}/${totalCount})` : '';
    
    return {
      label: `Group: ${group.name}${statusIndicator}`,
      submenu: [
        {
          label: 'Add Service to Group',
          click: () => this.addServiceToGroup(group)
        },
        {
          label: 'Start All',
          click: () => this.startAllServices(groupServices, group.name)
        },
        {
          label: 'Stop All',
          click: () => this.stopAllServices(groupServices, group.name)
        },
        {
          label: 'Restart All',
          click: () => this.restartAllServices(groupServices, group.name)
        },
        {
          label: 'View Group Logs',
          click: () => this.viewGroupLogs(groupServices, group.name)
        },
        { type: 'separator' },
        {
          label: 'Manage Group',
          submenu: [
            {
              label: 'Rename Group',
              click: () => this.renameGroup(group)
            },
            {
              label: 'Duplicate Group',
              click: () => this.duplicateGroup(group)
            },
            {
              label: 'Delete Group',
              click: () => this.deleteGroup(group)
            }
          ]
        },
        { type: 'separator' },
        ...groupServices.map(service => this.createServiceMenuItem(service, group))
      ]
    };
  }

  private createServiceMenuItem(service: Service, group: Group): MenuItemConstructorOptions {
    const status = this.processManager.getServiceStatus(service.path);
    
    return {
      label: `${service.name} [${status}]`,
      submenu: [
        {
          label: status === 'running' ? 'Stop' : 'Start',
          click: () => this.toggleService(service, status)
        },
        {
          label: 'View Logs',
          click: () => this.viewServiceLogs(service)
        },
        {
          label: 'Remove from Group',
          click: () => this.removeServiceFromGroup(service, group)
        },
        {
          label: 'Edit Service',
          click: () => this.editService(service)
        }
      ]
    };
  }

  private createMainMenuItems(): MenuItemConstructorOptions[] {
    return [
      { label: 'Add Folder to Scan...', click: () => this.addFolder() },
      { type: 'separator' },
      { label: 'Dashboard', click: () => this.dashboard.show() },
      { label: 'Status Widget', click: () => this.widgetManager.showStatusWidget() },
      { type: 'separator' },
      { label: 'Settings', click: () => this.openSettings() },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'Cmd+Q', click: () => app.quit() }
    ];
  }

  // Service Management Methods
  private async addFolder(): Promise<void> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select folder to scan for services'
    });
    
    if (result.canceled || result.filePaths.length === 0) return;
    
    const folderPath = result.filePaths[0];
    if (!folderPath) return;
    const folderName = folderPath.split(/[\\/]/).pop() || 'Unknown';
    
    const { ServiceDiscovery } = require('./scanner');
    const scanner = new ServiceDiscovery();
    const discoveredServices = await scanner.scanFolder(folderPath);
    
    if (discoveredServices.length > 0) {
      await this.addDiscoveredServices(discoveredServices, folderName);
    } else {
      await this.showNoServicesFoundDialog();
    }
  }

  private async addDiscoveredServices(discoveredServices: any[], folderName: string): Promise<void> {
    // Add all discovered services
    for (const ds of discoveredServices) {
      const service: Service = {
        name: ds.name,
        path: ds.path,
        command: ds.command,
        projectType: ds.projectType as ProjectType,
        autoStart: false
      };
      await this.storage.addService(service);
    }
    
    // Create or update group
    const groupServices = discoveredServices.map((ds: any) => ds.name);
    const groups = await this.storage.getGroups();
    let group = groups.find(g => g.name === folderName);
    
    if (group) {
      group.services = Array.from(new Set([...group.services, ...groupServices]));
    } else {
      group = { name: folderName, services: groupServices };
      groups.push(group);
    }
    
    await this.storage.saveGroups(groups);
  }

  private async showNoServicesFoundDialog(): Promise<void> {
    await dialog.showMessageBox({
      type: 'info',
      title: 'No Services Found',
      message: 'No services were found in the selected folder.'
    });
  }

  private async startAllServices(services: Service[], groupName: string): Promise<void> {
    for (const service of services) {
      await this.processManager.startService(service);
    }
    this.showNotification('Group Started', `All services in ${groupName} are now running`);
  }

  private async stopAllServices(services: Service[], groupName: string): Promise<void> {
    for (const service of services) {
      await this.processManager.stopService(service);
    }
    this.showNotification('Group Stopped', `All services in ${groupName} have been stopped`);
  }

  private async restartAllServices(services: Service[], groupName: string): Promise<void> {
    for (const service of services) {
      await this.processManager.stopService(service);
    }
    
    // Wait a moment, then start all
    setTimeout(async () => {
      for (const service of services) {
        await this.processManager.startService(service);
      }
      this.showNotification('Group Restarted', `All services in ${groupName} have been restarted`);
    }, 1000);
  }

  private async toggleService(service: Service, currentStatus: string): Promise<void> {
    if (currentStatus === 'running') {
      await this.processManager.stopService(service);
      service.status = 'stopped';
      this.showNotification('Service Stopped', `${service.name} has been stopped`);
    } else {
      await this.processManager.startService(service);
      service.status = 'running';
      this.showNotification('Service Started', `${service.name} is now running`);
    }
    await this.storage.addService(service);
  }

  private async viewServiceLogs(service: Service): Promise<void> {
    const logs = this.processManager.getServiceLogs(service.path);
    const { BrowserWindow } = require('electron');
    const logWin = new BrowserWindow({
      width: 700,
      height: 500,
      title: `Logs for ${service.name}`,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    
    const logHtml = this.createServiceLogHtml(service, logs);
    logWin.loadURL('data:text/html,' + encodeURIComponent(logHtml));
  }

  private createServiceLogHtml(service: Service, logs: string[]): string {
    return `
      <html><body style='font-family:monospace;background:#222;color:#eee;margin:0;padding:0;'>
      <h2 style='margin:10px;'>Logs for ${service.name}</h2>
      <pre style='white-space:pre-wrap;word-break:break-all;background:#111;padding:10px;height:80vh;overflow:auto;border-radius:6px;'>${(logs && logs.length > 0 ? logs.join('\n') : 'No logs available.').replace(/</g, '&lt;')}</pre>
      <button onclick='navigator.clipboard.writeText(document.querySelector("pre").innerText)'>Copy All</button>
      </body></html>
    `;
  }

  private async viewGroupLogs(services: Service[], groupName: string): Promise<void> {
    const { BrowserWindow, ipcMain } = require('electron');
    const logHtml = this.createGroupLogHtml(services, groupName);
    
    const logWin = new BrowserWindow({
      width: 900,
      height: 650,
      title: `Logs for Group: ${groupName}`,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    
    logWin.loadURL('data:text/html,' + encodeURIComponent(logHtml));
    logWin.on('closed', () => {
      ipcMain.removeAllListeners('log-update');
    });
  }

  private createGroupLogHtml(services: Service[], groupName: string): string {
    let logHtml = `<html><body style='background:#181A1B;margin:0;padding:0;'><div style='font-family:monospace;background:#23272E;color:#D1D5DB;margin:0;padding:0;min-height:100vh;'><h2 style='margin:0 0 10px 0;padding:18px 18px 0 18px;font-size:1.3em;font-weight:600;letter-spacing:1px;'>Logs for Group: ${groupName}</h2>`;
    
    // Tab headers
    logHtml += `<div id='tabs' style='margin:0 0 10px 18px;'>`;
    services.forEach((service, i) => {
      const status = this.processManager.getServiceStatus(service.path);
      const statusColor = status === 'running' ? '#10B981' : status === 'error' ? '#EF4444' : '#6B7280';
      const statusText = status === 'running' ? '●' : status === 'error' ? '●' : '○';
      logHtml += `<button onclick='showTab(${i})' id='tabbtn${i}' style='margin-right:5px;background:#23272E;color:#D1D5DB;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:1em;'><span style='color:${statusColor};margin-right:5px;'>${statusText}</span>${service.name}</button>`;
    });
    logHtml += `</div>`;
    
    // Tab contents
    services.forEach((service, i) => {
      const logs = this.processManager.getServiceLogs(service.path);
      logHtml += `<div id='tab${i}' style='display:${i === 0 ? 'block' : 'none'};'>`;
      logHtml += `<pre id='logpre${i}' style='white-space:pre-wrap;word-break:break-all;background:#181A1B;padding:18px 18px 18px 18px;height:60vh;overflow:auto;border-radius:10px;box-shadow:0 2px 16px #0008;font-size:1.1em;line-height:1.5;'>${(logs && logs.length > 0 ? logs.join('\n') : 'No logs available.').replace(/</g, '&lt;')}</pre>`;
      logHtml += `</div>`;
    });
    
    logHtml += `<button style='margin:18px;background:#23272E;color:#D1D5DB;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:1em;box-shadow:0 1px 4px #0004;' onclick='navigator.clipboard.writeText(document.body.innerText)'>Copy All</button>`;
    logHtml += this.createGroupLogScript(services);
    logHtml += `</div></body></html>`;
    
    return logHtml;
  }

  private createGroupLogScript(services: Service[]): string {
    return `<script>
      const { ipcRenderer } = require('electron');
      function showTab(idx) {
        var n = ${services.length};
        for (var i = 0; i < n; i++) {
          document.getElementById('tab'+i).style.display = (i === idx ? 'block' : 'none');
          document.getElementById('tabbtn'+i).style.background = (i === idx ? '#181A1B' : '#23272E');
        }
      }
      showTab(0);
      ipcRenderer.on('log-update', (event, data) => {
        const idx = ${JSON.stringify(services.map(s => s.path))}.indexOf(data.path);
        if (idx !== -1) {
          const pre = document.getElementById('logpre'+idx);
          if (pre) {
            pre.textContent += data.line;
            pre.scrollTop = pre.scrollHeight;
          }
        }
      });
      
      // Update status indicators every 2 seconds
      setInterval(() => {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('get-service-statuses', ${JSON.stringify(services.map(s => s.path))});
      }, 2000);
      
      ipcRenderer.on('service-statuses', (event, statuses) => {
        statuses.forEach((status, idx) => {
          const btn = document.getElementById('tabbtn'+idx);
          if (btn) {
            const statusColor = status === 'running' ? '#10B981' : status === 'error' ? '#EF4444' : '#6B7280';
            const statusText = status === 'running' ? '●' : status === 'error' ? '●' : '○';
            const serviceName = ${JSON.stringify(services.map(s => s.name))}[idx];
            btn.innerHTML = \`<span style='color:\${statusColor};margin-right:5px;'>\${statusText}</span>\${serviceName}\`;
          }
        });
      });
    </script>`;
  }

  // Group Management Methods
  private async addServiceToGroup(group: Group): Promise<void> {
    const { dialog } = require('electron');
    
    const pathResult = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select service/project folder'
    });
    
    if (pathResult.canceled || pathResult.filePaths.length === 0) return;
    
    const folderPath = pathResult.filePaths[0];
    const serviceData = await this.detectServiceData(folderPath);
    
    const { BrowserWindow, ipcMain } = require('electron');
    const editWin = new BrowserWindow({
      width: 400,
      height: 350,
      modal: true,
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    
    const html = this.createServiceEditHtml(serviceData);
    editWin.loadURL('data:text/html,' + encodeURIComponent(html));
    editWin.once('ready-to-show', () => editWin.show());
    
    ipcMain.once('edit-service', async (_: any, data: any) => {
      const service: Service = {
        name: data.name,
        path: folderPath,
        command: data.command,
        projectType: 'nodejs' as ProjectType,
        autoStart: false
      };
      
      await this.storage.addService(service);
      await this.addServiceToGroupStorage(service.name, group);
      editWin.close();
    });
  }

  private async detectServiceData(folderPath: string): Promise<{ name: string; scripts: string[]; defaultCommand: string }> {
    const fs = require('fs');
    const path = require('path');
    
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
    
    return { name: detectedName, scripts, defaultCommand };
  }

  private createServiceEditHtml(serviceData: { name: string; scripts: string[]; defaultCommand: string }): string {
    const scriptOptions = serviceData.scripts.length > 0 ? 
      `<label>Scripts:<br><select id='script'>${serviceData.scripts.map(s => `<option value='${s}'>${s}</option>`)}</select></label><br><br>` : '';
    
    return `
      <html><body style='font-family:sans-serif;background:#222;color:#eee;'>
      <h2>Add Service to Group</h2>
      <form id='f'>
        <label>Name:<br><input id='name' value='${serviceData.name.replace(/'/g, '&#39;')}' style='width:95%'></label><br><br>
        ${scriptOptions}
        <label>Command:<br><input id='cmd' value='${serviceData.defaultCommand.replace(/'/g, '&#39;')}' style='width:95%'></label><br><br>
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
      </script>
      </body></html>
    `;
  }

  private async addServiceToGroupStorage(serviceName: string, group: Group): Promise<void> {
    const groups = await this.storage.getGroups();
    const groupIndex = groups.findIndex(g => g.name === group.name);
    if (groupIndex !== -1 && groups[groupIndex]) {
      groups[groupIndex].services.push(serviceName);
      await this.storage.saveGroups(groups);
    }
  }

  private async renameGroup(group: Group): Promise<void> {
    const { promptInput } = require('./trayMenu');
    const newName = await promptInput(`Enter new name for group '${group.name}':`);
    if (newName && newName.trim()) {
      const groups = await this.storage.getGroups();
      const groupIndex = groups.findIndex(g => g.name === group.name);
      if (groupIndex !== -1 && groups[groupIndex]) {
        groups[groupIndex].name = newName.trim();
        await this.storage.saveGroups(groups);
      }
    }
  }

  private async duplicateGroup(group: Group): Promise<void> {
    const { promptInput } = require('./trayMenu');
    const newName = await promptInput(`Enter name for duplicate of '${group.name}':`);
    if (newName && newName.trim()) {
      const groups = await this.storage.getGroups();
      const newGroup: Group = {
        name: newName.trim(),
        services: [...group.services]
      };
      groups.push(newGroup);
      await this.storage.saveGroups(groups);
    }
  }

  private async deleteGroup(group: Group): Promise<void> {
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
      title: 'Delete Group',
      message: `Are you sure you want to delete the group '${group.name}'?`,
      detail: 'This will remove the group but keep the services.'
    });
    
    if (result.response === 1) {
      const groups = await this.storage.getGroups();
      const filteredGroups = groups.filter(g => g.name !== group.name);
      await this.storage.saveGroups(filteredGroups);
    }
  }

  private async removeServiceFromGroup(service: Service, group: Group): Promise<void> {
    const groups = await this.storage.getGroups();
    const groupIndex = groups.findIndex(g => g.name === group.name);
    if (groupIndex !== -1 && groups[groupIndex]) {
      groups[groupIndex].services = groups[groupIndex].services.filter(s => s !== service.name);
      await this.storage.saveGroups(groups);
    }
  }

  private async editService(service: Service): Promise<void> {
    const { BrowserWindow, ipcMain } = require('electron');
    const serviceData = await this.detectServiceData(service.path);
    
    const editWin = new BrowserWindow({
      width: 400,
      height: 350,
      modal: true,
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    
    const html = this.createServiceEditHtml({
      name: service.name,
      scripts: serviceData.scripts,
      defaultCommand: service.command
    });
    
    editWin.loadURL('data:text/html,' + encodeURIComponent(html));
    editWin.once('ready-to-show', () => editWin.show());
    
    ipcMain.once('edit-service', async (_: any, data: any) => {
      service.name = data.name;
      service.command = data.command;
      await this.storage.addService(service);
      editWin.close();
    });
  }

  // Utility Methods

  private openSettings(): void {
    const { BrowserWindow } = require('electron');
    
    const settingsWin = new BrowserWindow({
      width: 600,
      height: 500,
      title: 'Runbar Settings',
      webPreferences: { nodeIntegration: true, contextIsolation: false },
      show: false,
      modal: true
    });
    
    const settingsHtml = `
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { margin: 0 0 20px 0; color: #333; }
            .setting { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
            input[type="text"], input[type="number"], select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
            .checkbox { display: flex; align-items: center; }
            .checkbox input { width: auto; margin-right: 10px; }
            button { background: #007cba; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px; }
            button:hover { background: #005a87; }
            .danger { background: #dc3545; }
            .danger:hover { background: #c82333; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Runbar Settings</h1>
            
            <div class="setting">
              <label>Auto-start on login:</label>
              <div class="checkbox">
                <input type="checkbox" id="autoStart" checked>
                <span>Start Runbar automatically when you log in</span>
              </div>
            </div>
            
            <div class="setting">
              <label>Auto-start services:</label>
              <div class="checkbox">
                <input type="checkbox" id="autoStartServices">
                <span>Automatically start services marked as auto-start</span>
              </div>
            </div>
            
            <div class="setting">
              <label>Show notifications:</label>
              <div class="checkbox">
                <input type="checkbox" id="notifications" checked>
                <span>Show desktop notifications for service status changes</span>
              </div>
            </div>
            
            <div class="setting">
              <label>Log level:</label>
              <select id="logLevel">
                <option value="error">Error only</option>
                <option value="warn">Warnings and errors</option>
                <option value="info" selected>Info, warnings, and errors</option>
                <option value="debug">Debug (all messages)</option>
              </select>
            </div>
            
            <div class="setting">
              <label>Health check interval (seconds):</label>
              <input type="number" id="healthCheckInterval" value="30" min="5" max="300">
            </div>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <div class="setting">
              <label>Data Management:</label>
              <button onclick="exportData()">Export Configuration</button>
              <button onclick="importData()">Import Configuration</button>
              <button onclick="clearData()" class="danger">Clear All Data</button>
            </div>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <div style="text-align: right;">
              <button onclick="saveSettings()">Save Settings</button>
              <button onclick="closeWindow()">Cancel</button>
            </div>
          </div>
          
          <script>
            const { ipcRenderer } = require('electron');
            
            // Load current settings
            document.addEventListener('DOMContentLoaded', () => {
              // TODO: Load actual settings from storage
              console.log('Settings window loaded');
            });
            
            function saveSettings() {
              const settings = {
                autoStart: document.getElementById('autoStart').checked,
                autoStartServices: document.getElementById('autoStartServices').checked,
                notifications: document.getElementById('notifications').checked,
                logLevel: document.getElementById('logLevel').value,
                healthCheckInterval: parseInt(document.getElementById('healthCheckInterval').value)
              };
              
              ipcRenderer.send('save-settings', settings);
            }
            
            function exportData() {
              ipcRenderer.send('export-data');
            }
            
            function importData() {
              ipcRenderer.send('import-data');
            }
            
            function clearData() {
              if (confirm('Are you sure you want to clear all Runbar data? This cannot be undone.')) {
                ipcRenderer.send('clear-data');
              }
            }
            
            function closeWindow() {
              window.close();
            }
          </script>
        </body>
      </html>
    `;
    
    settingsWin.loadURL('data:text/html,' + encodeURIComponent(settingsHtml));
    settingsWin.once('ready-to-show', () => settingsWin.show());
    
    // Handle settings actions
    const { ipcMain } = require('electron');
    ipcMain.once('save-settings', (_: any, settings: any) => {
      console.log('Saving settings:', settings);
      // TODO: Actually save settings to storage
      settingsWin.close();
    });
    
    ipcMain.once('export-data', () => {
      console.log('Export data requested');
      // TODO: Implement data export
    });
    
    ipcMain.once('import-data', () => {
      console.log('Import data requested');
      // TODO: Implement data import
    });
    
    ipcMain.once('clear-data', () => {
      console.log('Clear data requested');
      // TODO: Implement data clearing
    });
  }

  private showNotification(title: string, body: string, silent: boolean = false): void {
    const { Notification } = require('electron');
    const path = require('path');
    
    // Use a dedicated transparent notification icon
    const notificationIconPath = path.join(__dirname, '../assets/notification-icon.png');
    
    new Notification({
      title,
      body,
      silent,
      icon: notificationIconPath
    }).show();
  }
} 