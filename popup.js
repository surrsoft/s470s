const notesList = document.getElementById('notes-list');
const navBar = document.getElementById('nav-bar');
const backBtn = document.getElementById('back-btn');
const navTitle = document.getElementById('nav-title');
const formContainer = document.getElementById('form-container');
const inputCopy = document.getElementById('input-copy');
const inputDesc = document.getElementById('input-desc');
const inputUrl = document.getElementById('input-url');
const inputParent = document.getElementById('input-parent');
const inputFastCopy = document.getElementById('input-fast-copy');
const addBtn = document.getElementById('add-btn');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const emptyState = document.getElementById('empty-state');
const toast = document.getElementById('toast');
const syncIndicator = document.getElementById('sync-indicator');
const syncBtn = document.getElementById('sync-btn');
const settingsBtn = document.getElementById('settings-btn');
const statusBar = document.getElementById('status-bar');
const statusText = document.getElementById('status-text');
const statusClose = document.getElementById('status-close');
const fontDecBtn = document.getElementById('font-dec-btn');
const fontIncBtn = document.getElementById('font-inc-btn');
const themeBtn = document.getElementById('theme-btn');

// Side panel detection: popup height is constrained by CSS max-height (500px),
// side panel fills the full window height
if (window.innerHeight > 550) {
  document.body.classList.add('side-panel');
}

let notes = [];
let editingId = null;
let draggedId = null;
let toastTimeout = null;
let navStack = []; // [{id: string, copyText: string}]

function getCurrentParentId() {
  return navStack.length > 0 ? navStack[navStack.length - 1].id : null;
}

function navigateInto(note) {
  navStack.push({ id: note.id, copyText: note.copyText });
  updateNavBar();
  render();
}

function navigateBack() {
  navStack.pop();
  updateNavBar();
  render();
}

function updateNavBar() {
  if (navStack.length === 0) {
    navBar.classList.add('hidden');
    return;
  }
  navBar.classList.remove('hidden');
  navTitle.textContent = navStack[navStack.length - 1].copyText;
}

function hasChildren(noteId) {
  return notes.some((n) => n.parentId === noteId);
}

function collectDescendants(id) {
  const children = notes.filter((n) => n.parentId === id);
  return [id, ...children.flatMap((c) => collectDescendants(c.id))];
}

function populateParentSelect(excludeId) {
  const excludeIds = excludeId ? new Set(collectDescendants(excludeId)) : new Set();
  inputParent.innerHTML = '<option value="">— Root (top level) —</option>';
  notes
    .filter((n) => !excludeIds.has(n.id))
    .sort((a, b) => a.order - b.order)
    .forEach((n) => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = n.copyText.length > 50 ? n.copyText.slice(0, 50) + '…' : n.copyText;
      inputParent.appendChild(opt);
    });
}

// --- Font size ---

const FONT_SIZE_DEFAULT = 13;
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 22;
let fontSize = FONT_SIZE_DEFAULT;

function applyFontSize() {
  notesList.style.fontSize = fontSize + 'px';
}

function loadFontSize() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ fontSize: FONT_SIZE_DEFAULT }, (data) => {
      fontSize = data.fontSize;
      applyFontSize();
      resolve();
    });
  });
}

fontDecBtn.addEventListener('click', () => {
  if (fontSize > FONT_SIZE_MIN) {
    fontSize--;
    applyFontSize();
    chrome.storage.local.set({ fontSize });
  }
});

fontIncBtn.addEventListener('click', () => {
  if (fontSize < FONT_SIZE_MAX) {
    fontSize++;
    applyFontSize();
    chrome.storage.local.set({ fontSize });
  }
});

// --- Theme ---

let theme = 'light';

function applyTheme() {
  document.body.classList.toggle('dark', theme === 'dark');
  themeBtn.textContent = theme === 'dark' ? '\u2600' : '\u263E';
  themeBtn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

function loadTheme() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ theme: 'light' }, (data) => {
      theme = data.theme;
      applyTheme();
      resolve();
    });
  });
}

themeBtn.addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light';
  applyTheme();
  chrome.storage.local.set({ theme });
});

// --- Storage ---

function loadNotes() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ notes: [] }, (data) => {
      notes = data.notes.sort((a, b) => a.order - b.order);
      resolve();
    });
  });
}

function saveNotes() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ notes }, resolve);
  });
}

// --- Render ---

