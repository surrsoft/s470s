// Settings page logic
let isConnected = false;
let currentConfig = null;

// DOM elements
const authStatus = document.getElementById('auth-status');
const accountEmail = document.getElementById('account-email');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const sheetConfig = document.getElementById('sheet-config');
const syncMode = document.getElementById('sync-mode');
const existingSheetGroup = document.getElementById('existing-sheet-group');
const newSheetGroup = document.getElementById('new-sheet-group');
const sheetNameGroup = document.getElementById('sheet-name-group');
const sheetUrl = document.getElementById('sheet-url');
const sheetTitle = document.getElementById('sheet-title');
const validateSheetBtn = document.getElementById('validate-sheet-btn');
const createSheetBtn = document.getElementById('create-sheet-btn');
const validationMessage = document.getElementById('validation-message');
const syncInfo = document.getElementById('sync-info');
const sheetLink = document.getElementById('sheet-link');
const lastSyncTime = document.getElementById('last-sync-time');
const syncStatusText = document.getElementById('sync-status-text');
const pendingChanges = document.getElementById('pending-changes');
const autoSyncEnabled = document.getElementById('auto-sync-enabled');
const periodicSyncEnabled = document.getElementById('periodic-sync-enabled');
const periodicIntervalGroup = document.getElementById('periodic-interval-group');
const periodicSyncInterval = document.getElementById('periodic-sync-interval');
const saveSyncConfig = document.getElementById('save-sync-config');
const forceSyncBtn = document.getElementById('force-sync-btn');
const resetSyncBtn = document.getElementById('reset-sync-btn');

// ===== Initialization =====
async function init() {
  await loadState();
  setupEventListeners();
}

async function loadState() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_SYNC_STATE' });

    if (response.success) {
      currentConfig = response.config;
      const state = response.state;
      const stats = response.stats;

      // Update UI based on config
      if (currentConfig.enabled && currentConfig.spreadsheetId) {
        isConnected = true;
        showConnected(currentConfig, state, stats);
      } else {
        isConnected = false;
        showDisconnected();
      }
    }
  } catch (error) {
    console.error('Failed to load state:', error);
    showToast('Failed to load settings', 'error');
  }
}

