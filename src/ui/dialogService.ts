import { dialog, BrowserWindow, ipcMain } from 'electron';
import type { DiscoveredService } from '../shared/types';
import { createServiceLogger } from '../shared/logger';

const log = createServiceLogger('DialogService');

export interface ServicePreviewData {
  discoveredServices: DiscoveredService[];
  selectedFolders: string[];
}

export interface ServiceFormData {
  name: string;
  path: string;
  command: string;
  projectType?: string;
}

export class DialogService {
  private windows: Map<string, BrowserWindow> = new Map();

  async selectFolder(title: string = 'Select Folder'): Promise<string | null> {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title,
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0] || null;
    } catch (error) {
      log.error('Failed to select folder', error as Error);
      return null;
    }
  }

  async showServicePreviewDialog(data: ServicePreviewData): Promise<DiscoveredService[]> {
    return new Promise((resolve) => {
      const window = new BrowserWindow({
        width: 800,
        height: 600,
        modal: true,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
        title: 'Service Preview',
      });

      this.windows.set('service-preview', window);

      const html = this.generateServicePreviewHTML(data);
      window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      window.once('ready-to-show', () => {
        window.show();
      });

      window.on('closed', () => {
        this.windows.delete('service-preview');
      });

      // Handle IPC communication
      ipcMain.once('service-preview-result', (_, selectedServices: DiscoveredService[]) => {
        resolve(selectedServices);
        window.close();
      });

      ipcMain.once('service-preview-cancel', () => {
        resolve([]);
        window.close();
      });
    });
  }

  async showServiceFormDialog(
    initialData?: Partial<ServiceFormData>,
    projectInfo?: Partial<DiscoveredService>
  ): Promise<ServiceFormData | null> {
    return new Promise((resolve) => {
      const window = new BrowserWindow({
        width: 500,
        height: 400,
        modal: true,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
        title: 'Add Service',
      });

      this.windows.set('service-form', window);

      const html = this.generateServiceFormHTML(initialData, projectInfo);
      window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      window.once('ready-to-show', () => {
        window.show();
      });

      window.on('closed', () => {
        this.windows.delete('service-form');
      });

      // Handle IPC communication
      ipcMain.once('service-form-submit', (_, formData: ServiceFormData) => {
        resolve(formData);
        window.close();
      });

      ipcMain.once('service-form-cancel', () => {
        resolve(null);
        window.close();
      });
    });
  }

  async showInputDialog(prompt: string, defaultValue: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
      const window = new BrowserWindow({
        width: 400,
        height: 200,
        modal: true,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
        title: 'Input',
      });

      this.windows.set('input-dialog', window);

      const html = this.generateInputDialogHTML(prompt, defaultValue);
      window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      window.once('ready-to-show', () => {
        window.show();
      });

      window.on('closed', () => {
        this.windows.delete('input-dialog');
      });

      // Handle IPC communication
      ipcMain.once('input-dialog-submit', (_, value: string) => {
        resolve(value);
        window.close();
      });

      ipcMain.once('input-dialog-cancel', () => {
        resolve(null);
        window.close();
      });
    });
  }

  private generateServicePreviewHTML(data: ServicePreviewData): string {
    const { discoveredServices, selectedFolders } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Service Preview</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; margin-bottom: 20px; }
          .folder-info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .service-list { margin-bottom: 20px; }
          .service-item { 
            border: 1px solid #ddd; 
            padding: 15px; 
            margin-bottom: 10px; 
            border-radius: 5px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .service-item input[type="checkbox"] { margin-right: 10px; }
          .service-info { flex: 1; }
          .service-name { font-weight: bold; color: #333; }
          .service-details { color: #666; font-size: 0.9em; margin-top: 5px; }
          .project-type { background: #2196f3; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; }
          .buttons { text-align: right; margin-top: 20px; }
          button { 
            padding: 10px 20px; 
            margin-left: 10px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 14px;
          }
          .btn-primary { background: #2196f3; color: white; }
          .btn-secondary { background: #f5f5f5; color: #333; }
          .btn-primary:hover { background: #1976d2; }
          .btn-secondary:hover { background: #e0e0e0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Service Preview</h1>
          
          <div class="folder-info">
            <strong>Selected Folder${selectedFolders.length > 1 ? 's' : ''}:</strong><br>
            ${selectedFolders.map(folder => `<code>${folder}</code>`).join('<br>')}
          </div>

          <div class="service-list">
            <h3>Discovered Services (${discoveredServices.length})</h3>
            ${discoveredServices.map((service, index) => `
              <div class="service-item">
                <input type="checkbox" id="service-${index}" checked>
                <div class="service-info">
                  <div class="service-name">${service.name}</div>
                  <div class="service-details">
                    <strong>Path:</strong> ${service.path}<br>
                    <strong>Command:</strong> ${service.command}<br>
                    <strong>Type:</strong> <span class="project-type">${service.projectType}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="buttons">
            <button class="btn-secondary" onclick="cancel()">Cancel</button>
            <button class="btn-primary" onclick="importServices()">Import Selected</button>
          </div>
        </div>

        <script>
          const { ipcRenderer } = require('electron');
          
          function importServices() {
            const selectedServices = [];
            ${discoveredServices.map((_, index) => `
              if (document.getElementById('service-${index}').checked) {
                selectedServices.push(${JSON.stringify(discoveredServices[index])});
              }
            `).join('')}
            ipcRenderer.send('service-preview-result', selectedServices);
          }
          
          function cancel() {
            ipcRenderer.send('service-preview-cancel');
          }
        </script>
      </body>
      </html>
    `;
  }

  private generateServiceFormHTML(
    initialData?: Partial<ServiceFormData>,
    projectInfo?: Partial<DiscoveredService>
  ): string {
    const data = { ...projectInfo, ...initialData };
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Add Service</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; margin-bottom: 20px; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
          input, select { 
            width: 100%; 
            padding: 8px; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            font-size: 14px; 
            box-sizing: border-box;
          }
          .buttons { text-align: right; margin-top: 20px; }
          button { 
            padding: 10px 20px; 
            margin-left: 10px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 14px;
          }
          .btn-primary { background: #2196f3; color: white; }
          .btn-secondary { background: #f5f5f5; color: #333; }
          .btn-primary:hover { background: #1976d2; }
          .btn-secondary:hover { background: #e0e0e0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Add Service</h1>
          
          <form id="serviceForm">
            <div class="form-group">
              <label for="name">Service Name:</label>
              <input type="text" id="name" value="${data.name || ''}" required>
            </div>
            
            <div class="form-group">
              <label for="path">Path:</label>
              <input type="text" id="path" value="${data.path || ''}" required>
            </div>
            
            <div class="form-group">
              <label for="command">Command:</label>
              <input type="text" id="command" value="${data.command || ''}" required>
            </div>
            
            <div class="form-group">
              <label for="projectType">Project Type:</label>
              <select id="projectType">
                <option value="nodejs" ${data.projectType === 'nodejs' ? 'selected' : ''}>Node.js</option>
                <option value="ruby" ${data.projectType === 'ruby' ? 'selected' : ''}>Ruby</option>
                <option value="go" ${data.projectType === 'go' ? 'selected' : ''}>Go</option>
                <option value="rust" ${data.projectType === 'rust' ? 'selected' : ''}>Rust</option>
                <option value="python" ${data.projectType === 'python' ? 'selected' : ''}>Python</option>
                <option value="java" ${data.projectType === 'java' ? 'selected' : ''}>Java</option>
                <option value="docker" ${data.projectType === 'docker' ? 'selected' : ''}>Docker</option>
                <option value="unknown" ${data.projectType === 'unknown' ? 'selected' : ''}>Unknown</option>
              </select>
            </div>
          </form>

          <div class="buttons">
            <button class="btn-secondary" onclick="cancel()">Cancel</button>
            <button class="btn-primary" onclick="submitForm()">Add Service</button>
          </div>
        </div>

        <script>
          const { ipcRenderer } = require('electron');
          
          function submitForm() {
            const formData = {
              name: document.getElementById('name').value,
              path: document.getElementById('path').value,
              command: document.getElementById('command').value,
              projectType: document.getElementById('projectType').value
            };
            
            if (formData.name && formData.path && formData.command) {
              ipcRenderer.send('service-form-submit', formData);
            } else {
              alert('Please fill in all required fields');
            }
          }
          
          function cancel() {
            ipcRenderer.send('service-form-cancel');
          }
        </script>
      </body>
      </html>
    `;
  }

  private generateInputDialogHTML(prompt: string, defaultValue: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Input</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; margin-bottom: 20px; font-size: 18px; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
          input { 
            width: 100%; 
            padding: 8px; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            font-size: 14px; 
            box-sizing: border-box;
          }
          .buttons { text-align: right; margin-top: 20px; }
          button { 
            padding: 10px 20px; 
            margin-left: 10px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 14px;
          }
          .btn-primary { background: #2196f3; color: white; }
          .btn-secondary { background: #f5f5f5; color: #333; }
          .btn-primary:hover { background: #1976d2; }
          .btn-secondary:hover { background: #e0e0e0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${prompt}</h1>
          
          <div class="form-group">
            <input type="text" id="input" value="${defaultValue}" placeholder="Enter value...">
          </div>

          <div class="buttons">
            <button class="btn-secondary" onclick="cancel()">Cancel</button>
            <button class="btn-primary" onclick="submit()">OK</button>
          </div>
        </div>

        <script>
          const { ipcRenderer } = require('electron');
          
          document.getElementById('input').focus();
          
          document.getElementById('input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              submit();
            }
          });
          
          function submit() {
            const value = document.getElementById('input').value;
            ipcRenderer.send('input-dialog-submit', value);
          }
          
          function cancel() {
            ipcRenderer.send('input-dialog-cancel');
          }
        </script>
      </body>
      </html>
    `;
  }

  closeAllWindows(): void {
    for (const [, window] of this.windows.entries()) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
    this.windows.clear();
  }
} 