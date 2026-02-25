// Settings page logic for s470s

const urlInput = document.getElementById('supabase-url');
const keyInput = document.getElementById('supabase-key');
const saveConfigBtn = document.getElementById('save-config-btn');
const configStatus = document.getElementById('config-status');

const emailInput = document.getElementById('auth-email');
const sendOtpBtn = document.getElementById('send-otp-btn');
const otpSendStatus = document.getElementById('otp-send-status');
const emailStep = document.getElementById('email-step');
const codeStep = document.getElementById('code-step');
const otpEmailDisplay = document.getElementById('otp-email-display');
const codeInput = document.getElementById('auth-code');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const backToEmailBtn = document.getElementById('back-to-email-btn');
const otpVerifyStatus = document.getElementById('otp-verify-status');

const signoutState = document.getElementById('signout-state');
const signinState = document.getElementById('signin-state');
const accountEmailEl = document.getElementById('account-email');
const signoutBtn = document.getElementById('signout-btn');

const lastSyncTimeEl = document.getElementById('last-sync-time');
const syncNowBtn = document.getElementById('sync-now-btn');
const syncNowStatus = document.getElementById('sync-now-status');

// --- Init ---

async function init() {
  const stored = await getStorage(['supabaseConfig', 'supabaseSession', 'lastFullSync']);

  // Pre-fill config
  if (stored.supabaseConfig) {
    urlInput.value = stored.supabaseConfig.url || '';
    keyInput.value = stored.supabaseConfig.anonKey || '';
    setConfig(stored.supabaseConfig);
  }

  // Show sync info
  if (stored.lastFullSync) {
    lastSyncTimeEl.textContent = new Date(stored.lastFullSync).toLocaleString();
  }

  // Check session
  if (stored.supabaseConfig && stored.supabaseSession) {
    setSession(stored.supabaseSession);
    const session = await getSession();
    if (session) {
      // Persist refreshed tokens (access token may have been renewed)
      await chrome.storage.local.set({ supabaseSession: session });
      showSignedIn(session.user.email);
      return;
    }
    // Session expired — clear it
    await chrome.storage.local.remove('supabaseSession');
  }

  showSignedOut();
}

function getStorage(keys) {
  return new Promise((resolve) => {
    const defaults = {};
    keys.forEach((k) => (defaults[k] = null));
    chrome.storage.local.get(defaults, resolve);
  });
}

function showSignedIn(email) {
  signinState.classList.remove('hidden');
  signoutState.classList.add('hidden');
  accountEmailEl.textContent = email;
}

function showSignedOut() {
  signinState.classList.add('hidden');
  signoutState.classList.remove('hidden');
  emailStep.classList.remove('hidden');
  codeStep.classList.add('hidden');
  emailInput.value = '';
  codeInput.value = '';
  setStatus(otpSendStatus, '');
  setStatus(otpVerifyStatus, '');
}

function setStatus(el, msg, type = '') {
  el.textContent = msg;
  el.className = 'status-msg' + (type ? ' ' + type : '');
}

// --- Config save ---

saveConfigBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  const anonKey = keyInput.value.trim();

  if (!url || !anonKey) {
    setStatus(configStatus, 'Fill in both fields.', 'error');
    return;
  }

  saveConfigBtn.disabled = true;
  setStatus(configStatus, 'Saving…');

  const config = { url, anonKey };
  await chrome.storage.local.set({ supabaseConfig: config });
  setConfig(config);

  setStatus(configStatus, 'Saved!', 'success');
  saveConfigBtn.disabled = false;
  setTimeout(() => setStatus(configStatus, ''), 3000);
});

// --- OTP Auth ---

sendOtpBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    setStatus(otpSendStatus, 'Enter your email.', 'error');
    return;
  }

  sendOtpBtn.disabled = true;
  setStatus(otpSendStatus, 'Sending…');

  try {
    await signIn(email);
    otpEmailDisplay.textContent = email;
    emailStep.classList.add('hidden');
    codeStep.classList.remove('hidden');
    codeInput.focus();
    setStatus(otpSendStatus, '');
  } catch (err) {
    setStatus(otpSendStatus, err.message || 'Failed to send code.', 'error');
  }

  sendOtpBtn.disabled = false;
});

backToEmailBtn.addEventListener('click', () => {
  codeStep.classList.add('hidden');
  emailStep.classList.remove('hidden');
  setStatus(otpVerifyStatus, '');
});

verifyOtpBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const token = codeInput.value.trim().replace(/\s/g, '');
  if (!token || token.length !== 6) {
    setStatus(otpVerifyStatus, 'Enter the 6-digit code.', 'error');
    return;
  }

  verifyOtpBtn.disabled = true;
  setStatus(otpVerifyStatus, 'Verifying…');

  try {
    const session = await verifyOtp(email, token);
    await chrome.storage.local.set({ supabaseSession: session });
    showSignedIn(session.user.email);
  } catch (err) {
    setStatus(otpVerifyStatus, err.message || 'Invalid code.', 'error');
  }

  verifyOtpBtn.disabled = false;
});

// --- Sign out ---

signoutBtn.addEventListener('click', async () => {
  signoutBtn.disabled = true;
  try {
    await signOut();
    await chrome.storage.local.remove('supabaseSession');
    showSignedOut();
  } catch (err) {
    console.error('Sign out error:', err);
  }
  signoutBtn.disabled = false;
});

// --- Sync now ---

syncNowBtn.addEventListener('click', async () => {
  setStatus(syncNowStatus, 'Syncing…');
  syncNowBtn.disabled = true;

  // Send message to popup if open, otherwise just report
  chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, (response) => {
    if (chrome.runtime.lastError) {
      // Popup not open — inform user to open popup
      setStatus(syncNowStatus, 'Open the extension popup to sync.', 'error');
    } else if (response && response.ok) {
      const now = new Date().toLocaleString();
      lastSyncTimeEl.textContent = now;
      setStatus(syncNowStatus, 'Done!', 'success');
      setTimeout(() => setStatus(syncNowStatus, ''), 3000);
    } else {
      setStatus(syncNowStatus, response?.error || 'Sync failed.', 'error');
    }
    syncNowBtn.disabled = false;
  });
});

// Enter key support
codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') verifyOtpBtn.click();
});

emailInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendOtpBtn.click();
});

init();
