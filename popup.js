const notesList = document.getElementById('notes-list');
const formContainer = document.getElementById('form-container');
const inputCopy = document.getElementById('input-copy');
const inputDesc = document.getElementById('input-desc');
const addBtn = document.getElementById('add-btn');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const emptyState = document.getElementById('empty-state');
const toast = document.getElementById('toast');

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
  const note = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    copyText,
    description,
    order: maxOrder + 1,
    createdAt: Date.now(),
  };
  notes.push(note);
  saveNotes().then(render);
}

function updateNote(id, copyText, description) {
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.copyText = copyText;
    note.description = description;
    saveNotes().then(render);
  }
}

function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  notes = notes.filter((n) => n.id !== id);
  reorderNotes();
  saveNotes().then(render);
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
  saveNotes().then(render);
}

// --- Init ---

loadNotes().then(render);
