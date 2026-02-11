// Разрешение конфликтов при синхронизации
import { SYNC_CONSTANTS } from '../utils/constants.js';

export class ConflictResolver {
  constructor(strategy = SYNC_CONSTANTS.CONFLICT_STRATEGIES.SHEETS_WINS) {
    this.strategy = strategy;
  }

  /**
   * Разрешить массив конфликтов
   * @param {Array} conflicts - Массив конфликтов вида { local, sheet }
   * @returns {Array} - Массив разрешённых изменений
   */
  async resolve(conflicts) {
    if (!conflicts || conflicts.length === 0) {
      return [];
    }

    const resolved = [];

    for (const conflict of conflicts) {
      const resolution = this.resolveConflict(conflict);
      resolved.push(resolution);
    }

    return resolved;
  }

  /**
   * Разрешить один конфликт
   * @param {Object} conflict - Конфликт { local, sheet }
   * @returns {Object} - Разрешение конфликта
   */
  resolveConflict(conflict) {
    const { local, sheet } = conflict;

    let winner;
    let winnerSource;

    switch (this.strategy) {
      case SYNC_CONSTANTS.CONFLICT_STRATEGIES.SHEETS_WINS:
        // Google Sheets имеет приоритет (как указано в требованиях)
        winner = sheet;
        winnerSource = 'sheet';
        break;

      case SYNC_CONSTANTS.CONFLICT_STRATEGIES.LOCAL_WINS:
        // Локальные данные имеют приоритет
        winner = local;
        winnerSource = 'local';
        break;

      case SYNC_CONSTANTS.CONFLICT_STRATEGIES.NEWEST_WINS:
        // Новейшие данные побеждают (по updatedAt)
        if (local.updatedAt > sheet.updatedAt) {
          winner = local;
          winnerSource = 'local';
        } else {
          winner = sheet;
          winnerSource = 'sheet';
        }
        break;

      default:
        // По умолчанию Sheets приоритетнее
        winner = sheet;
        winnerSource = 'sheet';
    }

    return {
      type: 'conflict_resolved',
      winner: winnerSource,
      note: winner,
      conflict: { local, sheet },
      strategy: this.strategy,
      timestamp: Date.now()
    };
  }

  /**
   * Определить, есть ли конфликт между двумя заметками
   * @param {Object} localNote - Локальная заметка
   * @param {Object} sheetNote - Заметка из Sheets
   * @returns {boolean} - true если есть конфликт
   */
  static hasConflict(localNote, sheetNote) {
    // Конфликт если обе заметки были изменены после последней синхронизации
    const localModified = localNote.updatedAt > (localNote.syncedAt || 0);
    const sheetModified = sheetNote.updatedAt > (localNote.syncedAt || 0);

    return localModified && sheetModified;
  }

  /**
   * Определить тип изменения
   * @param {Object} localNote - Локальная заметка
   * @param {Object} sheetNote - Заметка из Sheets
   * @returns {string} - Тип изменения: 'no_change', 'local_changed', 'sheet_changed', 'conflict'
   */
  static detectChangeType(localNote, sheetNote) {
    if (!localNote && !sheetNote) {
      return 'no_change';
    }

    if (!sheetNote) {
      return 'local_only';
    }

    if (!localNote) {
      return 'sheet_only';
    }

    const localModified = localNote.updatedAt > (localNote.syncedAt || 0);
    const sheetModified = sheetNote.updatedAt > (localNote.syncedAt || 0);

    if (localModified && sheetModified) {
      return 'conflict';
    }

    if (localModified) {
      return 'local_changed';
    }

    if (sheetModified) {
      return 'sheet_changed';
    }

    return 'no_change';
  }

  /**
   * Проверить, изменилась ли заметка
   * @param {Object} note1 - Первая заметка
   * @param {Object} note2 - Вторая заметка
   * @returns {boolean} - true если заметки отличаются
   */
  static hasChanged(note1, note2) {
    if (!note1 || !note2) return true;

    // Сравниваем основные поля
    return (
      note1.copyText !== note2.copyText ||
      note1.description !== note2.description ||
      note1.order !== note2.order
    );
  }

  /**
   * Объединить метаданные из обеих заметок
   * @param {Object} winner - Выигравшая заметка
   * @param {Object} loser - Проигравшая заметка
   * @returns {Object} - Заметка с объединёнными метаданными
   */
  static mergeMetadata(winner, loser) {
    return {
      ...winner,
      // Использовать наиболее раннюю дату создания
      createdAt: Math.min(winner.createdAt || Date.now(), loser.createdAt || Date.now()),
      // Использовать самую позднюю дату обновления
      updatedAt: Math.max(winner.updatedAt || 0, loser.updatedAt || 0),
      // Инкрементировать версию
      version: Math.max(winner.version || 1, loser.version || 1) + 1,
      // Отметить время синхронизации
      syncedAt: Date.now()
    };
  }
}
