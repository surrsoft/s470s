// Background Service Worker для Manifest V3
import { GoogleSheetsAPI } from './sync/GoogleSheetsAPI.js';
import { SyncEngine } from './sync/SyncEngine.js';
import { SyncStateManager } from './sync/SyncStateManager.js';
import { StorageUtils } from './utils/storage.js';

const sheetsAPI = new GoogleSheetsAPI();
const syncEngine = new SyncEngine(sheetsAPI);
const stateManager = new SyncStateManager();

console.log('s470s background service worker started');

// ===== Установка расширения =====
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  // Инициализация состояния
  await stateManager.initialize();

  if (details.reason === 'install') {
    // Первая установка
    console.log('First install - initializing...');
  } else if (details.reason === 'update') {
    // Обновление расширения
    console.log('Extension updated');
  }
});

// ===== Обработка сообщений от popup и settings =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.action);

  // Обработка асинхронных сообщений
  handleMessage(request, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });

  // Вернуть true для асинхронного ответа
  return true;
});

async function handleMessage(request, sender) {
  switch (request.action) {
    // ===== OAuth авторизация =====
    case 'AUTH_GOOGLE': {
      const token = await sheetsAPI.getAuthToken(true);

      // Получить email пользователя (опционально)
      let email = null;
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        email = data.email;
      } catch (error) {
        console.warn('Failed to get user email:', error);
      }

      // Сохранить email в конфигурации
      if (email) {
        await stateManager.setSyncConfig({ googleAccountEmail: email });
      }

      return { success: true, token, email };
    }

    // ===== Отзыв авторизации =====
    case 'REVOKE_AUTH': {
      await sheetsAPI.revokeAuthToken();
      await stateManager.clearSyncConfig();
      return { success: true };
    }

    // ===== Создание новой таблицы =====
    case 'CREATE_SPREADSHEET': {
      const spreadsheet = await sheetsAPI.createSpreadsheet(request.title || 's470s Notes');

      await stateManager.setSyncConfig({
        enabled: true,
        spreadsheetId: spreadsheet.spreadsheetId,
        sheetName: request.sheetName || 's470s Notes',
        autoSync: true
      });

      return {
        success: true,
        spreadsheet: {
          id: spreadsheet.spreadsheetId,
          url: spreadsheet.spreadsheetUrl,
          title: spreadsheet.properties.title
        }
      };
    }

    // ===== Валидация существующей таблицы =====
    case 'VALIDATE_SPREADSHEET': {
      const valid = await sheetsAPI.validateSpreadsheet(request.spreadsheetId);

      if (valid) {
        await stateManager.setSyncConfig({
          enabled: true,
          spreadsheetId: request.spreadsheetId,
          sheetName: request.sheetName || 's470s Notes'
        });
      }

      return { success: true, valid };
    }

    // ===== Ручная синхронизация =====
    case 'SYNC_NOW': {
      const result = await syncEngine.synchronize('manual');
      const state = await stateManager.getSyncState();
      return { success: result.success, state, result };
    }

    // ===== Получить состояние синхронизации =====
    case 'GET_SYNC_STATE': {
      const state = await stateManager.getSyncState();
      const config = await stateManager.getSyncConfig();
      const stats = await stateManager.getSyncStats();

      return {
        success: true,
        state,
        config,
        stats
      };
    }

    // ===== Сохранить конфигурацию синхронизации =====
    case 'SAVE_SYNC_CONFIG': {
      await stateManager.setSyncConfig(request.config);

      // Обновить периодическую синхронизацию
      if (request.config.periodicSync !== undefined) {
        await updatePeriodicSync();
      }

      return { success: true };
    }

    // ===== Изменение заметки (автосинхронизация) =====
    case 'NOTE_CHANGED': {
      const config = await stateManager.getSyncConfig();

      if (config.enabled && config.autoSync) {
        // Синхронизация с debounce
        syncEngine.syncWithDebounce('auto').catch((error) => {
          console.error('Auto-sync failed:', error);
        });
      } else {
        // Просто увеличить счётчик несинхронизированных изменений
        await stateManager.incrementPendingChanges();
      }

      return { success: true };
    }

    // ===== Сброс конфигурации синхронизации =====
    case 'RESET_SYNC': {
      await stateManager.clearSyncConfig();
      await StorageUtils.clearSheetsCache();
      await chrome.alarms.clear('periodic-sync');
      return { success: true };
    }

    default:
      return { success: false, error: 'Unknown action: ' + request.action };
  }
}

// ===== Периодическая синхронизация через Alarms API =====
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'periodic-sync') {
    console.log('Periodic sync triggered');

    const config = await stateManager.getSyncConfig();

    if (config.enabled && config.periodicSync) {
      try {
        await syncEngine.synchronize('periodic');
      } catch (error) {
        console.error('Periodic sync failed:', error);
      }
    }
  }
});

// ===== Обновление настроек периодической синхронизации =====
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local' && changes.syncConfig) {
    await updatePeriodicSync();
  }
});

async function updatePeriodicSync() {
  const config = await stateManager.getSyncConfig();

  // Очистить существующий alarm
  await chrome.alarms.clear('periodic-sync');

  // Установить новый alarm если периодическая синхронизация включена
  if (config.enabled && config.periodicSync && config.periodicInterval) {
    await chrome.alarms.create('periodic-sync', {
      periodInMinutes: config.periodicInterval
    });

    console.log(`Periodic sync enabled: every ${config.periodicInterval} minutes`);
  } else {
    console.log('Periodic sync disabled');
  }
}

// Инициализировать периодическую синхронизацию при запуске
updatePeriodicSync();
