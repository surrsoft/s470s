const notesList = document.getElementById('notes-list');
const navBar = document.getElementById('nav-bar');
const backBtn = document.getElementById('back-btn');
const navBreadcrumbs = document.getElementById('nav-breadcrumbs');
const selectModeBtns = document.getElementById('select-mode-btns');
const resetSelectedBtn = document.getElementById('reset-selected-btn');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const formContainer = document.getElementById('form-container');
const inputCopy = document.getElementById('input-copy');
const inputDesc = document.getElementById('input-desc');
const inputUrl = document.getElementById('input-url');
const inputParent = document.getElementById('input-parent');
const filterParent = document.getElementById('filter-parent');
const symlinksList = document.getElementById('symlinks-list');
const btnAddSymlink = document.getElementById('btn-add-symlink');
const filterSymlink = document.getElementById('filter-symlink');
const selectAddSymlink = document.getElementById('select-add-symlink');
let currentSymlinks = [];
const inputFastCopy = document.getElementById('input-fast-copy');
const formAdvanced = document.getElementById('form-advanced');
const formIdRow = document.getElementById('form-id-row');
const formIdValue = document.getElementById('form-id-value');
const addBtn = document.getElementById('add-btn');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const emptyState = document.getElementById('empty-state');
const toast = document.getElementById('toast');
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

// --- Undo delete state ---
let deletedSnapshot = null; // { backup: Note[], syncIds: string[] }
let undoTimeout = null;

// --- Keyboard navigation state ---
let focusedNoteIndex = -1;

function getCurrentParentId() {
  return navStack.length > 0 ? navStack[navStack.length - 1].id : null;
}

function exitSelectMode() {
  selectMode = false;
  selectedNoteIds = new Set();
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

    navStack.forEach((item, index) => {
      const sep = document.createElement('span');
      sep.className = 'nav-crumb-sep';
      sep.textContent = ' › ';
      navBreadcrumbs.appendChild(sep);

      const crumb = document.createElement('span');
      const isCurrent = index === navStack.length - 1;
      crumb.className = 'nav-crumb' + (isCurrent ? ' nav-crumb-current' : '');
      crumb.textContent = item.copyText;
      if (!isCurrent) {
        const depth = index;
        crumb.addEventListener('click', () => {
          navStack = navStack.slice(0, depth + 1);
          updateNavBar();
          render();
        });
      }
      navBreadcrumbs.appendChild(crumb);
    });
  }

  // F23F: show select-mode buttons block only when in select mode
  selectModeBtns.classList.toggle('hidden', !selectMode);
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
  return notes.some((n) => n.parentId === noteId || ensureArray(n.parentIdsOther).includes(noteId));
}

function collectDescendants(id) {
  const children = notes.filter((n) => n.parentId === id);
  return [id, ...children.flatMap((c) => collectDescendants(c.id))];
}

function collectAllDescendants(id, visited = new Set()) {
  if (visited.has(id)) return [];
  visited.add(id);
  const children = notes.filter((n) => n.parentId === id || ensureArray(n.parentIdsOther).includes(id));
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

function populateParentSelect(excludeId, query = '') {
  const excludeIds = excludeId ? new Set(collectDescendants(excludeId)) : new Set();
  const q = query.toLowerCase();
  inputParent.innerHTML = '<option value="">— Root (top level) —</option>';
  notes
    .filter((n) => !excludeIds.has(n.id))
    .filter((n) => !q || n.copyText.toLowerCase().includes(q))
    .sort((a, b) => a.order - b.order)
    .forEach((n) => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = n.copyText.length > 50 ? n.copyText.slice(0, 50) + '…' : n.copyText;
      inputParent.appendChild(opt);
    });
}

function renderSymlinksList() {
  symlinksList.innerHTML = '';
  currentSymlinks.forEach((id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const el = document.createElement('div');
    el.className = 'symlink-item';
    const text = note.copyText.length > 50 ? note.copyText.slice(0, 50) + '…' : note.copyText;
    el.innerHTML = `<span>${escapeHtml(text)}</span><button class="symlink-item-remove" type="button" title="Remove">&times;</button>`;
    el.querySelector('.symlink-item-remove').addEventListener('click', () => {
      currentSymlinks = currentSymlinks.filter((s) => s !== id);
      renderSymlinksList();
      populateSelectAddSymlink(editingId);
    });
    symlinksList.appendChild(el);
  });
}

