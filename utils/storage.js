// Утилиты для работы с chrome.storage
import { SYNC_CONSTANTS } from './constants.js';

export class StorageUtils {
  /**
   * Получить значение из chrome.storage.local
   */
  static async get(key, defaultValue = null) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [key]: defaultValue }, (data) => {
        resolve(data[key]);
      });
    });
  }

  /**
   * Сохранить значение в chrome.storage.local
   */
  static async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  /**
   * Удалить значение из chrome.storage.local
   */
  static async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  }

  /**
   * Очистить всё chrome.storage.local
   */
  static async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }

  // ===== Методы для работы с заметками =====

  /**
   * Получить все заметки
   */
  static async getNotes() {
    const notes = await this.get(SYNC_CONSTANTS.STORAGE_KEYS.NOTES, []);
    return notes.sort((a, b) => a.order - b.order);
  }

  /**
   * Сохранить заметки
   */
  static async setNotes(notes) {
    await this.set(SYNC_CONSTANTS.STORAGE_KEYS.NOTES, notes);
  }

  // ===== Методы для работы с конфигурацией синхронизации =====

  /**
   * Получить конфигурацию синхронизации
   */
  static async getSyncConfig() {
    return await this.get(SYNC_CONSTANTS.STORAGE_KEYS.SYNC_CONFIG, {
      enabled: false,
      spreadsheetId: null,
      sheetName: 's470s Notes',
      autoSync: true,
      periodicSync: false,
      periodicInterval: 15,
      googleAccountEmail: null,
      conflictStrategy: SYNC_CONSTANTS.CONFLICT_STRATEGIES.SHEETS_WINS
    });
  }

  /**
   * Установить конфигурацию синхронизации
   */
  static async setSyncConfig(config) {
    const current = await this.getSyncConfig();
    await this.set(SYNC_CONSTANTS.STORAGE_KEYS.SYNC_CONFIG, {
      ...current,
      ...config
    });
  }

  /**
   * Очистить конфигурацию синхронизации
   */
  static async clearSyncConfig() {
    await this.set(SYNC_CONSTANTS.STORAGE_KEYS.SYNC_CONFIG, {
      enabled: false,
      spreadsheetId: null,
      sheetName: 's470s Notes',
      autoSync: true,
      periodicSync: false,
      periodicInterval: 15,
      googleAccountEmail: null,
      conflictStrategy: SYNC_CONSTANTS.CONFLICT_STRATEGIES.SHEETS_WINS
    });
  }

  // ===== Методы для работы с состоянием синхронизации =====

  /**
   * Получить состояние синхронизации
   */
  static async getSyncState() {
    return await this.get(SYNC_CONSTANTS.STORAGE_KEYS.SYNC_STATE, {
      lastSyncTimestamp: null,
      lastSyncDirection: null,
      lastSyncStatus: null,
      isSyncing: false,
      pendingChanges: 0,
      errorMessage: null,
      lastConflictTime: null,
      conflictsResolved: 0
    });
  }

  /**
   * Обновить состояние синхронизации
   */
  static async updateSyncState(updates) {
    const current = await this.getSyncState();
    await this.set(SYNC_CONSTANTS.STORAGE_KEYS.SYNC_STATE, {
      ...current,
      ...updates
    });
  }

  /**
   * Сбросить состояние синхронизации
   */
  static async resetSyncState() {
    await this.set(SYNC_CONSTANTS.STORAGE_KEYS.SYNC_STATE, {
      lastSyncTimestamp: null,
      lastSyncDirection: null,
      lastSyncStatus: null,
      isSyncing: false,
      pendingChanges: 0,
      errorMessage: null,
      lastConflictTime: null,
      conflictsResolved: 0
    });
  }

  // ===== Методы для работы с кэшем =====

  /**
   * Получить кэш данных из Sheets
   */
  static async getSheetsCache() {
    return await this.get(SYNC_CONSTANTS.STORAGE_KEYS.SHEETS_CACHE, {
      timestamp: null,
      data: [],
      etag: null
    });
  }

  /**
   * Установить кэш данных из Sheets
   */
  static async setSheetsCache(data, etag = null) {
    await this.set(SYNC_CONSTANTS.STORAGE_KEYS.SHEETS_CACHE, {
      timestamp: Date.now(),
      data,
      etag
    });
  }

  /**
   * Очистить кэш
   */
  static async clearSheetsCache() {
    await this.set(SYNC_CONSTANTS.STORAGE_KEYS.SHEETS_CACHE, {
      timestamp: null,
      data: [],
      etag: null
    });
  }

  // ===== Методы для работы с логами ошибок =====

  /**
   * Добавить лог ошибки
   */
  static async logError(error, context = {}) {
    const logs = await this.get(SYNC_CONSTANTS.STORAGE_KEYS.ERROR_LOGS, []);

    logs.push({
      timestamp: Date.now(),
      error: error.toString(),
      message: error.message,
      stack: error.stack,
      context
    });

    // Хранить только последние 50 ошибок
    const trimmedLogs = logs.slice(-50);

    await this.set(SYNC_CONSTANTS.STORAGE_KEYS.ERROR_LOGS, trimmedLogs);
  }

  /**
   * Получить логи ошибок
   */
  static async getErrorLogs() {
    return await this.get(SYNC_CONSTANTS.STORAGE_KEYS.ERROR_LOGS, []);
  }

  /**
   * Очистить логи ошибок
   */
  static async clearErrorLogs() {
    await this.set(SYNC_CONSTANTS.STORAGE_KEYS.ERROR_LOGS, []);
  }
}
