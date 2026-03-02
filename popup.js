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
const showTimeOptions = document.getElementById('show-time-options');
const inputTimezone = document.getElementById('input-timezone');
const showWeatherOptions = document.getElementById('show-weather-options');
const inputWeatherCity = document.getElementById('input-weather-city');
const formAdvanced = document.getElementById('form-advanced');
const formTags = document.getElementById('form-tags');
const tagsContainer = document.getElementById('tags-container');
const tagsAddGroupBtn = document.getElementById('tags-add-group-btn');
const inputIsTag = document.getElementById('input-is-tag');
const tagColorContainer = document.getElementById('tag-color-container');
const inputTagColor = document.getElementById('input-tag-color');
const tagColorPalette = document.getElementById('tag-color-palette');

const TAG_COLORS = [
  '#e74c3c', '#e67e22', '#f39c12', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#2980b9', '#9b59b6', '#8e44ad',
  '#e91e63', '#ff5722', '#795548', '#607d8b', '#00bcd4',
  '#8bc34a', '#ff9800', '#673ab7', '#4caf50', '#009688',
];

if (tagColorPalette) {
  TAG_COLORS.forEach(color => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'tag-color-swatch';
    sw.style.background = color;
    sw.dataset.color = color;
    sw.title = color;
    sw.addEventListener('click', () => setTagColor(color));
    tagColorPalette.appendChild(sw);
  });
}

function setTagColor(color) {
  if (inputTagColor) inputTagColor.value = color;
  tagColorPalette?.querySelectorAll('.tag-color-swatch').forEach(sw => {
    sw.classList.toggle('selected', sw.dataset.color === color);
  });
}
const formAdvancedSpecial = document.getElementById('form-advanced-special');
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
const thumbsBtn = document.getElementById('thumbs-btn');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const searchTitleCb = document.getElementById('search-title');
const searchDescCb = document.getElementById('search-desc');
const searchUrlCb = document.getElementById('search-url');
const searchCaseCb = document.getElementById('search-case');
const sortPicker = document.getElementById('sort-picker');
const sortPickerHeader = document.getElementById('sort-picker-header');
const sortPickerValue = document.getElementById('sort-picker-value');
const sortPickerArrow = document.getElementById('sort-picker-arrow');
const sortPickerDropdown = document.getElementById('sort-picker-dropdown');
const sortDirBtn = document.getElementById('sort-dir-btn');

// Side panel detection: popup height is constrained by CSS max-height (500px),
// side panel fills the full window height
if (window.innerHeight > 550) {
  document.body.classList.add('side-panel');
}

let notes = [];
let editingId = null;

// F27F/F28F/F30F/F31F: Advanced Special radio helpers
function getSpecialMode() {
  return document.querySelector('input[name="special-mode"]:checked')?.value || 'none';
}
function setSpecialMode(mode) {
  const radio = document.querySelector(`input[name="special-mode"][value="${mode}"]`);
  if (radio) radio.checked = true;
  showTimeOptions.classList.toggle('hidden', mode !== 'time');
  showWeatherOptions.classList.toggle('hidden', mode !== 'weather');
}
function getWeatherType() {
  return document.querySelector('input[name="weather-type"]:checked')?.value || 'min';
}
function setWeatherType(type) {
  const radio = document.querySelector(`input[name="weather-type"][value="${type}"]`);
  if (radio) radio.checked = true;
}
let draggedId = null;
let dropMode = null; // 'before' | 'nest'
let toastTimeout = null;
let navStack = []; // [{id: string, copyText: string}]
let selectMode = false; // F19F/F20F/F21F select mode
let selectedNoteIds = new Set(); // selected note ids in select mode

const TRASH_ID = '__trash__';

// --- Sort picker ---
let currentSort = 'default';
let sortReversed = false;
const SORT_LABELS = { default: 'по умолчанию', date: 'по дате актуальности', created: 'по дате создания', updated: 'по дате изменения', children: 'по кол-ву дочерних' };

function countAllChildren(noteId) {
  return collectAllDescendants(noteId).length - 1;
}