function render() {
  notesList.innerHTML = '';

  const parentId = getCurrentParentId();
  const currentNotes = notes
    .filter((n) => (n.parentId || null) === parentId)
    .sort((a, b) => a.order - b.order);

  if (currentNotes.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  currentNotes.forEach((note) => {
    const isFolder = hasChildren(note.id);
    const el = document.createElement('div');
    el.className = 'note-item';
    el.dataset.id = note.id;
    el.draggable = true;

    el.innerHTML = `
      <div class="drag-handle" title="Drag to reorder">&#8942;&#8942;</div>
      <div class="note-content">
        <div class="note-copy-text">${isFolder ? '<span class="folder-icon">&#128193;</span>' : ''}${escapeHtml(note.copyText)}</div>
        ${note.description ? `<div class="note-description">${escapeHtml(note.description)}</div>` : ''}
        ${note.url ? `<button class="btn-url">${escapeHtml(urlHostname(note.url))}</button>` : ''}
      </div>
      ${note.isFastCopy ? '<span class="copy-icon">&#10697;</span>' : ''}
      <div class="note-menu">
        <button class="btn-menu" title="Actions">&#8943;</button>
        <div class="note-dropdown hidden">
          <button class="menu-open">Open</button>
          <button class="menu-edit">&#9998; Edit</button>
          <button class="menu-delete">&#10005; Delete</button>
        </div>
      </div>
    `;

    // Click: copy if isFastCopy, else navigate into
    el.querySelector('.note-content').addEventListener('click', () => {
      if (note.isFastCopy) {
        copyToClipboard(note.copyText);
      } else {
        navigateInto(note);
      }
    });

    // Open URL
    if (note.url) {
      el.querySelector('.btn-url').addEventListener('click', (e) => {
        e.stopPropagation();
        const url = /^https?:\/\//i.test(note.url) ? note.url : 'https://' + note.url;
        window.open(url, '_blank');
      });
    }

    // Menu button
    const noteMenu = el.querySelector('.note-menu');
    const dropdown = el.querySelector('.note-dropdown');

    el.querySelector('.btn-menu').addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.classList.contains('hidden');
      document.querySelectorAll('.note-dropdown').forEach((d) => d.classList.add('hidden'));
      document.querySelectorAll('.note-menu').forEach((m) => m.classList.remove('open'));
      if (!isOpen) {
        dropdown.classList.remove('hidden');
        noteMenu.classList.add('open');
      }
    });

    // Open (navigate into)
    el.querySelector('.menu-open').addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.add('hidden');
      noteMenu.classList.remove('open');
      navigateInto(note);
    });

    // Edit
    el.querySelector('.menu-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.add('hidden');
      noteMenu.classList.remove('open');
      startEdit(note);
    });

    // Delete
    el.querySelector('.menu-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.add('hidden');
      noteMenu.classList.remove('open');
      deleteNote(note.id);
    });

    // Drag events
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);

    notesList.appendChild(el);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function urlHostname(rawUrl) {
  try {
    const full = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl;
    return new URL(full).hostname;
  } catch {
    return 'invalid url';
  }
}

// --- CRUD ---

function addNote(copyText, description, url, parentId, isFastCopy) {
  const now = Date.now();
  const note = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    copyText,
    description,
    url,
    parentId: parentId !== undefined ? parentId : getCurrentParentId(),
    isFastCopy: !!isFastCopy,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
  notes.unshift(note);
  reorderNotes();
  saveNotes().then(() => {
    render();
    scheduleBatchSync();
  });
}

function updateNote(id, copyText, description, url, parentId, isFastCopy) {
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.copyText = copyText;
    note.description = description;
    note.url = url;
    note.parentId = parentId;
    note.isFastCopy = !!isFastCopy;
    note.updatedAt = Date.now();
    const navItem = navStack.find((item) => item.id === id);
    if (navItem) { navItem.copyText = copyText; updateNavBar(); }
    saveNotes().then(() => {
      render();
      scheduleSync(note, 'upsert');
    });
  }
}

function deleteNote(id) {
  const idsToDelete = new Set(collectDescendants(id));
  const msg = idsToDelete.size > 1 ? 'Delete this folder and all its contents?' : 'Delete this note?';
  if (!confirm(msg)) return;
  notes = notes.filter((n) => !idsToDelete.has(n.id));
  reorderNotes();
  saveNotes().then(() => {
    render();
    for (const delId of idsToDelete) scheduleSync({ id: delId }, 'delete');
  });
}

function reorderNotes() {
  notes.forEach((note, i) => {
    note.order = i;
  });
}

// --- Form ---

function showForm() {
  formContainer.classList.remove('hidden');
  inputCopy.focus();
}

function hideForm() {
  formContainer.classList.add('hidden');
  inputCopy.value = '';
  inputDesc.value = '';
  inputUrl.value = '';
  inputParent.innerHTML = '';
  inputFastCopy.checked = false;
  editingId = null;
}

