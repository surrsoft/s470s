// Константы для синхронизации с Google Sheets
export const SYNC_CONSTANTS = {
  // API
  SHEETS_API_BASE: 'https://sheets.googleapis.com/v4/spreadsheets',
  OAUTH_SCOPES: ['https://www.googleapis.com/auth/spreadsheets'],

  // Timing
  MIN_SYNC_INTERVAL: 1000,        // 1 секунда минимум между синхронизациями
  AUTO_SYNC_DEBOUNCE: 2000,       // 2 секунды debounce для автосинхронизации
  OFFLINE_RETRY_INTERVAL: 60000,  // 1 минута для retry при офлайн

  // Limits
  MAX_RETRY_ATTEMPTS: 3,
  MAX_PENDING_CHANGES: 1000,
  INITIAL_RETRY_DELAY: 1000,      // 1 секунда начальная задержка для retry
  MAX_RETRY_DELAY: 10000,         // 10 секунд максимальная задержка
  RETRY_BACKOFF_FACTOR: 2,        // Множитель для exponential backoff

  // Storage keys
  STORAGE_KEYS: {
    NOTES: 'notes',
    SYNC_CONFIG: 'syncConfig',
    SYNC_STATE: 'syncState',
    SHEETS_CACHE: 'sheetsCache',
    ERROR_LOGS: 'errorLogs'
  },

  // Sync strategies
  CONFLICT_STRATEGIES: {
    SHEETS_WINS: 'sheets_wins',
    LOCAL_WINS: 'local_wins',
    NEWEST_WINS: 'newest_wins'
  },

  // Sync triggers
  SYNC_TRIGGERS: {
    MANUAL: 'manual',
    AUTO: 'auto',
    PERIODIC: 'periodic',
    RETRY: 'retry',
    STARTUP: 'startup'
  },

  // Error types
  ERROR_TYPES: {
    AUTH: 'AUTH_ERROR',
    NETWORK: 'NETWORK_ERROR',
    PERMISSION: 'PERMISSION_ERROR',
    QUOTA: 'QUOTA_ERROR',
    DATA: 'DATA_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR'
  },

  // Sync status
  SYNC_STATUS: {
    SUCCESS: 'success',
    ERROR: 'error',
    CONFLICT_RESOLVED: 'conflict_resolved',
    OFFLINE: 'offline',
    IN_PROGRESS: 'in_progress'
  }
};