sortPickerHeader.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = !sortPickerDropdown.classList.contains('hidden');
  sortPickerDropdown.classList.toggle('hidden', isOpen);
  sortPickerArrow.textContent = isOpen ? '▾' : '▴';
});

sortPickerDropdown.querySelectorAll('input[name="note-sort"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    currentSort = radio.value;
    sortPickerValue.textContent = SORT_LABELS[currentSort];
    sortPickerDropdown.classList.add('hidden');
    sortPickerArrow.textContent = '▾';
    chrome.storage.local.set({ sortKey: currentSort });
    render();
  });
});

sortDirBtn.addEventListener('click', () => {
  sortReversed = !sortReversed;
  sortDirBtn.textContent = sortReversed ? '↑' : '↓';
  chrome.storage.local.set({ sortReversed });
  render();
});

function loadSort() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ sortKey: 'default', sortReversed: false }, (data) => {
      currentSort = data.sortKey;
      sortReversed = data.sortReversed;
      sortPickerValue.textContent = SORT_LABELS[currentSort] || SORT_LABELS.default;
      const radio = sortPickerDropdown.querySelector(`input[value="${currentSort}"]`);
      if (radio) radio.checked = true;
      sortDirBtn.textContent = sortReversed ? '↑' : '↓';
      resolve();
    });
  });
}

document.addEventListener('click', (e) => {
  if (!sortPicker.contains(e.target)) {
    sortPickerDropdown.classList.add('hidden');
    sortPickerArrow.textContent = '▾';
  }
});

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
  if (!navBar) return;

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

  saveNavStack();
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
    try { const parsed = JSON.parse(val); if (Array.isArray(parsed)) return parsed; } catch { }
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

// --- Thumbnails ---

let showThumbs = false;

function applyThumbs() {
  document.body.classList.toggle('show-thumbs', showThumbs);
  thumbsBtn.classList.toggle('active', showThumbs);
  thumbsBtn.title = showThumbs ? 'Hide image thumbnails' : 'Show image thumbnails';
}

function loadThumbs() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ showThumbs: false }, (data) => {
      showThumbs = data.showThumbs;
      applyThumbs();
      resolve();
    });
  });
}

thumbsBtn.addEventListener('click', () => {
  showThumbs = !showThumbs;
  applyThumbs();
  chrome.storage.local.set({ showThumbs });
});

// --- Storage ---

function loadNotes() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ notes: [], navStack: [] }, (data) => {
      notes = data.notes.sort((a, b) => a.order - b.order);
      let sanitized = false;
      for (const n of notes) {
        if (n.parentIdsOther && !Array.isArray(n.parentIdsOther)) {
          n.parentIdsOther = ensureArray(n.parentIdsOther);
          sanitized = true;
        }
      }

      // Restore valid navStack items
      let restoredNavStack = Array.isArray(data.navStack) ? data.navStack : [];
      navStack = restoredNavStack.filter(item => {
        if (item.id === TRASH_ID) return true;
        const n = notes.find(x => x.id === item.id);
        return n && !n.deletedAt;
      });

      if (sanitized) saveNotes();
      resolve();
    });
  });
}

