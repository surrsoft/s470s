const notesList = document.getElementById('notes-list');
const navBar = document.getElementById('nav-bar');
const backBtn = document.getElementById('back-btn');
const navBreadcrumbs = document.getElementById('nav-breadcrumbs');
const selectModeBtns = document.getElementById('select-mode-btns');
const selectModeLabel = selectModeBtns.querySelector('.select-mode-label');
const resetSelectedBtn = document.getElementById('reset-selected-btn');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const cutSelectedBtn = document.getElementById('cut-selected-btn');
const clipboardBar = document.getElementById('clipboard-bar');
const clipboardLabel = document.getElementById('clipboard-label');
const clipboardViewBtn = document.getElementById('clipboard-view-btn');
const clipboardPasteBtn = document.getElementById('clipboard-paste-btn');
const clipboardClearBtn = document.getElementById('clipboard-clear-btn');
const clipboardPreview = document.getElementById('clipboard-preview');
const clipboardPreviewList = document.getElementById('clipboard-preview-list');
const clipboardSymlinkBtn = document.getElementById('clipboard-symlink-btn');
const formContainer = document.getElementById('form-container');
const inputCopy = document.getElementById('input-copy');
const inputDesc = document.getElementById('input-desc');
const inputUrl = document.getElementById('input-url');
const inputImg = document.getElementById('input-img');
const inputFastCopy = document.getElementById('input-fast-copy');
const formAdvanced = document.getElementById('form-advanced');
const formIdRow = document.getElementById('form-id-row');
const formIdValue = document.getElementById('form-id-value');
const addBtn = document.getElementById('add-btn');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const emptyState = document.getElementById('empty-state');
const toast = document.getElementById('toast');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const notesCount = document.getElementById('notes-count');
const syncIndicator = document.getElementById('sync-indicator');
const syncBtn = document.getElementById('sync-btn');
const settingsBtn = document.getElementById('settings-btn');
const statusBar = document.getElementById('status-bar');
const statusText = document.getElementById('status-text');
const statusClose = document.getElementById('status-close');
const fontDecBtn = document.getElementById('font-dec-btn');
const fontIncBtn = document.getElementById('font-inc-btn');
const themeBtn = document.getElementById('theme-btn');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const searchTitleCb = document.getElementById('search-title');
const searchDescCb = document.getElementById('search-desc');
const searchUrlCb = document.getElementById('search-url');
const searchCaseCb = document.getElementById('search-case');
const searchSort = document.getElementById('search-sort');

// Side panel detection: popup height is constrained by CSS max-height (500px),
// side panel fills the full window height
if (window.innerHeight > 550) {
  document.body.classList.add('side-panel');
}

let notes = [];
let editingId = null;
let draggedId = null;
let dropMode = null; // 'before' | 'nest'
let toastTimeout = null;
let navStack = []; // [{id: string, copyText: string}]
let selectMode = false; // F19F/F20F/F21F select mode
let selectedNoteIds = new Set(); // selected note ids in select mode

const TRASH_ID = '__trash__';

// --- Undo delete state ---
let deletedSnapshot = null; // { affectedIds: string[], syncIds: string[] }
let undoTimeout = null;

// --- Clipboard (cut/paste) state ---
let clipboard = null; // { sources: Map<id, isSymlink>, originParentId, mode: 'cut'|'copy-shallow'|'copy-deep' } | null
let moveUndoSnapshot = null; // [{ id, parentId, parentIdsOther, order }]
let moveUndoTimeout = null;

// --- Keyboard navigation state ---
let focusedNoteIndex = -1;

function getCurrentParentId() {
  return navStack.length > 0 ? navStack[navStack.length - 1].id : null;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function exitSelectMode() {
  selectMode = false;
  selectedNoteIds = new Set();
}

// --- Clipboard (cut/paste) ---

function cutToClipboard(sources, originParentId) {
  // sources: [{ id, isSymlink }]
  clipboard = {
    sources: new Map(sources.map(({ id, isSymlink }) => [id, isSymlink])),
    originParentId,
    mode: 'cut',
  };
  updateClipboardBar();
}

function markForCopy(noteId, mode) {
  // mode: 'copy-shallow' | 'copy-deep'
  clipboard = {
    sources: new Map([[noteId, false]]),
    originParentId: getCurrentParentId(),
    mode,
  };
  updateClipboardBar();
}

function clearClipboard() {
  clipboard = null;
  updateClipboardBar();
}

function updateClipboardBar() {
  if (!clipboard || clipboard.sources.size === 0) {
    clipboardBar.classList.add('hidden');
    return;
  }
  const count = clipboard.sources.size;
  const isCopy = clipboard.mode !== 'cut';
  clipboardLabel.textContent = isCopy
    ? `${count} note${count > 1 ? 's' : ''} to copy`
    : `${count} note${count > 1 ? 's' : ''} cut`;
  clipboardBar.querySelector('.clipboard-icon').textContent = isCopy ? '⧉' : '✂';
  clipboardBar.classList.remove('hidden');
  if (!clipboardPreview.classList.contains('hidden')) {
    renderClipboardPreview();
  }
}

function renderClipboardPreview() {
  clipboardPreviewList.innerHTML = '';
  for (const id of clipboard.sources.keys()) {
    const note = notes.find((n) => n.id === id);
    const item = document.createElement('div');
    item.className = 'clipboard-preview-item';
    item.textContent = note ? note.copyText : `(id: ${id})`;
    clipboardPreviewList.appendChild(item);
  }
}

function executeMove(targetParentId) {
  if (!clipboard) return;
  const excludeIds = new Set();
  for (const id of clipboard.sources.keys()) {
    for (const desc of collectDescendants(id)) excludeIds.add(desc);
  }
  if (targetParentId !== null && excludeIds.has(targetParentId)) return;

  const originParentId = clipboard.originParentId;
  const sources = [...clipboard.sources.entries()];

  const backup = sources.map(([id]) => {
    const n = notes.find((n) => n.id === id);
    return { id, parentId: n.parentId, parentIdsOther: [...ensureArray(n.parentIdsOther)], order: n.order };
  });

  const sourceIdSet = new Set(sources.map(([id]) => id));
  const maxOrder = notes
    .filter((n) => n.parentId === targetParentId && !sourceIdSet.has(n.id))
    .reduce((max, n) => Math.max(max, n.order), -1);

  let orderOffset = 0;
  sources.forEach(([id, isSymlink]) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    if (isSymlink) {
      const originKey = originParentId ?? '';
      const others = ensureArray(note.parentIdsOther).filter((p) => p !== originKey);
      const targetKey = targetParentId ?? '';
      if (targetParentId !== note.parentId && !others.includes(targetKey)) {
        others.push(targetKey);
      }
      note.parentIdsOther = others;
    } else {
      note.parentId = targetParentId;
      note.order = maxOrder + 1 + orderOffset++;
    }
  });

  const pastedIds = sources.map(([id]) => id);
  clearClipboard();
  reorderNotes();
  saveNotes().then(() => { updateNavBar(); render(); flashPastedNotes(pastedIds); });
  sources.forEach(([id]) => {
    const note = notes.find((n) => n.id === id);
    if (note) scheduleSync(note, 'upsert');
  });

  const destName = targetParentId === null
    ? 'Root'
    : (notes.find((n) => n.id === targetParentId)?.copyText || '');
  const count = sources.length;
  const msg = `Перемещено ${count > 1 ? count + ' заметок' : '1 заметка'} → ${destName}`;
  showMoveUndoToast(msg, backup);
}

