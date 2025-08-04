import winston from 'winston';
import path from 'path';
import os from 'os';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = (): string => {
  const env = process.env['NODE_ENV'] || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info['timestamp']} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(os.homedir(), '.runbar', 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(os.homedir(), '.runbar', 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Create a stream object for Morgan (HTTP logging)
export const stream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

// Export logger instance
export default logger;

// Export convenience methods
export const logError = (message: string, error?: Error): void => {
  logger.error(message, { error: error?.stack });
};

export const logWarn = (message: string, meta?: unknown): void => {
  logger.warn(message, meta);
};

export const logInfo = (message: string, meta?: unknown): void => {
  logger.info(message, meta);
};

export const logDebug = (message: string, meta?: unknown): void => {
  logger.debug(message, meta);
};

// Service-specific logging
export const createServiceLogger = (serviceName: string) => ({
  error: (message: string, error?: Error): void => {
    logger.error(`[${serviceName}] ${message}`, { error: error?.stack });
  },
  warn: (message: string, meta?: unknown): void => {
    logger.warn(`[${serviceName}] ${message}`, meta);
  },
  info: (message: string, meta?: unknown): void => {
    logger.info(`[${serviceName}] ${message}`, meta);
  },
  debug: (message: string, meta?: unknown): void => {
    logger.debug(`[${serviceName}] ${message}`, meta);
  },
}); 