function saveNavStack() {
  chrome.storage.local.set({ navStack });
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

  // New elements for tag badge and tags display
  const textEl = document.createElement('span');
  textEl.className = 'note-text';
  textEl.textContent = note.copyText;
  textEl.title = note.isFastCopy ? 'Click to copy text' : 'Click to open note';

  let tagBadgeHtml = '';
  if (note.isTag) {
    const color = note.tagColor || '#4a90d9';
    tagBadgeHtml = `<span class="note-tag-badge" style="background-color: ${color}33; border-color: ${color}; color: ${color};">tag</span>`;
  }

  let tagsDisplayHtml = '';
  if (note.tags && note.tags.length > 0) {
    const groupsHtml = note.tags.map(group => {
      const ids = ensureArray(group);
      const itemsHtml = ids.map(tagId => {
        const tagNote = notes.find(n => n.id === tagId && n.isTag);
        return tagNote ? `<span class="note-tag-item">${escapeHtml(tagNote.copyText)}</span>` : '';
      }).filter(Boolean).join('<span class="note-tag-sep">|</span>');
      if (!itemsHtml) return '';
      const firstTag = ids.map(id => notes.find(n => n.id === id && n.isTag)).find(Boolean);
      const color = firstTag ? (firstTag.tagColor || '#4a90d9') : '#4a90d9';
      return `<span class="note-tag-group-display" style="background-color:${color}22;border-color:${color};color:${color};">${itemsHtml}</span>`;
    }).filter(Boolean).join('');
    if (groupsHtml) tagsDisplayHtml = `<div class="note-tags-display">${groupsHtml}</div>`;
  }

  el.innerHTML = `
    ${showDragHandle ? '<div class="drag-handle" title="Drag to reorder">&#8942;&#8942;</div>' : ''}
    ${showCheckbox ? `<label class="note-select-wrap" title="Select"><input type="checkbox" class="note-select-cb"${selectedNoteIds.has(note.id) ? ' checked' : ''}></label>` : ''}
    <div class="note-content">
      <div class="note-copy-text">
        ${isFolder ? '<span class="folder-icon" title="Contains child notes">&#128193;</span>' : ''}
        <span class="note-title-text">${titleHtml}</span>
        ${folderCountHtml}
        ${tagBadgeHtml}
        ${isSymlink ? '<span class="symlink-badge" title="Symlink: this note appears here via an additional parent">symlink</span>' : ''}
      </div>
      ${descHtml ? `<div class="note-description">${descHtml}</div>` : ''}
      ${pathHtml}
      ${note.showTime ? `<span class="note-clock" data-tz="${escapeHtml(note.timezone || '')}"></span>` : ''}
      ${note.showWeather ? (note.weatherCity ? `<span class="note-weather" data-city="${escapeHtml(note.weatherCity)}" data-weather-type="${escapeHtml(note.weatherType || 'min')}"><span class="weather-temp">...</span><span class="weather-city">${escapeHtml(note.weatherCity)}</span></span>` : '<span class="note-weather note-weather-empty">city not set</span>') : ''}
      ${note.url ? `<button class="btn-url" title="${escapeHtml(note.url)}">${escapeHtml(urlHostname(note.url))}</button>` : ''}
      ${note.img ? '<span class="btn-img" title="Has image">img</span>' : ''}
      ${tagsDisplayHtml}
      ${note.img ? `<div class="note-thumb-wrap img-loading"><img class="note-thumb" src="${escapeHtml(note.img)}" alt="" loading="lazy"></div>` : ''}
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

  // Image loader for note thumbnail
  if (note.img) {
    const thumb = el.querySelector('.note-thumb');
    const thumbWrap = el.querySelector('.note-thumb-wrap');
    const doneThumb = () => thumbWrap.classList.remove('img-loading');
    if (thumb.complete) doneThumb();
    else {
      thumb.addEventListener('load', doneThumb);
      thumb.addEventListener('error', doneThumb);
    }
  }

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
      updateNote(note.id, val, note.description, note.url, note.img, note.isFastCopy, note.showTime, note.timezone, note.showWeather, note.weatherCity, note.weatherType);
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

  const dir = sortReversed ? -1 : 1;
  if (currentSort === 'date') {
    const now = Date.now();
    matched.sort((a, b) => dir * (Math.abs((a.dateActual || a.createdAt) - now) - Math.abs((b.dateActual || b.createdAt) - now)));
  } else if (currentSort === 'created') {
    matched.sort((a, b) => dir * (b.createdAt - a.createdAt));
  } else if (currentSort === 'updated') {
    matched.sort((a, b) => dir * ((b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)));
  } else if (currentSort === 'children') {
    matched.sort((a, b) => dir * (countAllChildren(b.id) - countAllChildren(a.id)));
  } else {
    // F15F: title matches first
    matched.sort((a, b) => {
      const aHit = (caseSensitive ? a.copyText : a.copyText.toLowerCase()).includes(q) ? 0 : 1;
      const bHit = (caseSensitive ? b.copyText : b.copyText.toLowerCase()).includes(q) ? 0 : 1;
      return dir * (aHit - bHit);
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
  updateNavBar();

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
      let metaTagBadgeHtml = '';
      if (parentNote.isTag) {
        const color = parentNote.tagColor || '#4a90d9';
        metaTagBadgeHtml = `<span class="note-tag-badge" style="background-color: ${color}33; border-color: ${color}; color: ${color};">tag</span>`;
      }
      let metaTagsDisplayHtml = '';
      if (parentNote.tags && parentNote.tags.length > 0) {
        const groupsHtml = parentNote.tags.map(group => {
          const ids = ensureArray(group);
          const itemsHtml = ids.map(tagId => {
            const tagNote = notes.find(n => n.id === tagId && n.isTag);
            return tagNote ? `<span class="note-tag-item">${escapeHtml(tagNote.copyText)}</span>` : '';
          }).filter(Boolean).join('<span class="note-tag-sep">|</span>');
          if (!itemsHtml) return '';
          const firstTag = ids.map(id => notes.find(n => n.id === id && n.isTag)).find(Boolean);
          const color = firstTag ? (firstTag.tagColor || '#4a90d9') : '#4a90d9';
          return `<span class="note-tag-group-display" style="background-color:${color}22;border-color:${color};color:${color};">${itemsHtml}</span>`;
        }).filter(Boolean).join('');
        if (groupsHtml) metaTagsDisplayHtml = `<div class="note-tags-display">${groupsHtml}</div>`;
      }
      metaEl.innerHTML = `
        <div class="folder-meta-top">
          <div class="folder-meta-title">${escapeHtml(parentNote.copyText)}${metaTagBadgeHtml}</div>
          <div class="folder-meta-menu">
            <button class="folder-meta-edit-hover-btn" title="Edit">&#9998; Edit</button>
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
        ${metaTagsDisplayHtml}
        ${parentNote.url ? `<button class="btn-url folder-meta-url" title="${escapeHtml(parentNote.url)}">${escapeHtml(parentNote.url)}</button>` : ''}
        <div class="folder-meta-actual">
          <span class="folder-meta-actual-date" title="Date last marked as relevant">${escapeHtml(dateActualStr)}</span>
          <button class="folder-meta-actual-btn" title="Mark as relevant now">update date actual</button>
        </div>
        ${parentNote.showTime ? `<div class="note-clock folder-meta-clock" data-tz="${escapeHtml(parentNote.timezone || '')}"></div>` : ''}
        ${parentNote.showWeather ? (parentNote.weatherCity ? `<div class="note-weather folder-meta-weather" data-city="${escapeHtml(parentNote.weatherCity)}" data-weather-type="${escapeHtml(parentNote.weatherType || 'min')}"><span class="weather-temp">...</span><span class="weather-city">${escapeHtml(parentNote.weatherCity)}</span></div>` : '<div class="note-weather folder-meta-weather note-weather-empty">city not set</div>') : ''}
        ${parentNote.img ? `<div class="folder-meta-img-wrap img-loading"><img class="folder-meta-img" src="${escapeHtml(parentNote.img)}" alt="" loading="lazy"></div><span class="folder-meta-img-error hidden">Не удалось загрузить изображение</span>` : ''}
      `;
      if (parentNote.img) {
        const metaImg = metaEl.querySelector('.folder-meta-img');
        const metaWrap = metaEl.querySelector('.folder-meta-img-wrap');
        const removeLoader = () => metaWrap.classList.remove('img-loading');
        if (metaImg.complete) removeLoader();
        else metaImg.addEventListener('load', removeLoader);
        metaImg.addEventListener('error', () => {
          removeLoader();
          metaImg.classList.add('hidden');
          metaEl.querySelector('.folder-meta-img-error').classList.remove('hidden');
        });
      }
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
      // F41F: hover edit button
      metaEl.querySelector('.folder-meta-edit-hover-btn').addEventListener('click', () => {
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
    .sort((a, b) => {
      const dir = sortReversed ? -1 : 1;
      if (currentSort === 'date') {
        const now = Date.now();
        return dir * (Math.abs((a.dateActual || a.createdAt) - now) - Math.abs((b.dateActual || b.createdAt) - now));
      }
      if (currentSort === 'created') return dir * (b.createdAt - a.createdAt);
      if (currentSort === 'updated') return dir * ((b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      if (currentSort === 'children') return dir * (countAllChildren(b.id) - countAllChildren(a.id));
      return dir * (a.order - b.order);
    });

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
    notesList.appendChild(createNoteEl(note, isSymlink, currentSort === 'default'));
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
  updateWeather();
}

// --- CRUD ---

function addNote(copyText, description, url, img, isFastCopy, showTime, timezone, showWeather, weatherCity, weatherType) {
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
    showTime: !!showTime,
    timezone: timezone || '',
    showWeather: !!showWeather,
    weatherCity: weatherCity || '',
    weatherType: weatherType || 'min',
    tags: getTagsFromForm(),
    isTag: inputIsTag ? inputIsTag.checked : false,
    tagColor: inputTagColor ? inputTagColor.value : '#4a90d9',
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

function updateNote(id, copyText, description, url, img, isFastCopy, showTime, timezone, showWeather, weatherCity, weatherType) {
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.copyText = copyText;
    note.description = description;
    note.url = url;
    note.img = img;
    note.isFastCopy = !!isFastCopy;
    note.showTime = !!showTime;
    note.timezone = timezone || '';
    note.showWeather = !!showWeather;
    note.weatherCity = weatherCity || '';
    note.weatherType = weatherType || 'min';
    note.tags = getTagsFromForm();
    note.isTag = inputIsTag ? inputIsTag.checked : false;
    note.tagColor = inputTagColor ? inputTagColor.value : '#4a90d9';
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
  formAdvancedSpecial.open = false;
  updateNavBar();
  inputCopy.value = '';
  inputDesc.value = '';
  inputUrl.value = '';
  inputImg.value = '';
  inputFastCopy.checked = false;
  if (formTags) formTags.open = false;
  if (tagsContainer) tagsContainer.innerHTML = '';
  if (inputIsTag) inputIsTag.checked = false;
  tagColorContainer?.classList.add('hidden');
  setTagColor('#4a90d9');
  setSpecialMode('none');
  setWeatherType('min');
  inputTimezone.value = '';
  inputWeatherCity.value = '';
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
  if (formTags) formTags.open = !!(note.tags && note.tags.length > 0);
  renderTagsForm(note.tags || []);
  if (inputIsTag) inputIsTag.checked = !!note.isTag;
  tagColorContainer?.classList.toggle('hidden', !note.isTag);
  setTagColor(note.tagColor || '#4a90d9');
  const specialMode = note.showTime ? 'time' : note.showWeather ? 'weather' : 'none';
  setSpecialMode(specialMode);
  setWeatherType(note.weatherType || 'min');
  inputTimezone.value = note.timezone || '';
  inputWeatherCity.value = note.weatherCity || '';
  formAdvanced.open = !!note.isFastCopy;
  formAdvancedSpecial.open = !!note.showTime || !!note.showWeather;
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
  renderTagsForm([]);
  if (inputIsTag) inputIsTag.checked = false;
  tagColorContainer?.classList.add('hidden');
  setTagColor('#4a90d9');
  showForm();
});

cancelBtn.addEventListener('click', hideForm);

// F27F/F28F: show/hide sub-options when Advanced Special radio changes
document.querySelectorAll('input[name="special-mode"]').forEach((radio) => {
  radio.addEventListener('change', () => setSpecialMode(getSpecialMode()));
});

tagsAddGroupBtn?.addEventListener('click', () => addTagGroup());

inputIsTag?.addEventListener('change', () => {
  tagColorContainer?.classList.toggle('hidden', !inputIsTag.checked);
});

// Tags Helpers

function renderTagsForm(tagsData) {
  if (!tagsContainer) return;
  tagsContainer.innerHTML = '';
  ensureArray(tagsData).forEach(group => addTagGroup(ensureArray(group)));
}

function addTagGroup(group = []) {
  const groupEl = document.createElement('div');
  groupEl.className = 'tag-group';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'tag-group-remove-btn';
  removeBtn.textContent = '✕';
  removeBtn.title = 'Remove tag group';
  removeBtn.type = 'button';
  removeBtn.onclick = () => groupEl.remove();

  const tagsList = document.createElement('div');
  tagsList.className = 'tags-list';

  const addBtn = document.createElement('button');
  addBtn.className = 'tag-add-btn';
  addBtn.textContent = '+';
  addBtn.type = 'button';
  addBtn.title = 'Add tag option';
  addBtn.onclick = () => addTagItem(tagsList, addBtn, '');

  tagsList.appendChild(addBtn);
  group.forEach(tagId => addTagItem(tagsList, addBtn, tagId));

  groupEl.appendChild(removeBtn);
  groupEl.appendChild(tagsList);
  tagsContainer.appendChild(groupEl);
}

function addTagItem(listEl, addBtn, tagId) {
  const itemEl = document.createElement('div');
  itemEl.className = 'tag-item';

  const sel = document.createElement('select');
  sel.className = 'tag-select';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '— select tag —';
  sel.appendChild(blank);
  notes.filter(n => n.isTag && !n.deletedAt).forEach(tagNote => {
    const opt = document.createElement('option');
    opt.value = tagNote.id;
    opt.textContent = tagNote.copyText;
    if (tagNote.id === tagId) opt.selected = true;
    sel.appendChild(opt);
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'tag-remove-btn';
  delBtn.textContent = '✕';
  delBtn.type = 'button';
  delBtn.onclick = () => itemEl.remove();

  itemEl.appendChild(sel);
  itemEl.appendChild(delBtn);
  listEl.insertBefore(itemEl, addBtn);
}

function getTagsFromForm() {
  if (!tagsContainer) return [];
  const groups = [];
  tagsContainer.querySelectorAll('.tag-group').forEach(groupEl => {
    const ids = [];
    groupEl.querySelectorAll('.tag-select').forEach(sel => {
      if (sel.value) ids.push(sel.value);
    });
    if (ids.length > 0) groups.push(ids);
  });
  return groups;
}

// Populate timezone datalist
try {
  const tzList = document.getElementById('timezone-list');
  Intl.supportedValuesOf('timeZone').forEach((tz) => {
    const opt = document.createElement('option');
    opt.value = tz;
    tzList.appendChild(opt);
  });
} catch (_) { /* older browsers without supportedValuesOf */ }

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
  const specialMode = getSpecialMode();
  const showTime = specialMode === 'time';
  const timezone = showTime ? inputTimezone.value.trim() : '';
  const showWeather = specialMode === 'weather';
  const weatherCity = showWeather ? inputWeatherCity.value.trim() : '';
  const weatherType = showWeather ? getWeatherType() : 'min';

  if (editingId) {
    updateNote(editingId, copyText, description, url, img, isFastCopy, showTime, timezone, showWeather, weatherCity, weatherType);
  } else {
    addNote(copyText, description, url, img, isFastCopy, showTime, timezone, showWeather, weatherCity, weatherType);
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
    showTime: row.show_time || false,
    timezone: row.timezone || '',
    showWeather: row.show_weather || false,
    weatherCity: row.weather_city || '',
    weatherType: row.weather_type || 'min',
    tags: ensureArray(row.tags),
    isTag: row.is_tag || false,
    tagColor: row.tag_color || '#4a90d9',
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
      setStatusMessage('Sync error: not authenticated');
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
  await setSession(stored.supabaseSession);

  // Validate session is still alive
  try {
    const session = await getSession();
    if (!session) {
      await chrome.storage.local.remove('supabaseSession');
      setSyncIndicator('error');
      setStatusMessage('Sync: session expired, please sign in again');
      return;
    }
    // Persist refreshed tokens (access token may have been renewed)
    await chrome.storage.local.set({ supabaseSession: session });
    _syncSession = session;
  } catch (err) {
    setSyncIndicator('error');
    setStatusMessage('Sync error: ' + (err.message || String(err)));
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
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open('settings.html', '_blank');
  }
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

[searchTitleCb, searchDescCb, searchUrlCb, searchCaseCb].forEach((el) => {
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

// --- F27F: Live clocks ---

function updateClocks() {
  document.querySelectorAll('.note-clock').forEach((el) => {
    const tz = el.dataset.tz;
    try {
      const opts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
      if (tz) opts.timeZone = tz;
      const time = new Date().toLocaleTimeString([], opts);
      const label = tz ? tz.replace(/_/g, ' ') : '';
      el.innerHTML = `<span class="clock-time">${time}</span>${label ? `<span class="clock-tz">${escapeHtml(label)}</span>` : ''}`;
    } catch (_) {
      el.textContent = '??:??:??';
    }
  });
}

setInterval(updateClocks, 1000);

// --- F28F/F30F/F31F/F32F-F37F: Weather ---

const _weatherCache = {};
const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 min

// WMO weather code → emoji (F35F)
const WMO_EMOJI = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 56: '🌦️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '❄️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

async function fetchWeatherData(city) {
  const key = city.toLowerCase();
  const cached = _weatherCache[key];
  if (cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL) {
    return cached;
  }
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
  const geoData = await geoRes.json();
  if (!geoData.results?.length) return null;
  const { latitude, longitude } = geoData.results[0];
  const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_min,temperature_2m_max,apparent_temperature_min,apparent_temperature_max,precipitation_sum,weather_code,wind_speed_10m_max,uv_index_max&current=wind_speed_10m&wind_speed_unit=ms&timezone=auto&forecast_days=1`);
  const wxData = await wxRes.json();
  const d = wxData.daily;
  const entry = {
    minTemp: d?.temperature_2m_min?.[0] ?? null,
    maxTemp: d?.temperature_2m_max?.[0] ?? null,
    feelsMin: d?.apparent_temperature_min?.[0] ?? null,
    feelsMax: d?.apparent_temperature_max?.[0] ?? null,
    precipitation: d?.precipitation_sum?.[0] ?? null,
    weatherCode: d?.weather_code?.[0] ?? null,
    windSpeed: d?.wind_speed_10m_max?.[0] ?? null,
    windSpeedCurrent: wxData.current?.wind_speed_10m ?? null,
    uvIndex: d?.uv_index_max?.[0] ?? null,
    fetchedAt: Date.now(),
  };
  _weatherCache[key] = entry;
  return entry;
}

