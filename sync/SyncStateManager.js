// Управление состоянием синхронизации
import { StorageUtils } from '../utils/storage.js';
import { SYNC_CONSTANTS } from '../utils/constants.js';

export class SyncStateManager {
  /**
   * Инициализировать состояние синхронизации
   */
  async initialize() {
    const state = await StorageUtils.getSyncState();

    // Если было активное состояние синхронизации при закрытии, сбросить его
    if (state.isSyncing) {
      await StorageUtils.updateSyncState({
        isSyncing: false
      });
    }
  }

  /**
   * Получить конфигурацию синхронизации
   */
  async getSyncConfig() {
    return await StorageUtils.getSyncConfig();
  }

  /**
   * Установить конфигурацию синхронизации
   */
  async setSyncConfig(config) {
    await StorageUtils.setSyncConfig(config);
  }

  /**
   * Очистить конфигурацию синхронизации
   */
  async clearSyncConfig() {
    await StorageUtils.clearSyncConfig();
    await StorageUtils.resetSyncState();
    await this.clearBadge();
  }

  /**
   * Получить состояние синхронизации
   */
  async getSyncState() {
    return await StorageUtils.getSyncState();
  }

  /**
   * Обновить состояние синхронизации
   */
  async updateSyncState(status, errorMessage = null) {
    const updates = {
      lastSyncTimestamp: Date.now(),
      lastSyncStatus: status,
      errorMessage: errorMessage
    };

    await StorageUtils.updateSyncState(updates);

    // Обновить badge при ошибке
    if (status === SYNC_CONSTANTS.SYNC_STATUS.ERROR && errorMessage) {
      console.error('Sync error:', errorMessage);
    }
  }

  /**
   * Отметить начало синхронизации
   */
  async markAsSyncing(isSyncing = true) {
    await StorageUtils.updateSyncState({ isSyncing });
  }

  /**
   * Установить количество несинхронизированных изменений
   */
  async setPendingChanges(count) {
    await StorageUtils.updateSyncState({ pendingChanges: count });

    // Обновить badge на иконке расширения
    if (count > 0) {
      try {
        await chrome.action.setBadgeText({ text: count.toString() });
        await chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
      } catch (error) {
        console.warn('Failed to set badge:', error);
      }
    } else {
      await this.clearBadge();
    }
  }

  /**
   * Увеличить счетчик несинхронизированных изменений
   */
  async incrementPendingChanges(delta = 1) {
    const state = await this.getSyncState();
    const newCount = (state.pendingChanges || 0) + delta;
    await this.setPendingChanges(Math.max(0, newCount));
  }

  /**
   * Очистить badge
   */
  async clearBadge() {
    try {
      await chrome.action.setBadgeText({ text: '' });
    } catch (error) {
      console.warn('Failed to clear badge:', error);
    }
  }

  /**
   * Временно приостановить автосинхронизацию
   */
  async pauseAutoSync(durationMinutes = 30) {
    const config = await this.getSyncConfig();

    // Сохранить текущее состояние autoSync
    const originalAutoSync = config.autoSync;

    // Отключить автосинхронизацию
    await this.setSyncConfig({ autoSync: false });

    // Установить таймер для восстановления
    setTimeout(async () => {
      await this.setSyncConfig({ autoSync: originalAutoSync });
      console.log('Auto-sync resumed after pause');
    }, durationMinutes * 60 * 1000);

    console.log(`Auto-sync paused for ${durationMinutes} minutes`);
  }

  /**
   * Записать информацию о разрешённом конфликте
   */
  async recordConflictResolution() {
    const state = await this.getSyncState();

    await StorageUtils.updateSyncState({
      lastConflictTime: Date.now(),
      conflictsResolved: (state.conflictsResolved || 0) + 1
    });
  }

  /**
   * Проверить, можно ли синхронизировать
   */
  async canSync() {
    const config = await this.getSyncConfig();
    const state = await this.getSyncState();

    // Проверить, включена ли синхронизация
    if (!config.enabled || !config.spreadsheetId) {
      return { canSync: false, reason: 'Sync not configured' };
    }

    // Проверить, не идёт ли уже синхронизация
    if (state.isSyncing) {
      return { canSync: false, reason: 'Sync already in progress' };
    }

    // Проверить минимальный интервал между синхронизациями
    if (state.lastSyncTimestamp) {
      const timeSinceLastSync = Date.now() - state.lastSyncTimestamp;
      if (timeSinceLastSync < SYNC_CONSTANTS.MIN_SYNC_INTERVAL) {
        return {
          canSync: false,
          reason: 'Too soon since last sync',
          waitMs: SYNC_CONSTANTS.MIN_SYNC_INTERVAL - timeSinceLastSync
        };
      }
    }

    return { canSync: true };
  }

  /**
   * Получить статистику синхронизации
   */
  async getSyncStats() {
    const state = await this.getSyncState();
    const config = await this.getSyncConfig();

    return {
      enabled: config.enabled,
      spreadsheetId: config.spreadsheetId,
      lastSyncTime: state.lastSyncTimestamp
        ? new Date(state.lastSyncTimestamp).toLocaleString()
        : 'Never',
      status: state.lastSyncStatus || 'Unknown',
      pendingChanges: state.pendingChanges || 0,
      conflictsResolved: state.conflictsResolved || 0,
      errorMessage: state.errorMessage
    };
  }
}
