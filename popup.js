const notesList = document.getElementById('notes-list');
const formContainer = document.getElementById('form-container');
const inputCopy = document.getElementById('input-copy');
const inputDesc = document.getElementById('input-desc');
const addBtn = document.getElementById('add-btn');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const emptyState = document.getElementById('empty-state');
const toast = document.getElementById('toast');
const syncIndicator = document.getElementById('sync-indicator');
const syncBtn = document.getElementById('sync-btn');
const settingsBtn = document.getElementById('settings-btn');

let notes = [];
let editingId = null;
let draggedId = null;
let toastTimeout = null;

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

  if (notes.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  notes.forEach((note) => {
    const el = document.createElement('div');
    el.className = 'note-item';
    el.dataset.id = note.id;
    el.draggable = true;

    el.innerHTML = `
      <div class="drag-handle" title="Drag to reorder">&#8942;&#8942;</div>
      <div class="note-content">
        <div class="note-copy-text">${escapeHtml(note.copyText)}</div>
        ${note.description ? `<div class="note-description">${escapeHtml(note.description)}</div>` : ''}
      </div>
      <div class="note-actions">
        <button class="btn-edit" title="Edit">&#9998;</button>
        <button class="btn-delete" title="Delete">&#10005;</button>
      </div>
    `;

    // Click to copy
    el.querySelector('.note-content').addEventListener('click', () => copyToClipboard(note.copyText));

    // Edit
    el.querySelector('.btn-edit').addEventListener('click', (e) => {
      e.stopPropagation();
      startEdit(note);
    });

    // Delete
    el.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
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

// --- CRUD ---

function addNote(copyText, description) {
  const maxOrder = notes.length > 0 ? Math.max(...notes.map((n) => n.order)) : -1;
  const now = Date.now();
  const note = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    copyText,
    description,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  saveNotes().then(() => {
    render();
    scheduleSync(note, 'upsert');
  });
}

function updateNote(id, copyText, description) {
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.copyText = copyText;
    note.description = description;
    note.updatedAt = Date.now();
    saveNotes().then(() => {
      render();
      scheduleSync(note, 'upsert');
    });
  }
}

function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  notes = notes.filter((n) => n.id !== id);
  reorderNotes();
  saveNotes().then(() => {
    render();
    scheduleSync({ id }, 'delete');
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
  editingId = null;
}

function startEdit(note) {
  editingId = note.id;
  inputCopy.value = note.copyText;
  inputDesc.value = note.description;
  showForm();
}

addBtn.addEventListener('click', () => {
  editingId = null;
  inputCopy.value = '';
  inputDesc.value = '';
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

  if (editingId) {
    updateNote(editingId, copyText, description);
  } else {
    addNote(copyText, description);
  }
  hideForm();
});

// Save on Enter in last field
inputDesc.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
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

let _syncSession = null;
let _syncDebounceTimer = null;
let _batchSyncTimer = null;
const PENDING_UPSERTS = new Map(); // id → note
const PENDING_DELETES = new Set(); // local_id

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
      await deleteNote(localId);
    }
    PENDING_UPSERTS.clear();
    PENDING_DELETES.clear();
    await updateLastSync();
    setSyncIndicator('success');
  } catch (err) {
    console.error('Sync error:', err);
    setSyncIndicator('error');
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

    if (changed) {
      reorderNotes();
      await saveNotes();
      render();
    }

    await updateLastSync();
    setSyncIndicator('success');
  } catch (err) {
    console.error('Full sync error:', err);
    setSyncIndicator('error');
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

loadNotes().then(render).then(initSync);