function copyNoteDeep(note, newParentId) {
  const newId = makeId();
  const now = Date.now();
  const newNote = { ...note, id: newId, parentId: newParentId, parentIdsOther: [], order: 0, createdAt: now, updatedAt: now };
  notes.push(newNote);
  const addedIds = [newId];
  notes
    .filter((n) => n.parentId === note.id && !n.deletedAt)
    .forEach((child) => addedIds.push(...copyNoteDeep(child, newId)));
  return addedIds;
}

function executeCopy(targetParentId) {
  if (!clipboard || clipboard.mode === 'cut') return;
  const isDeep = clipboard.mode === 'copy-deep';
  const newIds = [];
  const now = Date.now();

  for (const [id] of clipboard.sources) {
    const note = notes.find((n) => n.id === id);
    if (!note) continue;
    if (isDeep) {
      newIds.push(...copyNoteDeep(note, targetParentId));
    } else {
      const newNote = { ...note, id: makeId(), parentId: targetParentId, parentIdsOther: [], order: 0, createdAt: now, updatedAt: now };
      notes.push(newNote);
      newIds.push(newNote.id);
    }
  }

  if (newIds.length === 0) return;
  clearClipboard();
  reorderNotes();
  saveNotes().then(() => { updateNavBar(); render(); flashPastedNotes(newIds); });
  newIds.forEach((id) => {
    const note = notes.find((n) => n.id === id);
    if (note) scheduleSync(note, 'upsert');
  });
}

function showMoveUndoToast(msg, backup) {
  if (moveUndoTimeout) clearTimeout(moveUndoTimeout);
  moveUndoSnapshot = backup;
  toast.innerHTML = `${escapeHtml(msg)} <button class="toast-undo-btn">Undo</button>`;
  toast.classList.remove('hidden');
  toast.querySelector('.toast-undo-btn').addEventListener('click', () => {
    if (!moveUndoSnapshot) return;
    clearTimeout(moveUndoTimeout);
    moveUndoTimeout = null;
    const snap = moveUndoSnapshot;
    moveUndoSnapshot = null;
    snap.forEach(({ id, parentId, parentIdsOther, order }) => {
      const note = notes.find((n) => n.id === id);
      if (note) { note.parentId = parentId; note.parentIdsOther = parentIdsOther; note.order = order; }
    });
    reorderNotes();
    saveNotes().then(() => render());
    snap.forEach(({ id }) => {
      const note = notes.find((n) => n.id === id);
      if (note) scheduleSync(note, 'upsert');
    });
    toast.classList.add('hidden');
  });
  moveUndoTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    moveUndoSnapshot = null;
    moveUndoTimeout = null;
  }, 5000);
}

function executePasteAsSymlink(targetParentId) {
  if (!clipboard) return;
  const targetKey = targetParentId ?? '';
  const backup = [];
  const affected = [];

  for (const id of clipboard.sources.keys()) {
    const note = notes.find((n) => n.id === id);
    if (!note) continue;
    // Skip: target is the note itself
    if (targetParentId === note.id) continue;
    // Skip: target is already primary parent
    if ((targetParentId ?? null) === (note.parentId ?? null)) continue;
    // Skip: symlink already exists at target
    const others = ensureArray(note.parentIdsOther);
    if (others.includes(targetKey)) continue;
    // Skip: circular reference (target is a descendant of note)
    if (targetParentId !== null && collectDescendants(note.id).includes(targetParentId)) continue;

    backup.push({ id, parentIdsOther: [...others] });
    note.parentIdsOther = [...others, targetKey];
    affected.push(note);
  }

  if (affected.length === 0) return;

  const pastedIds = affected.map((n) => n.id);
  clearClipboard();
  saveNotes().then(() => { render(); flashPastedNotes(pastedIds); });
  affected.forEach((note) => scheduleSync(note, 'upsert'));

  const destName = targetParentId === null
    ? 'Root'
    : (notes.find((n) => n.id === targetParentId)?.copyText || '');
  const count = affected.length;
  const msg = `Симлинк: ${count > 1 ? count + ' заметок' : '1 заметка'} → ${destName}`;
  showSymlinkUndoToast(msg, backup);
}

function showSymlinkUndoToast(msg, backup) {
  if (moveUndoTimeout) clearTimeout(moveUndoTimeout);
  moveUndoSnapshot = backup;
  toast.innerHTML = `${escapeHtml(msg)} <button class="toast-undo-btn">Undo</button>`;
  toast.classList.remove('hidden');
  toast.querySelector('.toast-undo-btn').addEventListener('click', () => {
    if (!moveUndoSnapshot) return;
    clearTimeout(moveUndoTimeout);
    moveUndoTimeout = null;
    moveUndoSnapshot.forEach(({ id, parentIdsOther }) => {
      const note = notes.find((n) => n.id === id);
      if (note) { note.parentIdsOther = parentIdsOther; scheduleSync(note, 'upsert'); }
    });
    moveUndoSnapshot = null;
    saveNotes().then(() => render());
    toast.classList.add('hidden');
  });
  moveUndoTimeout = setTimeout(() => {
    moveUndoSnapshot = null;
    toast.classList.add('hidden');
  }, 5000);
}

function flashPastedNotes(ids) {
  ids.forEach((id) => {
    const el = notesList.querySelector(`.note-item[data-id="${id}"]`);
    if (!el) return;
    el.classList.add('paste-flash');
    setTimeout(() => el.classList.remove('paste-flash'), 1000);
  });
}

function buildNavStackFor(note) {
  const stack = [];
  let current = note;
  while (current) {
    stack.unshift({ id: current.id, copyText: current.copyText });
    current = current.parentId ? notes.find((n) => n.id === current.parentId) : null;
  }
  return stack;
}

function navigateInto(note) {
  exitSelectMode();
  searchInput.value = '';
  searchClear.classList.add('hidden');
  navStack = buildNavStackFor(note);
  updateNavBar();
  render();
}

function navigateBack() {
  exitSelectMode();
  navStack.pop();
  updateNavBar();
  render();
}

