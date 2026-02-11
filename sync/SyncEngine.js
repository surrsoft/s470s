// Движок двусторонней синхронизации
import { GoogleSheetsAPI } from './GoogleSheetsAPI.js';
import { SyncStateManager } from './SyncStateManager.js';
import { ConflictResolver } from './ConflictResolver.js';
import { StorageUtils } from '../utils/storage.js';
import { SYNC_CONSTANTS } from '../utils/constants.js';

export class SyncEngine {
  constructor(sheetsAPI = null, stateManager = null) {
    this.sheetsAPI = sheetsAPI || new GoogleSheetsAPI();
    this.stateManager = stateManager || new SyncStateManager();
    this.conflictResolver = new ConflictResolver();
    this.debounceTimer = null;
  }

  /**
   * Главная функция синхронизации
   */
  async synchronize(trigger = SYNC_CONSTANTS.SYNC_TRIGGERS.MANUAL) {
    console.log(`Starting sync (trigger: ${trigger})`);

    try {
      // 1. Проверка предварительных условий
      const canSyncResult = await this.stateManager.canSync();
      if (!canSyncResult.canSync) {
        console.log(`Cannot sync: ${canSyncResult.reason}`);
        return { success: false, reason: canSyncResult.reason };
      }

      // Отметить начало синхронизации
      await this.stateManager.markAsSyncing(true);

      // 2. Получение данных
      const localNotes = await this.getLocalNotes();
      const sheetNotes = await this.getSheetNotes();

      console.log(`Local notes: ${localNotes.length}, Sheet notes: ${sheetNotes.length}`);

      // 3. Определение изменений
      const changes = this.detectChanges(localNotes, sheetNotes);

      console.log('Detected changes:', {
        localOnly: changes.localOnly.length,
        sheetOnly: changes.sheetOnly.length,
        conflicts: changes.conflicts.length,
        toUpload: changes.toUpload.length,
        toDownload: changes.toDownload.length
      });

      // 4. Разрешение конфликтов
      const resolvedConflicts = await this.conflictResolver.resolve(changes.conflicts);

      if (resolvedConflicts.length > 0) {
        await this.stateManager.recordConflictResolution();
        console.log(`Resolved ${resolvedConflicts.length} conflicts`);
      }

      // 5. Применение изменений
      await this.applyChanges(changes, resolvedConflicts);

      // 6. Обновление состояния
      await this.stateManager.updateSyncState(SYNC_CONSTANTS.SYNC_STATUS.SUCCESS);
      await this.stateManager.setPendingChanges(0);
      await this.stateManager.markAsSyncing(false);

      console.log('Sync completed successfully');

      return {
        success: true,
        changes: {
          uploaded: changes.localOnly.length + changes.toUpload.length,
          downloaded: changes.sheetOnly.length + changes.toDownload.length,
          conflicts: resolvedConflicts.length
        }
      };

    } catch (error) {
      console.error('Sync error:', error);

      await this.stateManager.updateSyncState(
        SYNC_CONSTANTS.SYNC_STATUS.ERROR,
        error.message
      );
      await this.stateManager.markAsSyncing(false);

      // Логировать ошибку
      await StorageUtils.logError(error, { trigger, source: 'SyncEngine' });

      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизация с debounce для автоматических вызовов
   */
  async syncWithDebounce(trigger = SYNC_CONSTANTS.SYNC_TRIGGERS.AUTO) {
    // Отменить предыдущий таймер
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Установить новый таймер
    this.debounceTimer = setTimeout(async () => {
      await this.synchronize(trigger);
      this.debounceTimer = null;
    }, SYNC_CONSTANTS.AUTO_SYNC_DEBOUNCE);
  }

  /**
   * Получить локальные заметки
   */
  async getLocalNotes() {
    return await StorageUtils.getNotes();
  }

  /**
   * Получить заметки из Google Sheets
   */
  async getSheetNotes() {
    const config = await this.stateManager.getSyncConfig();

    if (!config.spreadsheetId) {
      throw new Error('Spreadsheet ID not configured');
    }

    try {
      const notes = await this.sheetsAPI.readNotes(
        config.spreadsheetId,
        config.sheetName
      );

      // Сохранить в кэш
      await StorageUtils.setSheetsCache(notes);

      return notes;

    } catch (error) {
      // При ошибке попробовать использовать кэш
      console.warn('Failed to read from Sheets, using cache:', error);

      const cache = await StorageUtils.getSheetsCache();
      if (cache.data && cache.data.length > 0) {
        console.log('Using cached data');
        return cache.data;
      }

      throw error;
    }
  }

  /**
   * Определить изменения между локальными и удалёнными заметками
   */
  detectChanges(localNotes, sheetNotes) {
    const changes = {
      localOnly: [],      // Новые локальные заметки (нужно загрузить в Sheets)
      sheetOnly: [],      // Новые заметки из Sheets (нужно скачать)
      conflicts: [],      // Конфликты (изменены с обеих сторон)
      toUpload: [],       // Заметки для загрузки (изменены локально)
      toDownload: [],     // Заметки для скачивания (изменены в Sheets)
      unchanged: []       // Не изменённые заметки
    };

    // Индекс для быстрого поиска
    const localMap = new Map(localNotes.map(n => [n.id, n]));
    const sheetMap = new Map(sheetNotes.map(n => [n.id, n]));

    // Анализ локальных заметок
    for (const local of localNotes) {
      const sheet = sheetMap.get(local.id);

      if (!sheet) {
        // Заметка только локально
        if (local.sheetRowIndex === null || local.sheetRowIndex === undefined) {
          changes.localOnly.push(local);
        } else {
          // Была в Sheet, но удалена - в этом случае удаляем и локально
          // (так как Sheets приоритетнее)
          changes.toDownload.push({ type: 'delete', note: local });
        }
      } else {
        // Заметка есть в обеих местах - проверяем timestamps
        const changeType = ConflictResolver.detectChangeType(local, sheet);

        switch (changeType) {
          case 'conflict':
            changes.conflicts.push({ local, sheet });
            break;

          case 'local_changed':
            changes.toUpload.push(local);
            break;

          case 'sheet_changed':
            changes.toDownload.push(sheet);
            break;

          case 'no_change':
            changes.unchanged.push(local);
            break;
        }
      }
    }

    // Анализ заметок из Sheets (которых нет локально)
    for (const sheet of sheetNotes) {
      if (!localMap.has(sheet.id)) {
        changes.sheetOnly.push(sheet);
      }
    }

    return changes;
  }

  /**
   * Применить изменения
   */
  async applyChanges(changes, resolvedConflicts) {
    const config = await this.stateManager.getSyncConfig();
    const localNotes = await this.getLocalNotes();
    const localMap = new Map(localNotes.map(n => [n.id, n]));

    // 1. Применить разрешённые конфликты
    for (const resolution of resolvedConflicts) {
      const { winner, note } = resolution;

      if (winner === 'sheet') {
        // Sheets версия побеждает - обновить локально
        const localNote = localMap.get(note.id);
        if (localNote) {
          Object.assign(localNote, {
            ...note,
            syncedAt: Date.now()
          });
        }
      } else {
        // Локальная версия побеждает - обновить в Sheets
        await this.sheetsAPI.updateNote(
          config.spreadsheetId,
          note,
          config.sheetName
        );
        note.syncedAt = Date.now();
      }
    }

    // 2. Загрузить новые локальные заметки в Sheets
    for (const note of changes.localOnly) {
      await this.sheetsAPI.appendNote(
        config.spreadsheetId,
        note,
        config.sheetName
      );
      note.syncedAt = Date.now();
    }

    // 3. Скачать новые заметки из Sheets
    for (const note of changes.sheetOnly) {
      note.syncedAt = Date.now();
      localNotes.push(note);
      localMap.set(note.id, note);
    }

    // 4. Загрузить изменённые локальные заметки
    for (const note of changes.toUpload) {
      if (note.sheetRowIndex) {
        await this.sheetsAPI.updateNote(
          config.spreadsheetId,
          note,
          config.sheetName
        );
      } else {
        await this.sheetsAPI.appendNote(
          config.spreadsheetId,
          note,
          config.sheetName
        );
      }
      note.syncedAt = Date.now();
    }

    // 5. Скачать изменённые заметки из Sheets
    for (const item of changes.toDownload) {
      if (item.type === 'delete') {
        // Удалить локально
        const index = localNotes.findIndex(n => n.id === item.note.id);
        if (index !== -1) {
          localNotes.splice(index, 1);
        }
        localMap.delete(item.note.id);
      } else {
        // Обновить локально
        const localNote = localMap.get(item.id);
        if (localNote) {
          Object.assign(localNote, {
            ...item,
            syncedAt: Date.now()
          });
        }
      }
    }

    // 6. Сохранить обновлённые локальные заметки
    await StorageUtils.setNotes(localNotes);
  }

  /**
   * Проверить, можно ли синхронизировать (с проверкой сети)
   */
  async canSyncOnline() {
    if (!navigator.onLine) {
      return { canSync: false, reason: 'Offline' };
    }

    return await this.stateManager.canSync();
  }
}