function showConnected(config, state, stats) {
  // Update auth status
  const statusCard = authStatus.querySelector('.status-card');
  statusCard.querySelector('.status-icon').textContent = '✅';
  statusCard.querySelector('.status-title').textContent = 'Connected';

  if (config.googleAccountEmail) {
    accountEmail.textContent = config.googleAccountEmail;
    accountEmail.classList.remove('hidden');
  }

  connectBtn.classList.add('hidden');
  disconnectBtn.classList.remove('hidden');
  sheetConfig.classList.add('hidden');

  // Show sync info
  syncInfo.classList.remove('hidden');

  // Update spreadsheet link
  sheetLink.href = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}`;

  // Update sync stats
  lastSyncTime.textContent = stats.lastSyncTime;
  pendingChanges.textContent = stats.pendingChanges;

  // Update status badge
  const statusBadge = syncStatusText.querySelector('.status-badge');
  statusBadge.className = 'status-badge';

  if (state.isSyncing) {
    statusBadge.textContent = 'Syncing...';
    statusBadge.classList.add('status-syncing');
  } else if (state.lastSyncStatus === 'success') {
    statusBadge.textContent = 'Ready';
    statusBadge.classList.add('status-ready');
  } else if (state.lastSyncStatus === 'error') {
    statusBadge.textContent = 'Error';
    statusBadge.classList.add('status-error');
  } else {
    statusBadge.textContent = 'Ready';
    statusBadge.classList.add('status-ready');
  }

  // Update checkboxes
  autoSyncEnabled.checked = config.autoSync;
  periodicSyncEnabled.checked = config.periodicSync;
  periodicSyncInterval.value = config.periodicInterval || 15;

  if (config.periodicSync) {
    periodicIntervalGroup.classList.remove('hidden');
  }
}

function showDisconnected() {
  const statusCard = authStatus.querySelector('.status-card');
  statusCard.querySelector('.status-icon').textContent = '🔒';
  statusCard.querySelector('.status-title').textContent = 'Not connected';
  accountEmail.classList.add('hidden');

  connectBtn.classList.remove('hidden');
  disconnectBtn.classList.add('hidden');
  sheetConfig.classList.add('hidden');
  syncInfo.classList.add('hidden');
}

// ===== Event Listeners =====
function setupEventListeners() {
  connectBtn.addEventListener('click', handleConnect);
  disconnectBtn.addEventListener('click', handleDisconnect);
  syncMode.addEventListener('change', handleSyncModeChange);
  validateSheetBtn.addEventListener('click', handleValidateSheet);
  createSheetBtn.addEventListener('click', handleCreateSheet);
  periodicSyncEnabled.addEventListener('change', handlePeriodicSyncToggle);
  saveSyncConfig.addEventListener('click', handleSaveConfig);
  forceSyncBtn.addEventListener('click', handleForceSync);
  resetSyncBtn.addEventListener('click', handleResetSync);
}

async function handleConnect() {
  try {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    const response = await chrome.runtime.sendMessage({ action: 'AUTH_GOOGLE' });

    if (response.success) {
      showToast('Connected successfully!', 'success');
      sheetConfig.classList.remove('hidden');

      if (response.email) {
        accountEmail.textContent = response.email;
        accountEmail.classList.remove('hidden');
      }

      // Update button
      const statusCard = authStatus.querySelector('.status-card');
      statusCard.querySelector('.status-icon').textContent = '✅';
      statusCard.querySelector('.status-title').textContent = 'Connected';
      connectBtn.classList.add('hidden');
      disconnectBtn.classList.remove('hidden');
    } else {
      throw new Error(response.error || 'Failed to connect');
    }
  } catch (error) {
    console.error('Connection error:', error);
    showToast('Failed to connect: ' + error.message, 'error');
  } finally {
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect Google Account';
  }
}

async function handleDisconnect() {
  if (!confirm('Are you sure you want to disconnect? This will clear all sync settings.')) {
    return;
  }

  try {
    disconnectBtn.disabled = true;

    const response = await chrome.runtime.sendMessage({ action: 'REVOKE_AUTH' });

    if (response.success) {
      showToast('Disconnected successfully', 'success');
      showDisconnected();
      await loadState();
    }
  } catch (error) {
    console.error('Disconnect error:', error);
    showToast('Failed to disconnect', 'error');
  } finally {
    disconnectBtn.disabled = false;
  }
}

function handleSyncModeChange() {
  const mode = syncMode.value;

  if (mode === 'use-existing') {
    existingSheetGroup.classList.remove('hidden');
    newSheetGroup.classList.add('hidden');
    sheetNameGroup.classList.remove('hidden');
  } else {
    existingSheetGroup.classList.add('hidden');
    newSheetGroup.classList.remove('hidden');
    sheetNameGroup.classList.add('hidden');
  }
}

async function handleValidateSheet() {
  const url = sheetUrl.value.trim();
  const sheetNameValue = document.getElementById('sheet-name').value.trim() || 's470s Notes';

  if (!url) {
    showValidationMessage('Please enter a spreadsheet URL or ID', 'error');
    return;
  }

  // Extract spreadsheet ID from URL or use as-is
  let spreadsheetId = url;
  const urlMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) {
    spreadsheetId = urlMatch[1];
  }

  try {
    validateSheetBtn.disabled = true;
    validateSheetBtn.textContent = 'Validating...';

    const response = await chrome.runtime.sendMessage({
      action: 'VALIDATE_SPREADSHEET',
      spreadsheetId,
      sheetName: sheetNameValue
    });

    if (response.success && response.valid) {
      showValidationMessage('✓ Spreadsheet validated successfully!', 'success');
      showToast('Spreadsheet connected!', 'success');

      // Reload state to show sync info
      setTimeout(() => loadState(), 500);
    } else {
      showValidationMessage('✗ Cannot access this spreadsheet. Check permissions.', 'error');
    }
  } catch (error) {
    console.error('Validation error:', error);
    showValidationMessage('✗ Failed to validate: ' + error.message, 'error');
  } finally {
    validateSheetBtn.disabled = false;
    validateSheetBtn.textContent = 'Validate & Connect';
  }
}

async function handleCreateSheet() {
  const title = sheetTitle.value.trim() || 's470s Notes';

  try {
    createSheetBtn.disabled = true;
    createSheetBtn.textContent = 'Creating...';

    const response = await chrome.runtime.sendMessage({
      action: 'CREATE_SPREADSHEET',
      title,
      sheetName: 's470s Notes'
    });

    if (response.success) {
      showToast('Spreadsheet created successfully!', 'success');

      // Reload state to show sync info
      setTimeout(() => loadState(), 500);
    } else {
      throw new Error(response.error || 'Failed to create spreadsheet');
    }
  } catch (error) {
    console.error('Create error:', error);
    showToast('Failed to create spreadsheet: ' + error.message, 'error');
  } finally {
    createSheetBtn.disabled = false;
    createSheetBtn.textContent = 'Create Spreadsheet';
  }
}

function handlePeriodicSyncToggle() {
  if (periodicSyncEnabled.checked) {
    periodicIntervalGroup.classList.remove('hidden');
  } else {
    periodicIntervalGroup.classList.add('hidden');
  }
}

async function handleSaveConfig() {
  try {
    saveSyncConfig.disabled = true;
    saveSyncConfig.textContent = 'Saving...';

    const config = {
      autoSync: autoSyncEnabled.checked,
      periodicSync: periodicSyncEnabled.checked,
      periodicInterval: parseInt(periodicSyncInterval.value)
    };

    const response = await chrome.runtime.sendMessage({
      action: 'SAVE_SYNC_CONFIG',
      config
    });

    if (response.success) {
      showToast('Configuration saved!', 'success');
      await loadState();
    } else {
      throw new Error(response.error || 'Failed to save configuration');
    }
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed to save configuration', 'error');
  } finally {
    saveSyncConfig.disabled = false;
    saveSyncConfig.textContent = 'Save Configuration';
  }
}

async function handleForceSync() {
  try {
    forceSyncBtn.disabled = true;
    forceSyncBtn.textContent = 'Syncing...';

    const response = await chrome.runtime.sendMessage({ action: 'SYNC_NOW' });

    if (response.success) {
      showToast('Sync completed successfully!', 'success');
      await loadState();
    } else {
      throw new Error(response.error || 'Sync failed');
    }
  } catch (error) {
    console.error('Sync error:', error);
    showToast('Sync failed: ' + error.message, 'error');
  } finally {
    forceSyncBtn.disabled = false;
    forceSyncBtn.textContent = 'Sync Now';
  }
}

async function handleResetSync() {
  if (!confirm('Are you sure? This will reset all sync settings and disconnect your Google account.')) {
    return;
  }

  try {
    resetSyncBtn.disabled = true;

    const response = await chrome.runtime.sendMessage({ action: 'RESET_SYNC' });

    if (response.success) {
      showToast('Sync configuration reset', 'success');
      showDisconnected();
      await loadState();
    }
  } catch (error) {
    console.error('Reset error:', error);
    showToast('Failed to reset configuration', 'error');
  } finally {
    resetSyncBtn.disabled = false;
  }
}

// ===== Helper Functions =====
function showValidationMessage(message, type) {
  validationMessage.textContent = message;
  validationMessage.className = `validation-message ${type}`;
  validationMessage.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => {
      validationMessage.classList.add('hidden');
    }, 5000);
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Initialize on load
init();