function formatWeatherValue(type, data) {
  const fmtTemp = (val) => {
    if (val == null) return '—';
    const sign = val > 0 ? '+' : '';
    return `${sign}${Math.round(val)}°C`;
  };
  switch (type) {
    case 'min': return fmtTemp(data.minTemp);
    case 'max': return fmtTemp(data.maxTemp);
    case 'feels_min': return fmtTemp(data.feelsMin);
    case 'feels_max': return fmtTemp(data.feelsMax);
    case 'precipitation': return data.precipitation != null ? `${+data.precipitation.toFixed(1)}mm` : '—';
    case 'weather_code': return data.weatherCode != null ? (WMO_EMOJI[data.weatherCode] || '?') : '—';
    case 'wind_avg': return data.windSpeedCurrent != null ? `${+data.windSpeedCurrent.toFixed(1)}\u00a0m/s` : '—';
    case 'wind': return data.windSpeed != null ? `${+data.windSpeed.toFixed(1)}\u00a0m/s` : '—';
    case 'uv': return data.uvIndex != null ? `UV\u00a0${Math.round(data.uvIndex)}` : '—';
    default: return '—';
  }
}

function updateWeather() {
  document.querySelectorAll('.note-weather').forEach(async (el) => {
    const city = el.dataset.city;
    const type = el.dataset.weatherType || 'min';
    if (!city) return;
    try {
      const data = await fetchWeatherData(city);
      const val = data ? formatWeatherValue(type, data) : '—';
      el.innerHTML = `<span class="weather-temp">${val}</span><span class="weather-city">${escapeHtml(city)}</span>`;
    } catch (_) {
      el.innerHTML = `<span class="weather-temp">—</span><span class="weather-city">${escapeHtml(city)}</span>`;
    }
  });
}

setInterval(updateWeather, WEATHER_CACHE_TTL);

// --- Init ---

loadNotes().then(loadSort).then(render).then(loadFontSize).then(loadTheme).then(loadThumbs).then(initSync).then(updateClocks).then(updateWeather);