function updateNavBar() {
  if (navStack.length === 0 && !selectMode) {
    navBar.classList.add('hidden');
    return;
  }
  navBar.classList.remove('hidden');

  // Back button: only when inside a folder
  if (navStack.length > 0) {
    backBtn.classList.remove('hidden');
    const parentName = navStack.length > 1 ? navStack[navStack.length - 2].copyText : 'Root';
    backBtn.textContent = '\u2190 ' + parentName;
  } else {
    backBtn.classList.add('hidden');
  }

  // Breadcrumbs: Root › Level1 › ... › Current
  navBreadcrumbs.innerHTML = '';

  if (navStack.length > 0) {
    const rootCrumb = document.createElement('span');
    rootCrumb.className = 'nav-crumb';
    rootCrumb.textContent = 'Root';
    rootCrumb.addEventListener('click', () => { navStack = []; updateNavBar(); render(); });
    navBreadcrumbs.appendChild(rootCrumb);

    navStack.slice(0, -1).forEach((item, index) => {
      const sep = document.createElement('span');
      sep.className = 'nav-crumb-sep';
      sep.textContent = ' › ';
      navBreadcrumbs.appendChild(sep);

      const crumb = document.createElement('span');
      crumb.className = 'nav-crumb';
      crumb.textContent = item.copyText;
      const depth = index;
      crumb.addEventListener('click', () => {
        navStack = navStack.slice(0, depth + 1);
        updateNavBar();
        render();
      });
      navBreadcrumbs.appendChild(crumb);
    });
  }

  // F23F: show select-mode buttons block only when in select mode
  selectModeBtns.classList.toggle('hidden', !selectMode);
  updateSelectCount();
}

function updateSelectCount() {
  const n = selectedNoteIds.size;
  selectModeLabel.textContent = n > 0 ? `☑ Select mode (${n})` : '☑ Select mode';
}

function ensureArray(val) {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  if (typeof val === 'string') {
    if (val.startsWith('{') && val.endsWith('}')) {
      return val.slice(1, -1).split(',').filter(Boolean);
    }
    try { const parsed = JSON.parse(val); if (Array.isArray(parsed)) return parsed; } catch {}
  }
  return [];
}

function hasChildren(noteId) {
  return notes.some((n) => !n.deletedAt && (n.parentId === noteId || ensureArray(n.parentIdsOther).includes(noteId)));
}

function collectDescendants(id) {
  const children = notes.filter((n) => n.parentId === id);
  return [id, ...children.flatMap((c) => collectDescendants(c.id))];
}

function collectAllDescendants(id, visited = new Set()) {
  if (visited.has(id)) return [];
  visited.add(id);
  const children = notes.filter((n) => !n.deletedAt && (n.parentId === id || ensureArray(n.parentIdsOther).includes(id)));
  return [id, ...children.flatMap((c) => collectAllDescendants(c.id, visited))];
}

function getNotePath(note) {
  const path = [];
  let currentId = note.parentId;
  while (currentId) {
    const parent = notes.find((n) => n.id === currentId);
    if (!parent) break;
    path.unshift(parent.copyText);
    currentId = parent.parentId;
  }
  return path;
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
      let sanitized = false;
      for (const n of notes) {
        if (n.parentIdsOther && !Array.isArray(n.parentIdsOther)) {
          n.parentIdsOther = ensureArray(n.parentIdsOther);
          sanitized = true;
        }
      }
      if (sanitized) saveNotes();
      resolve();
    });
  });
}

function saveNotes() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ notes }, resolve);
  });
}

// --- Helpers ---

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text, query, caseSensitive) {
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  const flags = caseSensitive ? 'g' : 'gi';
  const re = new RegExp(escapeRegex(escapeHtml(query)), flags);
  return escaped.replace(re, (m) => `<mark class="search-hl">${m}</mark>`);
}

function urlHostname(rawUrl) {
  try {
    const full = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl;
    return new URL(full).hostname;
  } catch {
    return 'invalid url';
  }
}

// --- Keyboard navigation ---

function setFocusedNote(index) {
  const items = [...notesList.querySelectorAll('.note-item')];
  items.forEach((el) => el.classList.remove('keyboard-focused'));
  if (index >= 0 && index < items.length) {
    items[index].classList.add('keyboard-focused');
    items[index].scrollIntoView({ block: 'nearest' });
  }
}

// --- Search (F7F) ---

