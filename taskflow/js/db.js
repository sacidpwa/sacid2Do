// ─── TASKFLOW PRO — CAPA DE BASE DE DATOS (Supabase) ──

let supabase = null;

// Inicializar Supabase
function initSupabase() {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  } catch (e) {
    console.error('Error inicializando Supabase:', e);
    return false;
  }
}

// ─── TAREAS ───────────────────────────────────────────

async function dbGetTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function dbInsertTask(task) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([task])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbUpdateTask(id, updates) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbDeleteTask(id) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── CLIENTES ─────────────────────────────────────────

async function dbGetClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

async function dbInsertClient(client) {
  const { data, error } = await supabase
    .from('clients')
    .insert([client])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbUpdateClient(id, updates) {
  const { data, error } = await supabase
    .from('clients')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbDeleteClient(id) {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── SUSCRIPCIÓN EN TIEMPO REAL ───────────────────────

function subscribeToChanges(onTaskChange, onClientChange) {
  supabase
    .channel('taskflow-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, onTaskChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, onClientChange)
    .subscribe((status) => {
      setSyncStatus(status === 'SUBSCRIBED' ? 'online' : 'syncing', 
        status === 'SUBSCRIBED' ? 'En línea' : 'Sincronizando...');
    });
}

// ─── SEED DATA (primera vez) ──────────────────────────

async function seedInitialData() {
  // Verifica si ya hay datos
  const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  if (count > 0) return;

  const client1Id = crypto.randomUUID();
  const client2Id = crypto.randomUUID();

  await supabase.from('clients').insert([
    { id: client1Id, name: 'Acme Corp', company: 'Acme Corp', email: 'hola@acme.com', color: '#7c5cfc', iguala: true, iguala_amount: 15000 },
    { id: client2Id, name: 'Sofía Martínez', company: 'SM Studio', email: 'sofia@smstudio.mx', color: '#f472b6', iguala: false, iguala_amount: 0 },
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  await supabase.from('tasks').insert([
    { title: 'Revisar mockups del home', cat: 'diseño', client_id: client1Id, date: today, priority: 'alta', done: false, recurrent: false, cobro: false, iguala: true, amount: 0, cobro_status: '', paid_amount: 0, paid_date: null, notes: '' },
    { title: 'Entrega de propuesta de branding', cat: 'admin', client_id: client2Id, date: tomorrow, priority: 'urgente', done: false, recurrent: false, cobro: true, iguala: false, amount: 8500, cobro_status: 'pendiente', paid_amount: 0, paid_date: null, notes: '' },
    { title: 'Publicación semanal de redes', cat: 'marketing', client_id: client1Id, date: today, priority: 'normal', done: false, recurrent: true, recurrence: 'semanal', cobro: false, iguala: true, amount: 0, cobro_status: '', paid_amount: 0, paid_date: null, notes: '' },
  ]);
}
