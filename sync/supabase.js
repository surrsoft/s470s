// Supabase sync module for s470s
// Depends on lib/supabase.min.js being loaded before this script

let _client = null;
let _realtimeChannel = null;

function getClient() {
  if (_client) return _client;
  const config = _syncConfig;
  if (!config || !config.url || !config.anonKey) return null;
  _client = supabase.createClient(config.url, config.anonKey);
  return _client;
}

// Config cache (set by popup.js / settings.js after loading from storage)
let _syncConfig = null;
let _session = null;

function setConfig(config) {
  _syncConfig = config;
  _client = null; // Reset client when config changes
}

function setSession(session) {
  _session = session;
  // Inject session into client so it uses the stored auth token
  const client = getClient();
  if (client && session) {
    client.auth.setSession(session);
  }
}

// --- Auth ---

async function signIn(email) {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');
  const { error } = await client.auth.signInWithOtp({ email });
  if (error) throw error;
}

async function verifyOtp(email, token) {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');
  const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  _session = data.session;
  return data.session;
}

async function signOut() {
  const client = getClient();
  if (!client) return;
  unsubscribeRealtime();
  await client.auth.signOut();
  _session = null;
}

async function getSession() {
  const client = getClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

// --- CRUD ---

async function fetchNotes() {
  const client = getClient();
  if (!client || !_session) return null;
  const { data, error } = await client
    .from('notes')
    .select('*')
    .order('order', { ascending: true });
  if (error) throw error;
  return data;
}

async function upsertNote(note) {
  const client = getClient();
  if (!client || !_session) return;
  const row = {
    user_id: _session.user.id,
    local_id: note.id,
    copy_text: note.copyText,
    description: note.description || '',
    url: note.url || null,
    parent_id: note.parentId || null,
    parent_ids_other: note.parentIdsOther && note.parentIdsOther.length > 0 ? note.parentIdsOther : null,
    is_fast_copy: note.isFastCopy || false,
    order: note.order,
    created_at: note.createdAt,
    updated_at: note.updatedAt || note.createdAt,
  };
  const { error } = await client
    .from('notes')
    .upsert(row, { onConflict: 'user_id,local_id' });
  if (error) throw error;
}

async function upsertNotesBatch(notes) {
  const client = getClient();
  if (!client || !_session) return;
  const rows = notes.map((note) => ({
    user_id: _session.user.id,
    local_id: note.id,
    copy_text: note.copyText,
    description: note.description || '',
    url: note.url || null,
    parent_id: note.parentId || null,
    parent_ids_other: note.parentIdsOther && note.parentIdsOther.length > 0 ? note.parentIdsOther : null,
    is_fast_copy: note.isFastCopy || false,
    order: note.order,
    created_at: note.createdAt,
    updated_at: note.updatedAt || note.createdAt,
  }));
  const { error } = await client
    .from('notes')
    .upsert(rows, { onConflict: 'user_id,local_id' });
  if (error) throw error;
}

async function deleteNoteRemote(localId) {
  const client = getClient();
  if (!client || !_session) return;
  const { error } = await client
    .from('notes')
    .delete()
    .eq('local_id', localId);
  if (error) throw error;
}

// --- Realtime ---

function subscribeRealtime(handlers) {
  const client = getClient();
  if (!client || !_session) return;
  unsubscribeRealtime();

  _realtimeChannel = client
    .channel('notes-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notes' },
      (payload) => handlers.onInsert && handlers.onInsert(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notes' },
      (payload) => handlers.onUpdate && handlers.onUpdate(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'notes' },
      (payload) => handlers.onDelete && handlers.onDelete(payload.old)
    )
    .subscribe();
}

function unsubscribeRealtime() {
  if (_realtimeChannel) {
    const client = getClient();
    if (client) client.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
  }
}