function createNoteEl(note, isSymlink, withDrag, searchCtx = null) {
  const isFolder = hasChildren(note.id);
  const directCount = isFolder ? notes.filter((n) => !n.deletedAt && (n.parentId === note.id || ensureArray(n.parentIdsOther).includes(note.id))).length : 0;
  const totalCount = isFolder ? collectAllDescendants(note.id).length - 1 : 0;
  const folderCountLabel = directCount === totalCount ? `${totalCount}` : `${directCount}/${totalCount}`;
  const folderCountTitle = directCount === totalCount
    ? `${totalCount} child note${totalCount !== 1 ? 's' : ''}`
    : `${directCount} direct, ${totalCount} total`;
  const folderCountHtml = isFolder ? `<span class="folder-count" title="${folderCountTitle}">${folderCountLabel}</span>` : '';
  const el = document.createElement('div');
  el.className = 'note-item';
  if (selectedNoteIds.has(note.id)) el.classList.add('selected');
  if (note.isFastCopy) el.classList.add('is-fast-copy');
  if (clipboard && clipboard.sources.has(note.id)) el.classList.add(clipboard.mode === 'cut' ? 'cut' : 'copying');
  el.dataset.id = note.id;

  // In normal mode: show drag handle (reorder); in select mode: show checkbox F20F
  const showDragHandle = withDrag && !selectMode;
  const showCheckbox = withDrag && selectMode;
  if (showDragHandle) el.draggable = true;

  // Text rendering: use highlight in search mode, plain escapeHtml otherwise
  const titleHtml = searchCtx
    ? highlightText(note.copyText, searchCtx.query, searchCtx.caseSensitive)
    : escapeHtml(note.copyText);
  const descHtml = note.description
    ? (searchCtx
        ? highlightText(note.description, searchCtx.query, searchCtx.caseSensitive)
        : escapeHtml(note.description))
    : '';
  const path = searchCtx ? getNotePath(note) : [];
  const pathHtml = path.length > 0
    ? `<div class="note-path">Root › ${path.map(escapeHtml).join(' › ')}</div>`
    : '';

  el.innerHTML = `
    ${showDragHandle ? '<div class="drag-handle" title="Drag to reorder">&#8942;&#8942;</div>' : ''}
    ${showCheckbox ? `<label class="note-select-wrap" title="Select"><input type="checkbox" class="note-select-cb"${selectedNoteIds.has(note.id) ? ' checked' : ''}></label>` : ''}
    <div class="note-content">
      <div class="note-copy-text">${isFolder ? '<span class="folder-icon" title="Contains child notes">&#128193;</span>' : ''}<span class="note-title-text">${titleHtml}</span>${folderCountHtml}${isSymlink ? '<span class="symlink-badge" title="Symlink: this note appears here via an additional parent">symlink</span>' : ''}</div>
      ${descHtml ? `<div class="note-description">${descHtml}</div>` : ''}
      ${pathHtml}
      ${note.url ? `<button class="btn-url" title="${escapeHtml(note.url)}">${escapeHtml(urlHostname(note.url))}</button>` : ''}
    </div>
    ${note.isFastCopy ? '<span class="copy-icon" title="Fast copy: click copies text directly">&#10697;</span>' : ''}
    <div class="note-menu">
      <button class="btn-menu" title="Actions">&#8943;</button>
      <div class="note-dropdown hidden">
        <button class="menu-open" title="Navigate into this note">&#8594; Open</button>
        <button class="menu-edit" title="Edit note">&#9998; Edit</button>
        <button class="menu-cut" title="Cut note to clipboard">&#9986; Cut</button>
        <button class="menu-copy" title="Copy note (without children)">&#10697; Copy</button>
        <button class="menu-copy-deep" title="Copy note with all children">&#10697; Copy with children</button>
        <button class="menu-delete" title="${isSymlink ? 'Remove symlink from this location' : 'Delete note (and all contents if folder)'}">${isSymlink ? '&#10005; Unlink' : '&#10005; Delete'}</button>
        ${withDrag ? '<button class="menu-select" title="Select for batch action">&#9745; Select</button>' : ''}
      </div>
    </div>
  `;

  // F20F: checkbox click/change handlers
  if (showCheckbox) {
    const cbLabel = el.querySelector('.note-select-wrap');
    const cb = el.querySelector('.note-select-cb');
    cbLabel.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', () => {
      if (cb.checked) {
        selectedNoteIds.add(note.id);
      } else {
        selectedNoteIds.delete(note.id);
      }
      el.classList.toggle('selected', selectedNoteIds.has(note.id));
      updateSelectCount();
    });
  }

  el.addEventListener('click', () => {
    if (selectMode) {
      // In select mode: toggle checkbox
      if (selectedNoteIds.has(note.id)) {
        selectedNoteIds.delete(note.id);
      } else {
        selectedNoteIds.add(note.id);
      }
      el.classList.toggle('selected', selectedNoteIds.has(note.id));
      const cb = el.querySelector('.note-select-cb');
      if (cb) cb.checked = selectedNoteIds.has(note.id);
      updateSelectCount();
    } else if (note.isFastCopy) {
      copyToClipboard(note.copyText);
    } else {
      navigateInto(note);
    }
  });

  // Inline rename on double-click
  el.addEventListener('dblclick', (e) => {
    if (selectMode) return;
    if (e.target.closest('.note-menu, .btn-url')) return;
    e.stopPropagation();
    startInlineEdit(el, note);
  });

  if (note.url) {
    el.querySelector('.btn-url').addEventListener('click', (e) => {
      e.stopPropagation();
      const url = /^https?:\/\//i.test(note.url) ? note.url : 'https://' + note.url;
      window.open(url, '_blank');
    });
  }

  const noteMenu = el.querySelector('.note-menu');
  const dropdown = el.querySelector('.note-dropdown');

  el.querySelector('.btn-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !dropdown.classList.contains('hidden');
    document.querySelectorAll('.note-dropdown').forEach((d) => d.classList.add('hidden'));
    document.querySelectorAll('.note-menu').forEach((m) => m.classList.remove('open'));
    document.querySelectorAll('.folder-meta-dropdown').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.folder-meta-menu').forEach(m => m.classList.remove('open'));
    if (!isOpen) {
      dropdown.classList.remove('hidden');
      noteMenu.classList.add('open');
    }
  });

  el.querySelector('.menu-open').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.add('hidden');
    noteMenu.classList.remove('open');
    navigateInto(note);
  });

  el.querySelector('.menu-edit').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.add('hidden');
    noteMenu.classList.remove('open');
    startEdit(note);
  });

  el.querySelector('.menu-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.add('hidden');
    noteMenu.classList.remove('open');
    if (isSymlink) {
      const parentKey = getCurrentParentId() ?? '';
      note.parentIdsOther = ensureArray(note.parentIdsOther).filter(p => p !== parentKey);
      note.updatedAt = Date.now();
      saveNotes().then(() => render());
      scheduleSync(note, 'upsert');
    } else {
      const childCount = collectDescendants(note.id).filter(id => { const n = notes.find(x => x.id === id); return n && !n.deletedAt; }).length - 1;
      const msg = childCount > 0
        ? `Удалить «${note.copyText}» и ${childCount} вложенных заметок?`
        : `Удалить «${note.copyText}»?`;
      showConfirmDelete(msg, () => deleteNote(note.id));
    }
  });

  el.querySelector('.menu-cut').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.add('hidden');
    noteMenu.classList.remove('open');
    cutToClipboard([{ id: note.id, isSymlink: isSymlink }], getCurrentParentId());
    render();
  });

  el.querySelector('.menu-copy').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.add('hidden');
    noteMenu.classList.remove('open');
    markForCopy(note.id, 'copy-shallow');
    render();
  });

  el.querySelector('.menu-copy-deep').addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.add('hidden');
    noteMenu.classList.remove('open');
    markForCopy(note.id, 'copy-deep');
    render();
  });

  // F19F: Select menu option
  if (withDrag) {
    el.querySelector('.menu-select').addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.add('hidden');
      noteMenu.classList.remove('open');
      if (!selectMode) {
        // Scenario 1: first selected note → enter select mode
        selectMode = true;
      }
      // Scenario 2 (or after entering): add this note to selection
      selectedNoteIds.add(note.id);
      updateNavBar();
      render();
    });
  }

  if (showDragHandle) {
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragend', handleDragEnd);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);
  }

  return el;
}

// --- Inline rename ---

