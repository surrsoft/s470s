// API обертка для работы с Google Sheets API v4
import { SYNC_CONSTANTS } from '../utils/constants.js';

export class GoogleSheetsAPI {
  constructor() {
    this.baseUrl = SYNC_CONSTANTS.SHEETS_API_BASE;
    this.token = null;
  }

  /**
   * Получить токен авторизации через chrome.identity
   */
  async getAuthToken(interactive = true) {
    if (this.token && !interactive) return this.token;

    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!token) {
          reject(new Error('Failed to get auth token'));
        } else {
          this.token = token;
          resolve(token);
        }
      });
    });
  }

  /**
   * Отозвать токен авторизации
   */
  async revokeAuthToken() {
    if (!this.token) return;

    const tokenToRevoke = this.token;

    return new Promise((resolve, reject) => {
      chrome.identity.removeCachedAuthToken({ token: tokenToRevoke }, () => {
        fetch(`https://accounts.google.com/o/oauth2/revoke?token=${tokenToRevoke}`)
          .then(() => {
            this.token = null;
            resolve();
          })
          .catch(reject);
      });
    });
  }

  /**
   * Создать новую таблицу
   */
  async createSpreadsheet(title = 's470s Notes') {
    const token = await this.getAuthToken();

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: title
        },
        sheets: [{
          properties: {
            title: 's470s Notes',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create spreadsheet: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Инициализировать заголовки
    await this.initializeHeaders(data.spreadsheetId);

    return data;
  }

  /**
   * Инициализировать заголовки в таблице
   */
  async initializeHeaders(spreadsheetId, sheetName = 's470s Notes') {
    const token = await this.getAuthToken();
    const range = `${sheetName}!A1:G1`;

    const response = await fetch(
      `${this.baseUrl}/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [['ID', 'Copy Text', 'Description', 'Order', 'Created At', 'Updated At', 'Version']]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to initialize headers: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Прочитать все заметки из таблицы
   */
  async readNotes(spreadsheetId, sheetName = 's470s Notes') {
    const token = await this.getAuthToken();
    const range = `${sheetName}!A2:G`;  // Пропускаем заголовок

    const response = await fetch(
      `${this.baseUrl}/${spreadsheetId}/values/${range}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to read notes: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.values || data.values.length === 0) {
      return [];
    }

    // Преобразовать строки в объекты заметок
    return data.values.map((row, index) => ({
      id: row[0] || '',
      copyText: row[1] || '',
      description: row[2] || '',
      order: parseInt(row[3]) || 0,
      createdAt: parseInt(row[4]) || Date.now(),
      updatedAt: parseInt(row[5]) || Date.now(),
      version: parseInt(row[6]) || 1,
      sheetRowIndex: index + 2  // +2 потому что строка 1 это заголовок, индексы с 1
    }));
  }

  /**
   * Записать все заметки в таблицу (полная перезапись)
   */
  async writeNotes(spreadsheetId, notes, sheetName = 's470s Notes') {
    const token = await this.getAuthToken();

    // Сортировка по order
    const sortedNotes = [...notes].sort((a, b) => a.order - b.order);

    // Преобразовать в формат строк
    const values = sortedNotes.map(note => [
      note.id,
      note.copyText,
      note.description || '',
      note.order,
      note.createdAt,
      note.updatedAt || Date.now(),
      note.version || 1
    ]);

    // Очистить все данные кроме заголовка
    await this.clearRange(spreadsheetId, `${sheetName}!A2:G`, token);

    // Записать новые данные
    const range = `${sheetName}!A2`;

    const response = await fetch(
      `${this.baseUrl}/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to write notes: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Обновить одну заметку
   */
  async updateNote(spreadsheetId, note, sheetName = 's470s Notes') {
    const token = await this.getAuthToken();

    if (!note.sheetRowIndex) {
      throw new Error('Note must have sheetRowIndex to update');
    }

    const range = `${sheetName}!A${note.sheetRowIndex}:G${note.sheetRowIndex}`;

    const values = [[
      note.id,
      note.copyText,
      note.description || '',
      note.order,
      note.createdAt,
      Date.now(), // Обновляем updatedAt
      (note.version || 1) + 1 // Инкрементируем версию
    ]];

    const response = await fetch(
      `${this.baseUrl}/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update note: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Добавить новую заметку в конец
   */
  async appendNote(spreadsheetId, note, sheetName = 's470s Notes') {
    const token = await this.getAuthToken();
    const range = `${sheetName}!A:G`;

    const values = [[
      note.id,
      note.copyText,
      note.description || '',
      note.order,
      note.createdAt,
      note.updatedAt || Date.now(),
      note.version || 1
    ]];

    const response = await fetch(
      `${this.baseUrl}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to append note: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Удалить заметку (удалить строку)
   */
  async deleteNote(spreadsheetId, rowIndex, sheetName = 's470s Notes') {
    const token = await this.getAuthToken();

    // Получить sheetId из имени
    const sheetId = await this.getSheetId(spreadsheetId, sheetName);

    const response = await fetch(
      `${this.baseUrl}/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,  // 0-based
                endIndex: rowIndex
              }
            }
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete note: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Получить ID листа (sheetId) по имени
   */
  async getSheetId(spreadsheetId, sheetName) {
    const token = await this.getAuthToken();

    const response = await fetch(
      `${this.baseUrl}/${spreadsheetId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get spreadsheet metadata: ${response.statusText}`);
    }

    const data = await response.json();
    const sheet = data.sheets.find(s => s.properties.title === sheetName);

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    return sheet.properties.sheetId;
  }

  /**
   * Очистить диапазон ячеек
   */
  async clearRange(spreadsheetId, range, token) {
    if (!token) {
      token = await this.getAuthToken();
    }

    const response = await fetch(
      `${this.baseUrl}/${spreadsheetId}/values/${range}:clear`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to clear range: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Проверить доступ к таблице
   */
  async validateSpreadsheet(spreadsheetId) {
    try {
      const token = await this.getAuthToken(false);
      const response = await fetch(
        `${this.baseUrl}/${spreadsheetId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
