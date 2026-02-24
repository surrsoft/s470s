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
├── popup.js           # Основная логика + интеграция синхронизации
├── settings.html      # Страница настроек (Supabase + аутентификация)
├── settings.css       # Стили страницы настроек
├── settings.js        # Логика настроек и OTP-аутентификации
├── lib/
│   └── supabase.min.js  # Локальная копия Supabase JS SDK (UMD)
├── sync/
│   └── supabase.js    # Клиент Supabase, CRUD, Realtime-подписки
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
- **Host Permissions**: `https://*.supabase.co/*` — для API-запросов к Supabase
- **Хранилище**: Chrome Storage API (локальное)
- **Синхронизация**: Supabase (PostgreSQL + Realtime WebSocket), опционально

## Настройка Supabase (для разработки)

1. Создайте проект на [supabase.com](https://supabase.com)
2. Перейдите в **SQL Editor** и выполните:

```sql
create table notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  local_id     text not null,
  copy_text    text not null,
  description  text,
  "order"      integer not null default 0,
  created_at   bigint not null,
  updated_at   bigint not null,
  unique(user_id, local_id)
);

alter table notes enable row level security;

create policy "Users manage own notes" on notes
  for all using (auth.uid() = user_id);
```

3. В разделе **Authentication → Email** включите "Enable Email OTP" и отключите "Confirm email" (если нужен вход без подтверждения)
4. Скопируйте **Project URL** и **Anon Key** из **Settings → API**
5. Вставьте их в настройках расширения (кнопка ⚙)

## Требования

- Современный браузер на базе Chromium (Chrome, Edge, Brave и т.д.)

## Локальное тестирование

1. Внесите изменения в код
2. Перезагрузите расширение на странице расширений (кнопка ↻)
3. Для инспекции popup: правый клик по popup → Inspect
4. Для инспекции settings: откройте настройки через ⚙ → правый клик → Inspect

## UI-структура

### Popup (`popup.html`)

```
Хедер (sticky)
├── Левая часть: название "s470s" · точка синхронизации · кнопка ↻
└── Правая часть: ☾/☀ · A− · A+ · ⚙ · +

Форма (скрыта по умолчанию, открывается при добавлении/редактировании)
├── Поле: текст для копирования (обязательное)
├── Поле: описание (необязательное)
└── Кнопки: Save · Cancel

Список заметок (динамический)
└── Заметка (повторяется)
    ├── ⋮⋮  — drag & drop
    ├── Текст + описание  — клик копирует текст
    └── ✎ · ✕  — редактировать / удалить (видны при hover)

Пустое состояние (когда заметок нет)

Toast (fixed, снизу по центру) — появляется при копировании
```

### Settings (`settings.html`)

```
Хедер: "s470s Settings"

Секция "Supabase Connection"
├── Поле: Project URL
├── Поле: Anon Key
└── Кнопка Save · статусное сообщение

Секция "Account"
├── Состояние: не вошёл
│   ├── Шаг 1 — Email
│   │   ├── Поле: Email
│   │   └── Кнопка "Send code"
│   └── Шаг 2 — Код (показывается после отправки)
│       ├── Поле: 6-значный код
│       ├── Кнопка "Verify" · кнопка "Back"
│       └── статусное сообщение
└── Состояние: вошёл
    ├── ✓ email пользователя
    └── Кнопка "Sign out"

Секция "Sync"
├── Последняя синхронизация: дата/время
├── Кнопка "Sync now" · статусное сообщение
└── Раскрывающийся блок: SQL-схема таблицы notes
```

---

## Основные функции

### popup.js
- `loadNotes()` — загрузка заметок из хранилища
- `saveNotes()` — сохранение заметок в хранилище
- `render()` — отрисовка списка заметок
- `addNote()` — создание новой заметки
- `updateNote()` — обновление существующей заметки
- `deleteNote()` — удаление заметки
- `copyToClipboard()` — копирование текста в буфер обмена
- `loadFontSize()` — загрузка и применение сохранённого размера шрифта
- `applyFontSize()` — применение текущего размера к списку заметок
- `loadTheme()` — загрузка и применение сохранённой темы
- `applyTheme()` — применение текущей темы (light/dark) к body
- `serverRowToNote(row)` — конвертация строки Supabase в формат заметки
- `initSync()` — инициализация синхронизации при загрузке
- `runFullSync()` — полная двусторонняя синхронизация с Supabase
- `scheduleSync()` — отложенная отправка изменений (debounce 1.5с)
- Функции drag & drop для изменения порядка заметок

### sync/supabase.js
- `setConfig(config)` — установка конфигурации клиента
- `setSession(session)` — установка сессии аутентификации
- `signIn(email)` — отправка OTP-кода на email
- `verifyOtp(email, token)` — верификация кода, получение сессии
- `signOut()` — выход из аккаунта
- `fetchNotes()` — получение заметок из Supabase
- `upsertNote(note)` / `upsertNotesBatch(notes)` — сохранение заметок
- `deleteNote(localId)` — удаление заметки
- `subscribeRealtime(handlers)` — подписка на изменения в реальном времени
- `deleteNoteRemote(localId)` — удаление заметки из Supabase (переименовано из `deleteNote` во избежание конфликта с UI-функцией)