function startInlineEdit(el, note) {
  const textEl = el.querySelector('.note-copy-text');
  const original = note.copyText;
  const input = document.createElement('input');
  input.className = 'inline-edit-input';
  input.value = original;
  textEl.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;
  function commit() {
    if (committed) return;
    committed = true;
    const val = input.value.trim();
    if (val && val !== original) {
      updateNote(note.id, val, note.description, note.url, note.parentId, note.isFastCopy, note.parentIdsOther);
    } else {
      render();
    }
  }
  function cancel() {
    if (committed) return;
    committed = true;
    render();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', commit);
}

function createTrashNoteEl(note) {
  const path = getNotePath(note);
  const pathStr = path.length > 0 ? 'Root › ' + path.join(' › ') : 'Root';
  const el = document.createElement('div');
  el.className = 'note-item trash-note-item';
  el.innerHTML = `
    <div class="note-content">
      <div class="note-copy-text"><span class="note-title-text">${escapeHtml(note.copyText)}</span></div>
      ${note.description ? `<div class="note-description">${escapeHtml(note.description)}</div>` : ''}
      <div class="note-path">${escapeHtml(pathStr)}</div>
    </div>
  `;
  return el;
}

function renderSearchResults(query) {
  const caseSensitive = searchCaseCb.checked;
  const q = caseSensitive ? query : query.toLowerCase();

  const matched = notes.filter((note) => {
    if (note.deletedAt) return false;
    const fields = [];
    if (searchTitleCb.checked) fields.push(caseSensitive ? note.copyText : note.copyText.toLowerCase());
    if (searchDescCb.checked && note.description) fields.push(caseSensitive ? note.description : note.description.toLowerCase());
    if (searchUrlCb.checked && note.url) fields.push(caseSensitive ? note.url : note.url.toLowerCase());
    return fields.some((f) => f.includes(q));
  });

  if (searchSort.value === 'date') {
    const now = Date.now();
    matched.sort((a, b) => {
      const da = Math.abs((a.dateActual || a.createdAt) - now);
      const db = Math.abs((b.dateActual || b.createdAt) - now);
      return da - db;
    });
  } else {
    // F15F: title matches first
    matched.sort((a, b) => {
      const aHit = (caseSensitive ? a.copyText : a.copyText.toLowerCase()).includes(q) ? 0 : 1;
      const bHit = (caseSensitive ? b.copyText : b.copyText.toLowerCase()).includes(q) ? 0 : 1;
      return aHit - bHit;
    });
  }

  if (matched.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'search-no-results';
    noResults.textContent = `Ничего не найдено по запросу "${query}"`;
    notesList.appendChild(noResults);
    return;
  }

  const searchCtx = { query: q, caseSensitive };
  matched.forEach((note) => {
    notesList.appendChild(createNoteEl(note, false, false, searchCtx));
  });
}

// --- Render ---

function render() {
  focusedNoteIndex = -1;
  notesList.innerHTML = '';
  emptyState.classList.add('hidden');

  const parentId = getCurrentParentId();

  // Hide add button in trash view
  addBtn.classList.toggle('hidden', parentId === TRASH_ID);

  // F8F: search mode — show global results instead of current level
  const query = searchInput.value.trim();
  if (query) {
    renderSearchResults(query);
    notesCount.textContent = notes.filter(n => !n.deletedAt).length || '';
    return;
  }

  // Trash view
  if (parentId === TRASH_ID) {
    const trashNotes = notes.filter(n => !!n.deletedAt).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
    const metaEl = document.createElement('div');
    metaEl.className = 'folder-meta';
    metaEl.innerHTML = `
      <div class="folder-meta-title">\u{1F5D1}\uFE0F Корзина</div>
      <div class="folder-meta-actions">
        <button class="trash-empty-btn" title="Навсегда удалить все заметки из корзины">\u{1F5D1}\uFE0F Очистить корзину</button>
      </div>
    `;
    metaEl.querySelector('.trash-empty-btn').addEventListener('click', () => {
      const count = trashNotes.length;
      const msg = `Навсегда удалить ${count} ${count === 1 ? 'заметку' : 'заметок'} из корзины?`;
      showConfirmDelete(msg, emptyTrash);
    });
    notesList.appendChild(metaEl);

    if (trashNotes.length === 0) {
      emptyState.querySelector('p:first-child').textContent = 'Корзина пуста';
      emptyState.classList.remove('hidden');
    }

    trashNotes.forEach(note => {
      notesList.appendChild(createTrashNoteEl(note));
    });

    notesCount.textContent = notes.filter(n => !n.deletedAt).length || '';
    return;
  }

  // Show current folder's meta at the top
  if (navStack.length > 0) {
    const parentNote = notes.find((n) => n.id === parentId);
    if (parentNote) {
      const metaEl = document.createElement('div');
      metaEl.className = 'folder-meta';
      const dateActualStr = parentNote.dateActual
        ? new Date(parentNote.dateActual).toLocaleString()
        : new Date(parentNote.createdAt).toLocaleString();
      metaEl.innerHTML = `
        <div class="folder-meta-top">
          <div class="folder-meta-title">${escapeHtml(parentNote.copyText)}</div>
          <div class="folder-meta-menu">
            <button class="folder-meta-btn-menu" title="Actions">&#8943;</button>
            <div class="folder-meta-dropdown hidden">
              <button class="folder-meta-edit">&#9998; Edit</button>
              <button class="folder-meta-cut">&#9986; Cut</button>
              <button class="folder-meta-copy">&#10697; Copy</button>
              <button class="folder-meta-copy-deep">&#10697; Copy with children</button>
              <button class="folder-meta-delete">&#10005; Delete</button>
            </div>
          </div>
        </div>
        ${parentNote.description ? `<div class="folder-meta-description">${escapeHtml(parentNote.description)}</div>` : ''}
        ${parentNote.url ? `<button class="btn-url folder-meta-url" title="${escapeHtml(parentNote.url)}">${escapeHtml(parentNote.url)}</button>` : ''}
        <div class="folder-meta-actual">
          <span class="folder-meta-actual-date" title="Date last marked as relevant">${escapeHtml(dateActualStr)}</span>
          <button class="folder-meta-actual-btn" title="Mark as relevant now">update date actual</button>
        </div>
        ${parentNote.img ? `<img class="folder-meta-img" src="${escapeHtml(parentNote.img)}" alt="" loading="lazy">` : ''}
      `;
      const folderMenuBtn = metaEl.querySelector('.folder-meta-btn-menu');
      const folderDropdown = metaEl.querySelector('.folder-meta-dropdown');
      const folderMenu = metaEl.querySelector('.folder-meta-menu');
      folderMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !folderDropdown.classList.contains('hidden');
        document.querySelectorAll('.note-dropdown').forEach(d => d.classList.add('hidden'));
        document.querySelectorAll('.note-menu').forEach(m => m.classList.remove('open'));
        if (isOpen) {
          folderDropdown.classList.add('hidden');
          folderMenu.classList.remove('open');
        } else {
          folderDropdown.classList.remove('hidden');
          folderMenu.classList.add('open');
        }
      });
      if (parentNote.url) {
        metaEl.querySelector('.folder-meta-url').addEventListener('click', () => {
          const url = /^https?:\/\//i.test(parentNote.url) ? parentNote.url : 'https://' + parentNote.url;
          window.open(url, '_blank');
        });
      }
      metaEl.querySelector('.folder-meta-actual-btn').addEventListener('click', () => {
        parentNote.dateActual = Date.now();
        saveNotes().then(() => {
          scheduleSync(parentNote, 'upsert');
          render();
        });
      });
      // F2F: edit current folder
      metaEl.querySelector('.folder-meta-edit').addEventListener('click', () => {
        startEdit(parentNote);
      });
      // cut current folder and navigate to parent so it's visible as cut
      metaEl.querySelector('.folder-meta-cut').addEventListener('click', () => {
        const originParentId = navStack.length > 1 ? navStack[navStack.length - 2].id : null;
        cutToClipboard([{ id: parentNote.id, isSymlink: false }], originParentId);
        navStack.pop();
        updateNavBar();
        render();
      });
      metaEl.querySelector('.folder-meta-copy').addEventListener('click', () => {
        markForCopy(parentNote.id, 'copy-shallow');
        render();
      });
      metaEl.querySelector('.folder-meta-copy-deep').addEventListener('click', () => {
        markForCopy(parentNote.id, 'copy-deep');
        render();
      });
      // F3F: delete current folder and navigate to parent (soft delete)
      metaEl.querySelector('.folder-meta-delete').addEventListener('click', () => {
        const allDesc = collectDescendants(parentNote.id);
        const activeCount = allDesc.filter(id => { const n = notes.find(x => x.id === id); return n && !n.deletedAt; }).length;
        const childCount = activeCount - 1;
        const confirmMsg = childCount > 0
          ? `Удалить папку «${parentNote.copyText}» и ${childCount} вложенных заметок?`
          : `Удалить папку «${parentNote.copyText}»?`;
        showConfirmDelete(confirmMsg, () => {
          const idsToDelete = new Set(allDesc);
          const now = Date.now();
          const affectedIds = [];
          notes.forEach(n => {
            if (idsToDelete.has(n.id) && !n.deletedAt) {
              n.deletedAt = now;
              n.updatedAt = now;
              affectedIds.push(n.id);
            }
          });
          navStack.pop();
          updateNavBar();
          reorderNotes();
          saveNotes().then(() => render());
          const msg = affectedIds.length > 1
            ? `Удалено ${affectedIds.length} заметок`
            : 'Заметка удалена';
          showUndoToast(msg, affectedIds, affectedIds);
        });
      });
      notesList.appendChild(metaEl);
    }
  }

  const currentNotes = notes
    .filter((n) => {
      if (n.deletedAt) return false;
      const isPrimary = (n.parentId || null) === parentId;
      const isSymlink = parentId === null
        ? n.parentId !== null && ensureArray(n.parentIdsOther).includes('')
        : ensureArray(n.parentIdsOther).includes(parentId);
      return isPrimary || isSymlink;
    })
    .sort((a, b) => a.order - b.order);

  if (currentNotes.length === 0) {
    const hasTrash = parentId === null && notes.some(n => !!n.deletedAt);
    if (!hasTrash) {
      emptyState.querySelector('p:first-child').textContent =
        navStack.length > 0 ? 'Нет дочерних элементов' : 'Заметок нет';
      emptyState.classList.remove('hidden');
    }
  }

  // Trash entry at root level (at the top)
  if (parentId === null) {
    const trashCount = notes.filter(n => !!n.deletedAt).length;
    if (trashCount > 0) {
      const trashEl = document.createElement('div');
      trashEl.className = 'note-item trash-entry';
      trashEl.innerHTML = `
        <div class="note-content">
          <div class="note-copy-text">
            <span class="folder-icon">\u{1F5D1}\uFE0F</span>
            <span class="note-title-text">Корзина</span>
            <span class="folder-count" title="${trashCount} удалённых заметок">${trashCount}</span>
          </div>
        </div>
      `;
      trashEl.addEventListener('click', () => {
        exitSelectMode();
        searchInput.value = '';
        searchClear.classList.add('hidden');
        navStack = [{ id: TRASH_ID, copyText: '\u{1F5D1}\uFE0F Корзина' }];
        updateNavBar();
        render();
      });
      notesList.appendChild(trashEl);
    }
  }

  currentNotes.forEach((note) => {
    const isSymlink = parentId === null
      ? note.parentId !== null && ensureArray(note.parentIdsOther).includes('')
      : ensureArray(note.parentIdsOther).includes(parentId);
    notesList.appendChild(createNoteEl(note, isSymlink, true));
  });

  // Symlinks: show other parent locations of the current folder note
  if (navStack.length > 0) {
    const parentNote = notes.find((n) => n.id === parentId);
    if (parentNote) {
      const others = ensureArray(parentNote.parentIdsOther).filter((pid) => {
        if (pid === undefined || pid === null) return false;
        if (pid === '') return true;
        const pn = notes.find(n => n.id === pid);
        return pn && !pn.deletedAt;
      });
      if (others.length > 0) {
        const simlinBlock = document.createElement('div');
        simlinBlock.className = 'symlinks-block';
        const titleEl = document.createElement('div');
        titleEl.className = 'symlinks-title';
        titleEl.textContent = 'as symlink paths';
        simlinBlock.appendChild(titleEl);

        others.forEach((otherId) => {
          const isRoot = otherId === '';
          const otherNote = isRoot ? null : notes.find((n) => n.id === otherId);
          if (!isRoot && !otherNote) return; // orphaned ref

          // altNavStack: the navStack that would exist if navigated via this symlink path
          const altNavStack = isRoot ? [] : buildNavStackFor(otherNote);

          const rowEl = document.createElement('div');
          rowEl.className = 'symlink-row';

          // Back button — mirrors .nav-back-btn
          const backLabel = altNavStack.length > 0
            ? altNavStack[altNavStack.length - 1].copyText
            : 'Root';
          const backEl = document.createElement('button');
          backEl.className = 'nav-back-btn symlink-back-btn';
          backEl.textContent = '\u2190 ' + backLabel;
          backEl.addEventListener('click', () => {
            if (isRoot) {
              navStack = [];
              updateNavBar();
              render();
            } else {
              navigateInto(otherNote);
            }
          });
          rowEl.appendChild(backEl);

          // Breadcrumbs — mirrors .nav-breadcrumbs
          const crumbsEl = document.createElement('div');
          crumbsEl.className = 'nav-breadcrumbs';

          const rootCrumb = document.createElement('span');
          rootCrumb.className = 'nav-crumb';
          rootCrumb.textContent = 'Root';
          rootCrumb.addEventListener('click', () => { navStack = []; updateNavBar(); render(); });
          crumbsEl.appendChild(rootCrumb);

          altNavStack.forEach((item, index) => {
            const sep = document.createElement('span');
            sep.className = 'nav-crumb-sep';
            sep.textContent = ' › ';
            crumbsEl.appendChild(sep);

            const crumb = document.createElement('span');
            crumb.className = 'nav-crumb';
            crumb.textContent = item.copyText;
            crumb.addEventListener('click', () => {
              navStack = altNavStack.slice(0, index + 1);
              updateNavBar();
              render();
            });
            crumbsEl.appendChild(crumb);
          });

          rowEl.appendChild(crumbsEl);
          simlinBlock.appendChild(rowEl);
        });

        notesList.appendChild(simlinBlock);
      }
    }
  }

  notesCount.textContent = notes.filter(n => !n.deletedAt).length || '';
}