function startEdit(note) {
  editingId = note.id;
  inputCopy.value = note.copyText;
  inputDesc.value = note.description;
  inputUrl.value = note.url || '';
  populateParentSelect(note.id);
  inputParent.value = note.parentId || '';
  inputFastCopy.checked = !!note.isFastCopy;
  showForm();
}

addBtn.addEventListener('click', () => {
  editingId = null;
  inputCopy.value = '';
  inputDesc.value = '';
  inputUrl.value = '';
  populateParentSelect(null);
  inputParent.value = getCurrentParentId() || '';
  showForm();
});

cancelBtn.addEventListener('click', hideForm);

saveBtn.addEventListener('click', () => {
  const copyText = inputCopy.value.trim();
  if (!copyText) {
    inputCopy.focus();
    return;
  }
  const description = inputDesc.value.trim();
  const url = inputUrl.value.trim();
  const parentId = inputParent.value || null;
  const isFastCopy = inputFastCopy.checked;

  if (editingId) {
    updateNote(editingId, copyText, description, url, parentId, isFastCopy);
  } else {
    addNote(copyText, description, url, parentId, isFastCopy);
  }
  hideForm();
});

// Save on Enter in last field
inputUrl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

inputDesc.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') inputUrl.focus();
});

inputCopy.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') inputDesc.focus();
});

// --- Clipboard ---

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied!');
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 1500);
}

// --- Drag & Drop ---

function handleDragStart(e) {
  draggedId = this.dataset.id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  draggedId = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  if (this.dataset.id !== draggedId) {
    this.classList.add('drag-over');
  }
}

function handleDragLeave() {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');

  const targetId = this.dataset.id;
  if (targetId === draggedId) return;

  const draggedIndex = notes.findIndex((n) => n.id === draggedId);
  const targetIndex = notes.findIndex((n) => n.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1) return;

  const [moved] = notes.splice(draggedIndex, 1);
  notes.splice(targetIndex, 0, moved);
  reorderNotes();
  saveNotes().then(() => {
    render();
    // Push reordered notes to server
    scheduleBatchSync();
  });
}

// --- Sync ---

