import { EventEmitter } from 'events';
import type { ServiceEvent, GroupEvent, Service, Group, DiscoveredService } from './types';

// Define event types
export type AppEventType = 
  | 'service:started'
  | 'service:stopped'
  | 'service:error'
  | 'service:status-changed'
  | 'service:log-update'
  | 'group:started'
  | 'group:stopped'
  | 'group:error'
  | 'app:ready'
  | 'app:shutdown'
  | 'config:changed'
  | 'tray:update'
  | 'scan:started'
  | 'scan:completed'
  | 'scan:error';

// Define event payloads
export interface AppEventPayload {
  'service:started': ServiceEvent;
  'service:stopped': ServiceEvent;
  'service:error': ServiceEvent;
  'service:status-changed': ServiceEvent;
  'service:log-update': { service: Service; line: string; timestamp: Date };
  'group:started': GroupEvent;
  'group:stopped': GroupEvent;
  'group:error': GroupEvent;
  'app:ready': { timestamp: Date };
  'app:shutdown': { timestamp: Date };
  'config:changed': { 
    type: 'service' | 'group' | 'settings';
    data: Service | Group | unknown;
  };
  'tray:update': { timestamp: Date };
  'scan:started': { folderPath: string; timestamp: Date };
  'scan:completed': { folderPath: string; services: DiscoveredService[]; timestamp: Date };
  'scan:error': { folderPath: string; error: Error; timestamp: Date };
}

// Event bus class
export class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(50); // Allow more listeners for flexibility
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  // Type-safe event emission
  public override emit<T extends AppEventType>(
    event: T,
    payload: AppEventPayload[T]
  ): boolean {
    return super.emit(event, payload);
  }

  // Type-safe event listening
  public override on<T extends AppEventType>(
    event: T,
    listener: (payload: AppEventPayload[T]) => void
  ): this {
    return super.on(event, listener);
  }

  public override once<T extends AppEventType>(
    event: T,
    listener: (payload: AppEventPayload[T]) => void
  ): this {
    return super.once(event, listener);
  }

  public override off<T extends AppEventType>(
    event: T,
    listener: (payload: AppEventPayload[T]) => void
  ): this {
    return super.off(event, listener);
  }

  // Convenience methods for common events
  public emitServiceStarted(service: Service): void {
    this.emit('service:started', {
      type: 'started',
      service,
      timestamp: new Date(),
    });
  }

  public emitServiceStopped(service: Service): void {
    this.emit('service:stopped', {
      type: 'stopped',
      service,
      timestamp: new Date(),
    });
  }

  public emitServiceError(service: Service, error: Error): void {
    this.emit('service:error', {
      type: 'error',
      service,
      timestamp: new Date(),
      data: { error: error.message, stack: error.stack },
    });
  }

  // Note: emitServiceStatusChanged is implemented below with different signature

  public emitGroupStarted(group: Group, results: Array<{ service: string; success: boolean; error?: string }>): void {
    this.emit('group:started', {
      type: 'started',
      group,
      timestamp: new Date(),
      results,
    });
  }

  public emitGroupStopped(group: Group, results: Array<{ service: string; success: boolean; error?: string }>): void {
    this.emit('group:stopped', {
      type: 'stopped',
      group,
      timestamp: new Date(),
      results,
    });
  }

  public emitGroupError(group: Group, results: Array<{ service: string; success: boolean; error?: string }>): void {
    this.emit('group:error', {
      type: 'error',
      group,
      timestamp: new Date(),
      results,
    });
  }

  public emitAppReady(): void {
    this.emit('app:ready', { timestamp: new Date() });
  }

  public emitAppShutdown(): void {
    this.emit('app:shutdown', { timestamp: new Date() });
  }

  public emitConfigChanged(type: 'service' | 'group' | 'settings', data: Service | Group | unknown): void {
    this.emit('config:changed', { type, data });
  }

  public emitTrayUpdate(): void {
    this.emit('tray:update', { timestamp: new Date() });
  }

  public emitServiceLogUpdate(service: Service, line: string): void {
    this.emit('service:log-update', {
      service,
      line,
      timestamp: new Date(),
    });
  }

  public emitServiceStatusChanged(servicePath: string, status: string): void {
    // Find the service by path for the event
    this.emit('service:status-changed', {
      type: 'status-changed',
      service: { path: servicePath } as Service, // Minimal service object
      timestamp: new Date(),
      data: { status },
    });
  }

  public emitScanStarted(folderPath: string): void {
    this.emit('scan:started', {
      folderPath,
      timestamp: new Date(),
    });
  }

  public emitScanCompleted(folderPath: string, services: DiscoveredService[]): void {
    this.emit('scan:completed', {
      folderPath,
      services,
      timestamp: new Date(),
    });
  }

  public emitScanError(folderPath: string, error: Error): void {
    this.emit('scan:error', {
      folderPath,
      error,
      timestamp: new Date(),
    });
  }
}

// Export singleton instance
export const eventBus = EventBus.getInstance();

// Export types for convenience
// Types are already exported above 