# s470s — Web Application

s470s работает одновременно как Chrome-расширение и как веб-приложение из одной кодовой базы.

## Как это работает

Весь код (`popup.js`, `popup.css`, `settings.js`) общий. Для браузерного контекста добавлен тонкий polyfill (`chrome-polyfill.js`), который подменяет Chrome-специфичные API (`chrome.storage.local`, `chrome.runtime`) аналогами на основе `localStorage`.

```
Chrome-расширение  →  popup.html + popup.js + chrome storage
Веб-приложение     →  index.html + popup.js + localStorage (через polyfill)
```

## Запуск локально

Требуется HTTP-сервер (не `file://`):

```bash
npx serve .
# или
python3 -m http.server
```

Открыть: `http://localhost:3000/index.html`

## Хостинг на GitHub Pages

1. Репозиторий → Settings → Pages → Source: `main` branch, папка `/` (root)
2. URL: `https://<user>.github.io/<repo>/`

### Настройка Supabase для веб-приложения

В Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://<user>.github.io/<repo>/`
- **Redirect URLs**: добавить тот же URL

## Структура файлов

```
index.html          — точка входа для веб-приложения
chrome-polyfill.js  — polyfill Chrome API → localStorage
popup.html          — точка входа для Chrome-расширения (не изменяется)
popup.js            — общая логика (используется обоими)
popup.css           — общие стили (используются обоими)
settings.html       — страница настроек (работает в обоих контекстах)
settings.js         — логика настроек (используется обоими)
```

## Хранилище данных

| Контекст          | Хранилище             | Ключи                        |
|-------------------|-----------------------|------------------------------|
| Chrome-расширение | `chrome.storage.local`| `notes`, `theme`, `fontSize`, … |
| Веб-приложение    | `localStorage`        | `s470s.notes`, `s470s.theme`, … |

Данные между расширением и веб-приложением не синхронизируются автоматически — используйте синхронизацию через Supabase.