// Convert a Supabase row to local note format
function serverRowToNote(row) {
  return {
    id: row.local_id,
    copyText: row.copy_text,
    description: row.description || '',
    url: row.url || '',
    parentId: row.parent_id || null,
    isFastCopy: row.is_fast_copy || false,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let _syncSession = null;
let _syncDebounceTimer = null;
let _batchSyncTimer = null;
const PENDING_UPSERTS = new Map(); // id → note
const PENDING_DELETES = new Set(); // local_id

let _statusTimeout = null;

function setStatusMessage(msg) {
  statusText.textContent = msg;
  statusBar.classList.remove('hidden');
  clearTimeout(_statusTimeout);
  _statusTimeout = setTimeout(clearStatus, 15000);
}

function clearStatus() {
  clearTimeout(_statusTimeout);
  statusBar.classList.add('hidden');
}

statusClose.addEventListener('click', clearStatus);

function setSyncIndicator(state) {
  syncIndicator.className = 'sync-indicator' + (state ? ' ' + state : '');
  if (state === 'success') {
    setTimeout(() => {
      if (syncIndicator.classList.contains('success')) {
        syncIndicator.className = 'sync-indicator';
      }
    }, 2000);
  }
  if (state === 'error') {
    setTimeout(() => {
      if (syncIndicator.classList.contains('error')) {
        syncIndicator.className = 'sync-indicator';
      }
    }, 5000);
  }
}

function scheduleSync(noteOrId, op) {
  if (!_syncSession) return;

  if (op === 'upsert') {
    PENDING_UPSERTS.set(noteOrId.id, noteOrId);
    PENDING_DELETES.delete(noteOrId.id);
  } else if (op === 'delete') {
    PENDING_DELETES.add(noteOrId.id);
    PENDING_UPSERTS.delete(noteOrId.id);
  }

  clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(flushPendingChanges, 1500);
}

function scheduleBatchSync() {
  if (!_syncSession) return;
  clearTimeout(_batchSyncTimer);
  _batchSyncTimer = setTimeout(() => upsertNotesBatch(notes), 1500);
}

async function flushPendingChanges() {
  if (!_syncSession) return;
  if (PENDING_UPSERTS.size === 0 && PENDING_DELETES.size === 0) return;

  setSyncIndicator('syncing');
  try {
    for (const note of PENDING_UPSERTS.values()) {
      await upsertNote(note);
    }
    for (const localId of PENDING_DELETES) {
      await deleteNoteRemote(localId);
    }
    PENDING_UPSERTS.clear();
    PENDING_DELETES.clear();
    await updateLastSync();
    setSyncIndicator('success');
    clearStatus();
  } catch (err) {
    console.error('Sync error:', err);
    setSyncIndicator('error');
    setStatusMessage('Sync error: ' + (err.message || String(err)));
  }
}

async function updateLastSync() {
  await chrome.storage.local.set({ lastFullSync: Date.now() });
}

// Full bidirectional sync
async function runFullSync() {
  if (!_syncSession) return;
  setSyncIndicator('syncing');

  try {
    const stored = await new Promise((resolve) =>
      chrome.storage.local.get({ lastFullSync: 0 }, resolve)
    );
    const lastSync = stored.lastFullSync;

    const serverNotes = await fetchNotes();
    if (serverNotes === null) {
      setSyncIndicator('error');
      return;
    }

    const serverMap = new Map(serverNotes.map((r) => [r.local_id, r]));
    const localMap = new Map(notes.map((n) => [n.id, n]));

    let changed = false;

    // Server → local
    for (const row of serverNotes) {
      const local = localMap.get(row.local_id);
      if (!local) {
        // New from server
        notes.push(serverRowToNote(row));
        changed = true;
      } else if (row.updated_at > (local.updatedAt || local.createdAt)) {
        // Server is newer — overwrite local
        Object.assign(local, serverRowToNote(row));
        changed = true;
      }
    }

    // Local → server (push notes missing from server)
    const toUpsert = [];
    for (const note of notes) {
      if (!serverMap.has(note.id)) {
        toUpsert.push(note);
      }
    }

    // Detect deletions: local notes not on server that existed before lastSync
    if (lastSync > 0) {
      notes = notes.filter((note) => {
        if (!serverMap.has(note.id) && (note.updatedAt || note.createdAt) < lastSync) {
          changed = true;
          return false; // deleted on server
        }
        return true;
      });
    }

    if (toUpsert.length > 0) {
      await upsertNotesBatch(toUpsert);
    }

    // Reset nav if current parent was deleted on server
    if (getCurrentParentId() && !notes.find((n) => n.id === getCurrentParentId())) {
      navStack = [];
      updateNavBar();
    }

    if (changed) {
      reorderNotes();
      await saveNotes();
      render();
    }

    await updateLastSync();
    setSyncIndicator('success');
    clearStatus();
  } catch (err) {
    console.error('Full sync error:', err);
    setSyncIndicator('error');
    setStatusMessage('Sync error: ' + (err.message || String(err)));
  }
}

// Init sync: load config + session, subscribe Realtime
async function initSync() {
  const stored = await new Promise((resolve) =>
    chrome.storage.local.get({ supabaseConfig: null, supabaseSession: null }, resolve)
  );

  if (!stored.supabaseConfig) return; // Not configured — silent offline mode
  setConfig(stored.supabaseConfig);

  if (!stored.supabaseSession) return; // Not authenticated
  setSession(stored.supabaseSession);

  // Validate session is still alive
  try {
    const session = await getSession();
    if (!session) {
      await chrome.storage.local.remove('supabaseSession');
      return;
    }
    _syncSession = session;
  } catch {
    return;
  }

  // Subscribe Realtime
  subscribeRealtime({
    onInsert: (row) => {
      if (!notes.find((n) => n.id === row.local_id)) {
        notes.push(serverRowToNote(row));
        reorderNotes();
        saveNotes().then(render);
      }
    },
    onUpdate: (row) => {
      const note = notes.find((n) => n.id === row.local_id);
      if (note) {
        Object.assign(note, serverRowToNote(row));
        saveNotes().then(render);
      }
    },
    onDelete: (row) => {
      notes = notes.filter((n) => n.id !== row.local_id);
      saveNotes().then(render);
    },
  });

  // Full sync on open
  await runFullSync();
}

// Header buttons
syncBtn.addEventListener('click', () => {
  if (_syncSession) {
    runFullSync();
  } else {
    chrome.runtime.openOptionsPage();
  }
});

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

backBtn.addEventListener('click', navigateBack);

document.addEventListener('click', () => {
  document.querySelectorAll('.note-dropdown').forEach((d) => d.classList.add('hidden'));
  document.querySelectorAll('.note-menu').forEach((m) => m.classList.remove('open'));
});

// Listen for SYNC_NOW message from settings page
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SYNC_NOW') {
    runFullSync()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // async response
  }
});

// --- Init ---

loadNotes().then(render).then(loadFontSize).then(loadTheme).then(initSync);
