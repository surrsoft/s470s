# CLAUDE.md

Этот файл содержит инструкции для Claude Code (claude.ai/code) при работе с кодом в этом репозитории.

## Разработка

Сборка не требуется. Для проверки изменений:
1. Открыть `chrome://extensions/` → включить режим разработчика → «Загрузить распакованное» → выбрать эту папку
2. После правок JS/CSS/HTML: нажать кнопку ↻ на странице расширений
3. Инспектировать popup: правый клик по иконке расширения → Inspect popup
4. Инспектировать side panel: открыть боковую панель → правый клик → Inspect

## Архитектура

Одностраничное Chrome-расширение (Manifest V3) — работает одновременно как popup и как side panel (`popup.html` проверяет `window.innerHeight > 550` и добавляет `body.side-panel`). Без фреймворка и бандлера.

### Поток данных

Весь state хранится в глобальных переменных `popup.js`:
- `notes` — плоский массив всех заметок (хранится в `chrome.storage.local`)
- `navStack` — `[{id, copyText}]` — текущий путь навигации; `[]` = корневой уровень
- `clipboard` — `{ sources: Map<id, isSymlink>, originParentId } | null` — буфер вырезанных заметок
- `selectMode` / `selectedNoteIds` — состояние режима выбора

`render()` — единственная функция перерисовки — всегда полностью перестраивает `notesList`. Вызывать после любой мутации состояния.

### Модель данных заметки

```js
{
  id,             // string — Date.now().toString(36) + случайный суффикс
  copyText,       // string — заголовок / текст для копирования
  description,    // string | null
  url,            // string | null
  parentId,       // string | null — основной родитель (null = корень)
  parentIdsOther, // string[] — родители-симлинки; '' означает корень
  isFastCopy,     // bool — клик копирует текст без навигации внутрь
  order,          // number
  createdAt,      // ms timestamp
  updatedAt,      // ms timestamp
  dateActual,     // ms timestamp
  deletedAt,      // ms timestamp | null — мягкое удаление (корзина)
}
```

### Иерархия и симлинки

Заметка отображается в месте `parentId` (основное) и во всех местах из `parentIdsOther` (симлинки). `''` в `parentIdsOther` означает симлинк на корневой уровень. `parentIdsOther` может прийти из хранилища как строка PostgreSQL-массива — всегда обращаться через `ensureArray(note.parentIdsOther)`.

### Ключевые функции

- `render()` — полная перерисовка; проверяет `navStack` чтобы решить что показывать
- `navigateInto(note)` — добавляет в `navStack`, вызывает `render()`
- `getCurrentParentId()` — возвращает `navStack[last].id` или `null`
- `collectDescendants(id)` — возвращает **массив** (не Set) из `id` + все потомки только по `parentId`
- `buildNavStackFor(note)` — строит полный navStack, поднимаясь по `parentId` до корня
- `scheduleSync(noteOrId, 'upsert'|'delete')` — отложенная синхронизация (1.5с); no-op если не аутентифицирован

### Корзина

`TRASH_ID = '__trash__'` — виртуальный ID папки корзины. При навигации в корзину: `navStack = [{id: '__trash__', copyText: 'Корзина'}]`. Удалённые заметки имеют заполненный `deletedAt` (ms timestamp). `render()` отфильтровывает их в обычном режиме и показывает только когда `navStack[0].id === TRASH_ID`.

### Синхронизация (`sync/supabase.js`)

Загружается перед `popup.js`. Экспортирует глобалы: `setConfig`, `setSession`, `fetchNotes`, `upsertNote`, `upsertNotesBatch`, `deleteNoteRemote`, `subscribeRealtime`. Маппинг колонок: camelCase JS ↔ snake_case Postgres (например `copyText` ↔ `copy_text`, `parentIdsOther` ↔ `parent_ids_other`).

## Соглашения

- **`isSimlink`** — намеренная опечатка во всём коде; не «исправлять» на `isSymlink`
- **F_F-маркеры** (например `// F8F`) в комментариях — ID фич, описанных в `README-dev.md`
- **CSS dark theme** — тёмные переопределения добавлять как `body.dark .selector { ... }` сразу после светлого блока или сгруппированно в конце секции
- **`collectDescendants` возвращает массив** — использовать `.includes()`, никогда не `.has()`
- После любого изменения состояния clipboard вызывать `render()` чтобы применить/убрать красную подсветку вырезанных заметок
- соглашение SG1G: после выполнения очередной задачи формировать сообщение коммита; если есть не закоммиченные другие задачи, то сообщение коммита должно учитывать все задачи 