// --- CRUD ---

function addNote(copyText, description, url, img, isFastCopy) {
  const now = Date.now();
  const note = {
    id: makeId(),
    copyText,
    description,
    url,
    img,
    parentId: getCurrentParentId(),
    parentIdsOther: [],
    isFastCopy: !!isFastCopy,
    order: 0,
    createdAt: now,
    updatedAt: now,
    dateActual: now,
  };
  notes.unshift(note);
  reorderNotes();
  saveNotes().then(() => {
    render();
    scheduleBatchSync();
  });
}

function updateNote(id, copyText, description, url, img, isFastCopy) {
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.copyText = copyText;
    note.description = description;
    note.url = url;
    note.img = img;
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

function removeOrphanedSymlinks(idsToDelete) {
  notes.forEach((n) => {
    const others = ensureArray(n.parentIdsOther);
    if (others.some((pid) => idsToDelete.has(pid))) {
      n.parentIdsOther = others.filter((pid) => !idsToDelete.has(pid));
    }
  });
}

function deleteNote(id) {
  const idsToDelete = new Set(collectDescendants(id));
  const now = Date.now();
  const affectedIds = [];
  notes.forEach(n => {
    if (idsToDelete.has(n.id) && !n.deletedAt) {
      n.deletedAt = now;
      n.updatedAt = now;
      affectedIds.push(n.id);
    }
  });
  reorderNotes();
  saveNotes().then(() => render());
  const msg = affectedIds.length > 1
    ? `Удалено ${affectedIds.length} заметок`
    : 'Заметка удалена';
  showUndoToast(msg, affectedIds, affectedIds);
}

function reorderNotes() {
  notes.forEach((note, i) => {
    note.order = i;
  });
}

// --- Confirm modal ---

function showConfirmDelete(message, onConfirm) {
  confirmMessage.textContent = message;
  confirmModal.classList.remove('hidden');
  confirmOkBtn.onclick = () => {
    confirmModal.classList.add('hidden');
    onConfirm();
  };
  confirmCancelBtn.onclick = () => {
    confirmModal.classList.add('hidden');
  };
}

// --- Undo delete ---

function showUndoToast(msg, affectedIds, syncIds) {
  if (undoTimeout) { clearTimeout(undoTimeout); commitPendingDelete(); }
  deletedSnapshot = { affectedIds, syncIds };
  toast.innerHTML = `${escapeHtml(msg)} <button class="toast-undo-btn">Undo</button>`;
  toast.classList.remove('hidden');
  toast.querySelector('.toast-undo-btn').addEventListener('click', undoDelete);
  undoTimeout = setTimeout(() => {
    commitPendingDelete();
    toast.classList.add('hidden');
  }, 5000);
}

function undoDelete() {
  if (!deletedSnapshot) return;
  clearTimeout(undoTimeout);
  undoTimeout = null;
  deletedSnapshot.affectedIds.forEach(id => {
    const note = notes.find(n => n.id === id);
    if (note) delete note.deletedAt;
  });
  reorderNotes();
  saveNotes().then(() => render());
  deletedSnapshot = null;
  toast.classList.add('hidden');
}

function commitPendingDelete() {
  if (!deletedSnapshot) return;
  deletedSnapshot.affectedIds.forEach(id => {
    const note = notes.find(n => n.id === id);
    if (note) scheduleSync(note, 'upsert');
  });
  deletedSnapshot = null;
  undoTimeout = null;
}

function emptyTrash() {
  const trashNotes = notes.filter(n => !!n.deletedAt);
  const trashIds = trashNotes.map(n => n.id);
  const idsToRemove = new Set(trashIds);
  notes = notes.filter(n => !n.deletedAt);
  removeOrphanedSymlinks(idsToRemove);
  reorderNotes();
  if (getCurrentParentId() === TRASH_ID) {
    navStack = [];
    updateNavBar();
  }
  saveNotes().then(() => render());
  trashIds.forEach(id => scheduleSync({ id }, 'delete'));
}

// --- Form ---

function showForm() {
  formContainer.classList.remove('hidden');
  navBar.classList.add('hidden');
  inputCopy.focus();
}

function hideForm() {
  formContainer.classList.add('hidden');
  formAdvanced.open = false;
  updateNavBar();
  inputCopy.value = '';
  inputDesc.value = '';
  inputUrl.value = '';
  inputImg.value = '';
  inputFastCopy.checked = false;
  formIdRow.classList.add('hidden');
  formIdValue.textContent = '';
  editingId = null;
}

function startEdit(note) {
  editingId = note.id;
  inputCopy.value = note.copyText;
  inputDesc.value = note.description;
  inputUrl.value = note.url || '';
  inputImg.value = note.img || '';
  inputFastCopy.checked = !!note.isFastCopy;
  formAdvanced.open = !!note.isFastCopy;
  formIdValue.textContent = note.id;
  formIdRow.classList.remove('hidden');
  showForm();
}

addBtn.addEventListener('click', () => {
  editingId = null;
  inputCopy.value = '';
  inputDesc.value = '';
  inputUrl.value = '';
  inputImg.value = '';
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
  const img = inputImg.value.trim();
  const isFastCopy = inputFastCopy.checked;

  if (editingId) {
    updateNote(editingId, copyText, description, url, img, isFastCopy);
  } else {
    addNote(copyText, description, url, img, isFastCopy);
  }
  hideForm();
});

// Save on Enter in last field
inputUrl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') inputImg.focus();
});

