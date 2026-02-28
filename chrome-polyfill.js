// chrome-polyfill.js
// Provides localStorage-backed chrome API stubs for web app context.
// Only activates when chrome.storage is unavailable (i.e. outside a Chrome extension).

(function () {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) return;

  const PREFIX = 's470s.';

  function storageGet(keys, callback) {
    const result = {};
    if (keys === null || keys === undefined) {
      // Return all s470s keys
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) {
          const bare = k.slice(PREFIX.length);
          try { result[bare] = JSON.parse(localStorage.getItem(k)); } catch { result[bare] = null; }
        }
      }
    } else if (typeof keys === 'string') {
      const raw = localStorage.getItem(PREFIX + keys);
      result[keys] = raw !== null ? JSON.parse(raw) : undefined;
    } else if (Array.isArray(keys)) {
      keys.forEach(k => {
        const raw = localStorage.getItem(PREFIX + k);
        result[k] = raw !== null ? JSON.parse(raw) : undefined;
      });
    } else {
      // Object with defaults
      Object.entries(keys).forEach(([k, def]) => {
        const raw = localStorage.getItem(PREFIX + k);
        result[k] = raw !== null ? JSON.parse(raw) : def;
      });
    }
    if (callback) callback(result);
    return Promise.resolve(result);
  }

  function storageSet(items, callback) {
    Object.entries(items).forEach(([k, v]) => {
      localStorage.setItem(PREFIX + k, JSON.stringify(v));
    });
    if (callback) callback();
    return Promise.resolve();
  }

  function storageRemove(keys, callback) {
    const list = Array.isArray(keys) ? keys : [keys];
    list.forEach(k => localStorage.removeItem(PREFIX + k));
    if (callback) callback();
    return Promise.resolve();
  }

  window.chrome = {
    storage: {
      local: {
        get: storageGet,
        set: storageSet,
        remove: storageRemove,
      },
    },
    runtime: {
      lastError: null,
      openOptionsPage() {
        window.location.href = 'settings.html';
      },
      onMessage: {
        addListener() {},
      },
      sendMessage(_msg, callback) {
        if (callback) {
          this.lastError = null;
          callback({ ok: true });
        }
      },
    },
  };
})();
