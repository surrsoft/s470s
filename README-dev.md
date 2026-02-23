# s470s — Developer Guide

## Установка для разработки

1. Склонируйте или скачайте этот репозиторий
2. Откройте Chrome/Edge и перейдите на страницу расширений:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Включите "Режим разработчика" (Developer mode)
4. Нажмите "Загрузить распакованное расширение" (Load unpacked)
5. Выберите папку с расширением

## Структура проекта

```
s470s/
├── manifest.json      # Конфигурация расширения
├── popup.html         # HTML-разметка всплывающего окна
├── popup.css          # Стили интерфейса
├── popup.js           # Основная логика приложения
├── background.js      # Service Worker (синхронизация)
├── settings.html      # Страница настроек синхронизации
├── settings.css       # Стили настроек
├── settings.js        # Логика настроек
├── sync/              # Модули синхронизации с Google Sheets
│   ├── GoogleSheetsAPI.js    # Обёртка над Google Sheets API v4
│   ├── SyncEngine.js         # Движок двусторонней синхронизации
│   ├── SyncStateManager.js   # Управление состоянием синхронизации
│   └── ConflictResolver.js   # Разрешение конфликтов
├── utils/             # Утилиты
│   ├── constants.js   # Константы (API endpoints, storage keys и т.д.)
│   └── storage.js     # Обёртки над chrome.storage
├── icons/             # Иконки расширения
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # Документация для пользователей
```

## Технические детали

- **Manifest Version**: 3
- **Permissions**:
  - `storage` — для сохранения заметок
  - `clipboardWrite` — для копирования в буфер обмена
  - `identity` — для OAuth авторизации Google
  - `alarms` — для периодической синхронизации
- **Хранилище**: Chrome Storage API (локальное)

## Требования

- Современный браузер на базе Chromium (Chrome, Edge, Brave и т.д.)

## Локальное тестирование

1. Внесите изменения в код
2. Перезагрузите расширение на странице расширений (кнопка ↻)
3. Для инспекции popup: правый клик по popup → Inspect
4. Для инспекции service worker: `chrome://extensions/` → ссылка "service worker"

## Основные функции (popup.js)

- `loadNotes()` — загрузка заметок из хранилища
- `saveNotes()` — сохранение заметок в хранилище
- `render()` — отрисовка списка заметок
- `addNote()` — создание новой заметки
- `updateNote()` — обновление существующей заметки
- `deleteNote()` — удаление заметки
- `copyToClipboard()` — копирование текста в буфер обмена
- Функции drag & drop для изменения порядка заметок

## Синхронизация с Google Sheets

Расширение поддерживает двустороннюю синхронизацию заметок с Google Sheets через OAuth 2.0.

### Настройка OAuth

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте проект и включите **Google Sheets API**
3. Создайте OAuth 2.0 Client ID (тип: Chrome Extension)
4. Укажите Extension ID в поле Application ID
5. Вставьте полученный Client ID в `manifest.json`:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
     "scopes": ["https://www.googleapis.com/auth/spreadsheets"]
   }
   ```

### Формат данных в Google Sheets

Каждая заметка хранится как строка с колонками:

| A: ID | B: Copy Text | C: Description | D: Order | E: Created At | F: Updated At | G: Version |

### Алгоритм синхронизации

1. Получить локальные заметки + заметки из Sheets
2. Определить изменения (новые, изменённые, удалённые, конфликты)
3. Разрешить конфликты (по умолчанию: Sheets имеет приоритет)
4. Применить изменения в обе стороны
5. Обновить метаданные (`syncedAt`, `sheetRowIndex`, `version`)

### Триггеры синхронизации

- **Автоматическая** — при каждом изменении заметки (с debounce 2 сек)
- **Ручная** — кнопка ↻ в popup
- **Периодическая** — опционально через Chrome Alarms API
