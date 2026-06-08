import dotenv from 'dotenv';
import path from 'path';

export interface AppConfig {
  icloud: {
    email: string;
    password: string;
  };
  anthropic: {
    apiKey: string;
  };
  scanning: {
    intervalMinutes: number;
    emailStoragePath: string;
    analysisThreshold: number;
  };
  actions: {
    enableAutoDelete: boolean;
    enableAutoUnsubscribe: boolean;
    deleteConfidenceThreshold: number;
    unsubscribeConfidenceThreshold: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

export function loadConfig(): AppConfig {
  const config: AppConfig = {
    icloud: {
      email: process.env.ICLOUD_EMAIL || '',
      password: process.env.ICLOUD_PASSWORD || ''
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    },
    scanning: {
      intervalMinutes: parseInt(process.env.SCAN_INTERVAL_MINUTES || '60'),
      emailStoragePath: process.env.EMAIL_STORAGE_PATH || './data/emails.json',
      analysisThreshold: parseInt(process.env.ANALYSIS_THRESHOLD || '3')
    },
    actions: {
      enableAutoDelete: process.env.ENABLE_AUTO_DELETE === 'true',
      enableAutoUnsubscribe: process.env.ENABLE_AUTO_UNSUBSCRIBE === 'true',
      deleteConfidenceThreshold: parseFloat(process.env.DELETE_CONFIDENCE_THRESHOLD || '0.9'),
      unsubscribeConfidenceThreshold: parseFloat(process.env.UNSUBSCRIBE_CONFIDENCE_THRESHOLD || '0.85')
    },
    logging: {
      level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info'
    }
  };

  validateConfig(config);
  return config;
}

function validateConfig(config: AppConfig): void {
  if (!config.icloud.email) {
    throw new Error('ICLOUD_EMAIL environment variable is required');
  }
  if (!config.icloud.password) {
    throw new Error('ICLOUD_PASSWORD environment variable is required');
  }
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
}

export class Logger {
  private level: 'debug' | 'info' | 'warn' | 'error';
  private levels: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(level: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.level = level;
  }

  debug(message: string, data?: any): void {
    if (this.levels[this.level] <= 0) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }

  info(message: string, data?: any): void {
    if (this.levels[this.level] <= 1) {
      console.log(`[INFO] ${message}`, data || '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.levels[this.level] <= 2) {
      console.warn(`[WARN] ${message}`, data || '');
    }
  }

  error(message: string, error?: any): void {
    if (this.levels[this.level] <= 3) {
      console.error(`[ERROR] ${message}`, error || '');
    }
  }
}