function populateSelectAddSymlink(excludeId, query = '') {
  const excludeIds = excludeId ? new Set(collectDescendants(excludeId)) : new Set();
  const q = query.toLowerCase();
  selectAddSymlink.innerHTML = '<option value="" disabled selected>Select note...</option>';
  notes
    .filter((n) => !excludeIds.has(n.id) && !currentSymlinks.includes(n.id))
    .filter((n) => !q || n.copyText.toLowerCase().includes(q))
    .sort((a, b) => a.order - b.order)
    .forEach((n) => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = n.copyText.length > 50 ? n.copyText.slice(0, 50) + '…' : n.copyText;
      selectAddSymlink.appendChild(opt);
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

function createNoteEl(note, isSimlink, withDrag, searchCtx = null) {
  const isFolder = hasChildren(note.id);
  const directCount = isFolder ? notes.filter((n) => n.parentId === note.id || ensureArray(n.parentIdsOther).includes(note.id)).length : 0;
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
      <div class="note-copy-text">${isFolder ? '<span class="folder-icon" title="Contains child notes">&#128193;</span>' : ''}${titleHtml}${folderCountHtml}${isSimlink ? '<span class="simlink-badge" title="Simlink: this note appears here via an additional parent">simlink</span>' : ''}</div>
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
        <button class="menu-delete" title="Delete note (and all contents if folder)">&#10005; Delete</button>
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
    deleteNote(note.id);
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

function renderSearchResults(query) {
  const caseSensitive = searchCaseCb.checked;
  const q = caseSensitive ? query : query.toLowerCase();

  const matched = notes.filter((note) => {
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

  // F8F: search mode — show global results instead of current level
  const query = searchInput.value.trim();
  if (query) {
    renderSearchResults(query);
    notesCount.textContent = notes.length || '';
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
        <div class="folder-meta-title">${escapeHtml(parentNote.copyText)}</div>
        ${parentNote.description ? `<div class="folder-meta-description">${escapeHtml(parentNote.description)}</div>` : ''}
        ${parentNote.url ? `<button class="btn-url folder-meta-url" title="${escapeHtml(parentNote.url)}">${escapeHtml(parentNote.url)}</button>` : ''}
        <div class="folder-meta-actual">
          <span class="folder-meta-actual-date" title="Date last marked as relevant">${escapeHtml(dateActualStr)}</span>
          <button class="folder-meta-actual-btn" title="Mark as relevant now">update date actual</button>
        </div>
        <div class="folder-meta-actions">
          <button class="folder-meta-edit" title="Edit this folder">&#9998; edit</button>
          <button class="folder-meta-delete" title="Delete this folder and all its contents">&#10005; delete</button>
        </div>
      `;
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
      // F3F: delete current folder and navigate to parent
      metaEl.querySelector('.folder-meta-delete').addEventListener('click', () => {
        const idsToDelete = new Set(collectDescendants(parentNote.id));
        const backup = notes.filter((n) => idsToDelete.has(n.id));
        navStack.pop();
        updateNavBar();
        notes = notes.filter((n) => !idsToDelete.has(n.id));
        reorderNotes();
        saveNotes().then(() => render());
        const msg = idsToDelete.size > 1
          ? `Удалено ${idsToDelete.size} заметок`
          : 'Заметка удалена';
        showUndoToast(msg, backup, [...idsToDelete]);
      });
      notesList.appendChild(metaEl);
    }
  }

  const currentNotes = notes
    .filter((n) => {
      const isPrimary = (n.parentId || null) === parentId;
      const isSimlink = parentId !== null && ensureArray(n.parentIdsOther).includes(parentId);
      return isPrimary || isSimlink;
    })
    .sort((a, b) => a.order - b.order);

  if (currentNotes.length === 0) {
    emptyState.querySelector('p:first-child').textContent =
      navStack.length > 0 ? 'Папка пуста' : 'Заметок нет';
    emptyState.classList.remove('hidden');
    notesCount.textContent = notes.length || '';
    return;
  }

  currentNotes.forEach((note) => {
    const isSimlink = parentId !== null && ensureArray(note.parentIdsOther).includes(parentId);
    notesList.appendChild(createNoteEl(note, isSimlink, true));
  });

  notesCount.textContent = notes.length || '';
}

// --- CRUD ---

function addNote(copyText, description, url, parentId, isFastCopy, parentIdsOther) {
  const now = Date.now();
  const note = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    copyText,
    description,
    url,
    parentId: parentId !== undefined ? parentId : getCurrentParentId(),
    parentIdsOther: parentIdsOther || [],
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

function updateNote(id, copyText, description, url, parentId, isFastCopy, parentIdsOther) {
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.copyText = copyText;
    note.description = description;
    note.url = url;
    note.parentId = parentId;
    note.parentIdsOther = parentIdsOther || [];
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
  const backup = notes.filter((n) => idsToDelete.has(n.id));
  notes = notes.filter((n) => !idsToDelete.has(n.id));
  reorderNotes();
  saveNotes().then(() => render());
  const msg = idsToDelete.size > 1
    ? `Удалено ${idsToDelete.size} заметок`
    : 'Заметка удалена';
  showUndoToast(msg, backup, [...idsToDelete]);
}

function reorderNotes() {
  notes.forEach((note, i) => {
    note.order = i;
  });
}

// --- Undo delete ---

function showUndoToast(msg, backup, syncIds) {
  // Commit any previous pending delete before showing new undo
  if (undoTimeout) { clearTimeout(undoTimeout); commitPendingDelete(); }
  deletedSnapshot = { backup, syncIds };
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
  notes.push(...deletedSnapshot.backup);
  reorderNotes();
  saveNotes().then(() => render());
  deletedSnapshot = null;
  toast.classList.add('hidden');
}

function commitPendingDelete() {
  if (!deletedSnapshot) return;
  for (const id of deletedSnapshot.syncIds) scheduleSync({ id }, 'delete');
  deletedSnapshot = null;
  undoTimeout = null;
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
  filterParent.value = '';
  inputParent.innerHTML = '';
  currentSymlinks = [];
  symlinksList.innerHTML = '';
  filterSymlink.value = '';
  filterSymlink.classList.add('hidden');
  selectAddSymlink.classList.add('hidden');
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
  populateParentSelect(note.id);
  inputParent.value = note.parentId || '';
  currentSymlinks = [...ensureArray(note.parentIdsOther)];
  renderSymlinksList();
  populateSelectAddSymlink(note.id);
  inputFastCopy.checked = !!note.isFastCopy;
  formAdvanced.open = !!(currentSymlinks.length || note.isFastCopy);
  formIdValue.textContent = note.id;
  formIdRow.classList.remove('hidden');
  showForm();
}

addBtn.addEventListener('click', () => {
  editingId = null;
  inputCopy.value = '';
  inputDesc.value = '';
  inputUrl.value = '';
  populateParentSelect(null);
  inputParent.value = getCurrentParentId() || '';
  currentSymlinks = [];
  renderSymlinksList();
  populateSelectAddSymlink(null);
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
  const parentIdsOther = [...currentSymlinks];

  if (editingId) {
    updateNote(editingId, copyText, description, url, parentId, isFastCopy, parentIdsOther);
  } else {
    addNote(copyText, description, url, parentId, isFastCopy, parentIdsOther);
  }
  hideForm();
});

btnAddSymlink.addEventListener('click', () => {
  const isHidden = selectAddSymlink.classList.contains('hidden');
  selectAddSymlink.classList.toggle('hidden', !isHidden);
  filterSymlink.classList.toggle('hidden', !isHidden);
  if (isHidden) {
    filterSymlink.value = '';
    populateSelectAddSymlink(editingId);
    filterSymlink.focus();
  }
});

filterParent.addEventListener('input', () => {
  const prev = inputParent.value;
  populateParentSelect(editingId, filterParent.value);
  if (prev) inputParent.value = prev;
});

filterSymlink.addEventListener('input', () => {
  populateSelectAddSymlink(editingId, filterSymlink.value);
});

selectAddSymlink.addEventListener('change', (e) => {
  const selectedId = e.target.value;
  if (!selectedId) return;
  if (!currentSymlinks.includes(selectedId)) {
    currentSymlinks.push(selectedId);
    renderSymlinksList();
    populateSelectAddSymlink(editingId);
  }
  selectAddSymlink.classList.add('hidden');
  filterSymlink.value = '';
  filterSymlink.classList.add('hidden');
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
    parentId: row.parent_id || null,
    parentIdsOther: ensureArray(row.parent_ids_other),
    isFastCopy: row.is_fast_copy || false,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dateActual: row.date_actual ? new Date(row.date_actual).getTime() : (row.created_at || Date.now()),
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

// F22F: delete selected notes (with all descendants)
deleteSelectedBtn.addEventListener('click', () => {
  if (selectedNoteIds.size === 0) return;

  const idsToDelete = new Set();
  for (const id of selectedNoteIds) {
    for (const descendant of collectDescendants(id)) {
      idsToDelete.add(descendant);
    }
  }

  const backup = notes.filter((n) => idsToDelete.has(n.id));
  notes = notes.filter((n) => !idsToDelete.has(n.id));
  reorderNotes();
  const syncIds = [...idsToDelete];
  exitSelectMode();
  saveNotes().then(() => {
    updateNavBar();
    render();
  });

  const msg = syncIds.length === 1
    ? 'Заметка удалена'
    : `Удалено ${selectedNoteIds.size} заметок`;
  showUndoToast(msg, backup, syncIds);
});

document.addEventListener('click', () => {
  document.querySelectorAll('.note-dropdown').forEach((d) => d.classList.add('hidden'));
  document.querySelectorAll('.note-menu').forEach((m) => m.classList.remove('open'));
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
