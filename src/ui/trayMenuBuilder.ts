import { Menu, MenuItemConstructorOptions } from 'electron';
import type { Service, Group } from '../shared/types';
import { createServiceLogger } from '../shared/logger';

const log = createServiceLogger('TrayMenuBuilder');

export interface TrayMenuBuilderOptions {
  onServiceToggle?: (serviceId: string) => void;
  onGroupToggle?: (groupId: string) => void;
  onAddFolder?: () => void;
  onAddService?: () => void;
  onOpenSettings?: () => void;
  onQuit?: () => void;
}

export class TrayMenuBuilder {
  private options: TrayMenuBuilderOptions;

  constructor(options: TrayMenuBuilderOptions = {}) {
    this.options = options;
  }

  buildMenu(services: Service[], groups: Group[]): Menu {
    log.debug('Building tray menu', { serviceCount: services.length, groupCount: groups.length });

    const template: MenuItemConstructorOptions[] = [
      ...this.buildGroupMenuItems(groups, services),
      { type: 'separator' },
      ...this.buildActionMenuItems(),
      { type: 'separator' },
      ...this.buildQuitMenuItem(),
    ];

    return Menu.buildFromTemplate(template);
  }

  // Service menu items removed - services now only appear within groups

  private buildGroupMenuItems(groups: Group[], services: Service[]): MenuItemConstructorOptions[] {
    if (groups.length === 0) {
      return [
        {
          label: 'No groups configured',
          enabled: false,
        },
        {
          label: 'Add services to groups to see them here',
          enabled: false,
        },
      ];
    }

    return groups.map((group) => {
      const groupServices = services.filter((s) => group.services.includes(s.name));
      const runningCount = groupServices.filter((s) => s.status === 'running').length;
      const totalCount = groupServices.length;

      // Debug logging removed

      return {
        label: this.formatGroupLabel(group, runningCount, totalCount),
        click: () => this.options.onGroupToggle?.(group.id),
        submenu: this.buildGroupSubmenu(group, groupServices),
      };
    });
  }

  private buildGroupSubmenu(group: Group, groupServices: Service[]): MenuItemConstructorOptions[] {
    const runningCount = groupServices.filter((s) => s.status === 'running').length;
    const totalCount = groupServices.length;

    return [
      {
        label: `Services: ${runningCount}/${totalCount} running`,
        enabled: false,
      },
      { type: 'separator' },
      ...groupServices.map((service) => ({
        label: `${service.name} (${service.status || 'unknown'})`,
        click: () => this.options.onServiceToggle?.(service.id),
      })),
      { type: 'separator' },
      {
        label: runningCount === totalCount ? 'Stop All' : 'Start All',
        click: () => this.options.onGroupToggle?.(group.id),
      },
    ];
  }

  private buildActionMenuItems(): MenuItemConstructorOptions[] {
    return [
      {
        label: 'Add Folder to Scan',
        click: () => this.options.onAddFolder?.(),
      },
      {
        label: 'Add Service Manually',
        click: () => this.options.onAddService?.(),
      },
      {
        label: 'Settings',
        click: () => this.options.onOpenSettings?.(),
      },
    ];
  }

  private buildQuitMenuItem(): MenuItemConstructorOptions[] {
    return [
      {
        label: 'Quit Runbar',
        click: () => this.options.onQuit?.(),
      },
    ];
  }

  // formatServiceLabel removed - no longer needed

  private formatGroupLabel(group: Group, runningCount: number, totalCount: number): string {
    const statusIcon = runningCount === totalCount ? '🟢' : runningCount > 0 ? '🟡' : '🔴';
    return `${statusIcon} ${group.name} (${runningCount}/${totalCount})`;
  }

  // Status icons removed to avoid Electron menu issues
} 