inputImg.addEventListener('keydown', (e) => {
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
  // Commit any pending undo before showing a plain toast
  if (undoTimeout) { clearTimeout(undoTimeout); commitPendingDelete(); }
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
  document.querySelectorAll('.drag-over, .drag-nest').forEach((el) => {
    el.classList.remove('drag-over', 'drag-nest');
  });
  draggedId = null;
  dropMode = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (this.dataset.id === draggedId) return;

  const rect = this.getBoundingClientRect();
  const isTopZone = (e.clientY - rect.top) < rect.height * 0.35;

  document.querySelectorAll('.drag-over, .drag-nest').forEach((el) => {
    if (el !== this) el.classList.remove('drag-over', 'drag-nest');
  });

  if (isTopZone) {
    this.classList.add('drag-over');
    this.classList.remove('drag-nest');
    dropMode = 'before';
  } else {
    this.classList.add('drag-nest');
    this.classList.remove('drag-over');
    dropMode = 'nest';
  }
}

function handleDragEnter(e) {
  e.preventDefault();
}

function handleDragLeave(e) {
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('drag-over', 'drag-nest');
  }
}

function handleDrop(e) {
  e.preventDefault();
  const targetId = this.dataset.id;
  const mode = dropMode;
  this.classList.remove('drag-over', 'drag-nest');

  if (targetId === draggedId) return;

  if (mode === 'nest') {
    // Prevent nesting into own descendant (circular reference)
    if (new Set(collectDescendants(draggedId)).has(targetId)) return;
    const draggedNote = notes.find((n) => n.id === draggedId);
    if (!draggedNote) return;
    draggedNote.parentId = targetId;
    draggedNote.updatedAt = Date.now();
    reorderNotes();
    saveNotes().then(() => {
      render();
      scheduleSync(draggedNote, 'upsert');
    });
  } else {
    const draggedIndex = notes.findIndex((n) => n.id === draggedId);
    const targetIndex = notes.findIndex((n) => n.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const [moved] = notes.splice(draggedIndex, 1);
    notes.splice(targetIndex, 0, moved);
    reorderNotes();
    saveNotes().then(() => {
      render();
      scheduleBatchSync();
    });
  }
}

// --- Sync ---

// Convert a Supabase row to local note format
function serverRowToNote(row) {
  return {
    id: row.local_id,
    copyText: row.copy_text,
    description: row.description || '',
    url: row.url || '',
    img: row.img || '',
    parentId: row.parent_id || null,
    parentIdsOther: ensureArray(row.parent_ids_other),
    isFastCopy: row.is_fast_copy || false,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dateActual: row.date_actual ? new Date(row.date_actual).getTime() : (row.created_at || Date.now()),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
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
  _batchSyncTimer = setTimeout(() => upsertNotesBatch(notes.filter(n => !n.deletedAt)), 1500);
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
        notes.push(serverRowToNote(row));
        changed = true;
      } else if (row.updated_at > (local.updatedAt || local.createdAt)) {
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
          return false;
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
    // Persist refreshed tokens (access token may have been renewed)
    await chrome.storage.local.set({ supabaseSession: session });
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

// F7F: search controls
searchInput.addEventListener('input', () => {
  searchClear.classList.toggle('hidden', searchInput.value === '');
  render();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.add('hidden');
  render();
  searchInput.focus();
});

[searchTitleCb, searchDescCb, searchUrlCb, searchCaseCb, searchSort].forEach((el) => {
  el.addEventListener('change', () => {
    if (searchInput.value) render();
  });
});

backBtn.addEventListener('click', navigateBack);

// F21F: exit select mode
resetSelectedBtn.addEventListener('click', () => {
  exitSelectMode();
  updateNavBar();
  render();
});

// F22F: delete selected notes (with all descendants); symlinks are unlinked
deleteSelectedBtn.addEventListener('click', () => {
  if (selectedNoteIds.size === 0) return;

  const currentParentId = getCurrentParentId();
  const parentKey = currentParentId ?? '';

  const symlinkIds = new Set();
  const primaryIds = new Set();
  for (const id of selectedNoteIds) {
    const n = notes.find(x => x.id === id);
    if (!n) continue;
    const isSym = currentParentId === null
      ? n.parentId !== null && ensureArray(n.parentIdsOther).includes('')
      : ensureArray(n.parentIdsOther).includes(currentParentId);
    if (isSym) symlinkIds.add(id); else primaryIds.add(id);
  }

  function unlinkSymlinks() {
    const now = Date.now();
    symlinkIds.forEach(id => {
      const n = notes.find(x => x.id === id);
      if (!n) return;
      n.parentIdsOther = ensureArray(n.parentIdsOther).filter(p => p !== parentKey);
      n.updatedAt = now;
      scheduleSync(n, 'upsert');
    });
  }

  if (primaryIds.size === 0) {
    unlinkSymlinks();
    exitSelectMode();
    saveNotes().then(() => { updateNavBar(); render(); });
    return;
  }

  const count = primaryIds.size;
  const confirmMsg = count === 1
    ? 'Удалить выбранную заметку?'
    : `Удалить ${count} выбранных заметок?`;
  showConfirmDelete(confirmMsg, () => {
    unlinkSymlinks();

    const idsToDelete = new Set();
    for (const id of primaryIds) {
      for (const descendant of collectDescendants(id)) {
        idsToDelete.add(descendant);
      }
    }

    const now = Date.now();
    const affectedIds = [];
    notes.forEach(n => {
      if (idsToDelete.has(n.id) && !n.deletedAt) {
        n.deletedAt = now;
        n.updatedAt = now;
        affectedIds.push(n.id);
      }
    });
    reorderNotes();
    exitSelectMode();
    saveNotes().then(() => { updateNavBar(); render(); });

    const msg = count === 1
      ? 'Заметка удалена'
      : `Удалено ${count} заметок`;
    showUndoToast(msg, affectedIds, affectedIds);
  });
});

// Move selected
cutSelectedBtn.addEventListener('click', () => {
  if (selectedNoteIds.size === 0) return;
  const currentParentId = getCurrentParentId();
  const sources = [...selectedNoteIds].map((id) => {
    const n = notes.find((n) => n.id === id);
    const isSymlink = currentParentId === null
      ? n.parentId !== null && ensureArray(n.parentIdsOther).includes('')
      : ensureArray(n.parentIdsOther).includes(currentParentId);
    return { id, isSymlink };
  });
  cutToClipboard(sources, currentParentId);
  exitSelectMode();
  updateNavBar();
  render();
});

clipboardPasteBtn.addEventListener('click', () => {
  if (clipboard?.mode === 'cut') executeMove(getCurrentParentId());
  else executeCopy(getCurrentParentId());
});

clipboardSymlinkBtn.addEventListener('click', () => {
  executePasteAsSymlink(getCurrentParentId());
});

clipboardClearBtn.addEventListener('click', () => {
  clearClipboard();
  render();
});

clipboardViewBtn.addEventListener('click', () => {
  const isHidden = clipboardPreview.classList.contains('hidden');
  if (isHidden) {
    renderClipboardPreview();
    clipboardPreview.classList.remove('hidden');
    clipboardViewBtn.textContent = 'hide';
  } else {
    clipboardPreview.classList.add('hidden');
    clipboardViewBtn.textContent = 'view';
  }
});

document.addEventListener('click', () => {
  document.querySelectorAll('.note-dropdown').forEach((d) => d.classList.add('hidden'));
  document.querySelectorAll('.note-menu').forEach((m) => m.classList.remove('open'));
  document.querySelectorAll('.folder-meta-dropdown').forEach(d => d.classList.add('hidden'));
  document.querySelectorAll('.folder-meta-menu').forEach(m => m.classList.remove('open'));
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  const formVisible = !formContainer.classList.contains('hidden');

  if (e.key === 'Escape') {
    if (formVisible) {
      hideForm();
    } else if (searchInput.value) {
      searchInput.value = '';
      searchClear.classList.add('hidden');
      render();
      searchInput.focus();
    } else if (navStack.length > 0) {
      navigateBack();
    }
    return;
  }

  // Don't intercept keys when typing in inputs
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (formVisible) return;

  const items = [...notesList.querySelectorAll('.note-item')];
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusedNoteIndex = Math.min(focusedNoteIndex + 1, items.length - 1);
    setFocusedNote(focusedNoteIndex);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusedNoteIndex = Math.max(focusedNoteIndex - 1, 0);
    setFocusedNote(focusedNoteIndex);
  } else if (e.key === 'Enter') {
    if (focusedNoteIndex >= 0 && focusedNoteIndex < items.length) {
      e.preventDefault();
      items[focusedNoteIndex].click();
    }
  }
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
