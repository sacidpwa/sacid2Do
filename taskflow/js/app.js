// ─── TASKFLOW PRO — LÓGICA PRINCIPAL ──────────────────

// ─── ESTADO ───────────────────────────────────────────
let tasks = [];
let clients = [];
let currentPage = 'dashboard';
let editingTaskId = null;
let editingClientId = null;
let payingTaskId = null;
let taskFilter = 'all';
let catFilter = '';
let clientFilter = '';
let searchQuery = '';
let juntaResultTasks = {};
let isRecurrent = false;
let isCobro = false;
let isIguala = false;
let isClientIguala = false;
let selectedCat = '';
let selectedClientColor = '#7c5cfc';

// ─── CONSTANTES ───────────────────────────────────────
const CATEGORIES = [
  { id: 'desarrollo', label: 'Desarrollo', color: '#7c5cfc' },
  { id: 'diseño',     label: 'Diseño',     color: '#f472b6' },
  { id: 'marketing',  label: 'Marketing',  color: '#38bdf8' },
  { id: 'admin',      label: 'Admin',      color: '#fb923c' },
  { id: 'soporte',    label: 'Soporte',    color: '#22d3a5' },
  { id: 'reunión',    label: 'Reunión',    color: '#a78bfa' },
  { id: 'otro',       label: 'Otro',       color: '#94a3b8' },
];

const PRESETS = [
  { title: 'Revisión de entregable',   cat: 'admin',      priority: 'alta'    },
  { title: 'Envío de propuesta',       cat: 'admin',      priority: 'urgente' },
  { title: 'Diseño de pantallas',      cat: 'diseño',     priority: 'normal'  },
  { title: 'Correcciones de código',   cat: 'desarrollo', priority: 'alta'    },
  { title: 'Publicación en redes',     cat: 'marketing',  priority: 'normal'  },
  { title: 'Llamada de seguimiento',   cat: 'reunión',    priority: 'normal'  },
];

const CLIENT_COLORS = [
  '#7c5cfc','#f472b6','#38bdf8','#fb923c',
  '#22d3a5','#f43f5e','#a78bfa','#34d399',
];

// ─── INIT ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  showLoadingScreen();
  loadSavedTheme();

  // Inyectar fuente
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(link);

  const ok = initSupabase();
  if (!ok || SUPABASE_URL === 'TU_SUPABASE_URL') {
    hideLoadingScreen();
    showToast('error', 'Configura Supabase', 'Edita js/config.js con tus credenciales');
    // Fallback a datos demo locales
    useDemoData();
    return;
  }

  try {
    setSyncStatus('syncing', 'Cargando...');
    await seedInitialData();
    clients = await dbGetClients();
    tasks   = await dbGetTasks();
    subscribeToChanges(handleRealtimeTask, handleRealtimeClient);
    setSyncStatus('online', 'En línea');
  } catch (e) {
    console.error(e);
    showToast('error', 'Error de conexión', 'Revisa tus credenciales de Supabase');
    setSyncStatus('offline', 'Sin conexión');
    useDemoData();
  }

  buildUI();
  hideLoadingScreen();
  checkReminders();
  updateNotifStatus();
  document.getElementById('junta-date').value = todayStr();
});

function useDemoData() {
  const c1 = { id: 'c1', name: 'Acme Corp', company: 'Acme Corp', email: 'hola@acme.com', color: '#7c5cfc', iguala: true, iguala_amount: 15000 };
  const c2 = { id: 'c2', name: 'Sofía Martínez', company: 'SM Studio', email: 'sofia@smstudio.mx', color: '#f472b6', iguala: false, iguala_amount: 0 };
  clients = [c1, c2];
  const t = todayStr();
  const tm = new Date(Date.now()+86400000).toISOString().slice(0,10);
  const yd = new Date(Date.now()-86400000).toISOString().slice(0,10);
  tasks = [
    { id: 't1', title: 'Revisar mockups del home', cat: 'diseño', client_id: 'c1', date: t, priority: 'alta', done: false, recurrent: false, cobro: false, iguala: true, amount: 0, cobro_status: '', paid_amount: 0, paid_date: null, notes: '' },
    { id: 't2', title: 'Entrega de propuesta de branding', cat: 'admin', client_id: 'c2', date: tm, priority: 'urgente', done: false, recurrent: false, cobro: true, iguala: false, amount: 8500, cobro_status: 'pendiente', paid_amount: 0, paid_date: null, notes: '' },
    { id: 't3', title: 'Publicación semanal de redes', cat: 'marketing', client_id: 'c1', date: t, priority: 'normal', done: false, recurrent: true, recurrence: 'semanal', cobro: false, iguala: true, amount: 0, cobro_status: '', paid_amount: 0, paid_date: null, notes: '' },
    { id: 't4', title: 'Correcciones de landing page', cat: 'desarrollo', client_id: 'c2', date: yd, priority: 'alta', done: false, recurrent: false, cobro: true, iguala: false, amount: 3200, cobro_status: 'pagado', paid_amount: 3200, paid_date: yd, notes: '' },
  ];
}

function buildUI() {
  buildCatGrid();
  buildPresets();
  buildClientColorGrid();
  renderAll();
}

// ─── REALTIME ─────────────────────────────────────────
function handleRealtimeTask(payload) {
  const { eventType, new: n, old: o } = payload;
  if (eventType === 'INSERT') tasks.unshift(n);
  else if (eventType === 'UPDATE') tasks = tasks.map(t => t.id === n.id ? n : t);
  else if (eventType === 'DELETE') tasks = tasks.filter(t => t.id !== o.id);
  renderAll();
}
function handleRealtimeClient(payload) {
  const { eventType, new: n, old: o } = payload;
  if (eventType === 'INSERT') clients.push(n);
  else if (eventType === 'UPDATE') clients = clients.map(c => c.id === n.id ? n : c);
  else if (eventType === 'DELETE') clients = clients.filter(c => c.id !== o.id);
  renderAll();
}

// ─── LOADING SCREEN ────────────────────────────────────
function showLoadingScreen() {
  const el = document.createElement('div');
  el.id = 'loading-screen';
  el.innerHTML = `
    <div class="loading-logo">Task<span>Flow</span></div>
    <div class="loading-bar"><div class="loading-bar-fill"></div></div>
  `;
  document.body.appendChild(el);
}
function hideLoadingScreen() {
  const el = document.getElementById('loading-screen');
  if (el) { el.classList.add('fade'); setTimeout(() => el.remove(), 350); }
}

// ─── SYNC STATUS ───────────────────────────────────────
function setSyncStatus(state, text) {
  const dot = document.querySelector('.sync-dot');
  const txt = document.getElementById('sync-text');
  if (dot) { dot.className = 'sync-dot ' + state; }
  if (txt)  txt.textContent = text;
}

// ─── NAVIGATION ────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('page-hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.remove('page-hidden');
  document.querySelectorAll(`.nav-item[data-page="${page}"]`).forEach(n => n.classList.add('active'));
  currentPage = page;
  const titles = { dashboard:'Dashboard', tareas:'Todas las tareas', hoy:'Hoy', vencidas:'Vencidas', cobros:'Cobros', junta:'Junta', clientes:'Clientes' };
  document.getElementById('page-title').textContent = titles[page] || page;
  renderAll();
  closeSidebar();
}

// ─── RENDER PRINCIPAL ──────────────────────────────────
function renderAll() {
  updateBadges();
  populateClientSelects();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'tareas')    renderAllTasks();
  if (currentPage === 'hoy')       renderHoy();
  if (currentPage === 'vencidas')  renderVencidas();
  if (currentPage === 'cobros')    renderCobros();
  if (currentPage === 'clientes')  renderClients();
  populateCatFilter();
}

function updateBadges() {
  const pending  = tasks.filter(t => !t.done).length;
  const hoy      = tasks.filter(isToday).length;
  const vencidas = tasks.filter(isOverdue).length;
  const cobros   = tasks.filter(t => t.cobro && t.cobro_status === 'pendiente').length;
  setText('badge-pending', pending);
  setText('badge-hoy', hoy);
  setText('badge-vencidas', vencidas || '');
  setText('badge-cobros', cobros || '');
}

function renderDashboard() {
  const pending    = tasks.filter(t => !t.done).length;
  const overdue    = tasks.filter(isOverdue).length;
  const todayCount = tasks.filter(isToday).length;
  const porCobrar  = tasks.filter(t => t.cobro && t.cobro_status !== 'pagado').reduce((a,t) => a + n(t.amount), 0);
  const cobrado    = tasks.filter(t => t.cobro && t.cobro_status === 'pagado').reduce((a,t) => a + n(t.paid_amount), 0);

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card" style="--card-color:var(--accent)">
      <div class="stat-label">Pendientes</div>
      <div class="stat-value">${pending}</div>
      <div class="stat-sub">${overdue > 0 ? `<span style="color:var(--red)">${overdue} vencidas</span>` : 'Al corriente ✓'}</div>
      <div class="stat-icon">✓</div>
    </div>
    <div class="stat-card" style="--card-color:var(--green)">
      <div class="stat-label">Hoy</div>
      <div class="stat-value">${todayCount}</div>
      <div class="stat-sub">tareas para hoy</div>
      <div class="stat-icon">◎</div>
    </div>
    <div class="stat-card" style="--card-color:var(--amber)">
      <div class="stat-label">Por cobrar</div>
      <div class="stat-value">${fmt(porCobrar)}</div>
      <div class="stat-sub">pendiente de pago</div>
      <div class="stat-icon">$</div>
    </div>
    <div class="stat-card" style="--card-color:var(--blue)">
      <div class="stat-label">Cobrado</div>
      <div class="stat-value">${fmt(cobrado)}</div>
      <div class="stat-sub">pagos recibidos</div>
      <div class="stat-icon">↑</div>
    </div>
  `;

  renderList('today-tasks',    tasks.filter(isToday).slice(0,8),   'Sin tareas para hoy 🎉');
  renderList('upcoming-tasks', tasks.filter(isUpcoming).slice(0,6), 'Sin tareas próximas');
  renderList('pending-cobros', tasks.filter(t => t.cobro && t.cobro_status === 'pendiente').slice(0,5), 'Sin cobros pendientes 💰');
}

function renderAllTasks() {
  let list = tasks.filter(t => {
    if (taskFilter === 'pending')   return !t.done;
    if (taskFilter === 'done')      return t.done;
    if (taskFilter === 'recurrent') return t.recurrent;
    if (taskFilter === 'cobro')     return t.cobro;
    return true;
  });
  if (catFilter)    list = list.filter(t => t.cat === catFilter);
  if (clientFilter) list = list.filter(t => t.client_id === clientFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(t => t.title.toLowerCase().includes(q) || (t.notes||'').toLowerCase().includes(q));
  }
  list.sort((a,b) => {
    const p = {urgente:0,alta:1,normal:2,baja:3};
    if ((p[a.priority]||2) !== (p[b.priority]||2)) return (p[a.priority]||2)-(p[b.priority]||2);
    if (a.date && b.date) return a.date.localeCompare(b.date);
    return 0;
  });
  renderList('all-tasks', list, 'No hay tareas con esos filtros');
}

function renderHoy()    { renderList('hoy-tasks',      tasks.filter(isToday),   '¡Sin tareas para hoy! 🎉'); }
function renderVencidas(){ renderList('vencidas-tasks', tasks.filter(isOverdue).sort((a,b)=>a.date.localeCompare(b.date)), '¡Ninguna tarea vencida! ✅'); }

function renderCobros() {
  const pending  = tasks.filter(t => t.cobro && t.cobro_status !== 'pagado');
  const done     = tasks.filter(t => t.cobro && t.cobro_status === 'pagado');
  const totPend  = pending.reduce((a,t) => a + n(t.amount), 0);
  const totDone  = done.reduce((a,t) => a + n(t.paid_amount), 0);
  document.getElementById('cobros-stats').innerHTML = `
    <div class="stat-card" style="--card-color:var(--amber)">
      <div class="stat-label">Por cobrar</div>
      <div class="stat-value">${fmt(totPend)}</div>
      <div class="stat-sub">${pending.length} facturas</div>
    </div>
    <div class="stat-card" style="--card-color:var(--green)">
      <div class="stat-label">Cobrado</div>
      <div class="stat-value">${fmt(totDone)}</div>
      <div class="stat-sub">${done.length} pagos</div>
    </div>
    <div class="stat-card" style="--card-color:var(--blue)">
      <div class="stat-label">Total</div>
      <div class="stat-value">${fmt(totPend+totDone)}</div>
      <div class="stat-sub">en el período</div>
    </div>
  `;
  renderList('cobros-pending-list', pending, 'Sin cobros pendientes');
  renderList('cobros-done-list',    done,    'Sin cobros registrados');
}

function renderClients() {
  const el = document.getElementById('clients-list');
  if (!clients.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><div class="empty-title">No hay clientes</div><div class="empty-sub">Agrega tu primer cliente</div></div>';
    return;
  }
  el.innerHTML = clients.map(c => {
    const ct = tasks.filter(t => t.client_id === c.id);
    const pending = ct.filter(t => !t.done).length;
    const cobro   = ct.filter(t => t.cobro && t.cobro_status === 'pendiente').reduce((a,t) => a+n(t.amount),0);
    const initials = c.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    return `<div class="client-card">
      <div class="client-avatar" style="background:${c.color}">${initials}</div>
      <div class="client-info">
        <div class="client-name">${c.name}</div>
        <div class="client-sub">${c.company||''}${c.iguala?' · Iguala '+fmt(c.iguala_amount)+'/mes':''}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:5px;">
          <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(pending*12,100)}%;background:${c.color}"></div></div>
          <span style="font-size:11px;color:var(--text3)">${pending} pendientes</span>
          ${cobro>0?`<span style="font-size:11px;color:var(--amber);font-weight:600">${fmt(cobro)} por cobrar</span>`:''}
        </div>
      </div>
      <div class="client-actions">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openClientModal('${c.id}')">Editar</button>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteClient('${c.id}')" style="color:var(--red)">✕</button>
      </div>
    </div>`;
  }).join('');
}

// ─── RENDER LISTA DE TAREAS ────────────────────────────
function renderList(containerId, list, emptyMsg) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">${emptyMsg}</div></div>`;
    return;
  }
  el.innerHTML = list.map(taskCard).join('');
}

function taskCard(t) {
  const client = clients.find(c => c.id === t.client_id);
  const cat    = CATEGORIES.find(c => c.id === t.cat);
  const cardCls = isOverdue(t) ? 'overdue' : isToday(t) ? 'today-card' : isUpcoming(t) ? 'upcoming' : '';
  const prioColor = {urgente:'var(--red)',alta:'var(--amber)',normal:'var(--text3)',baja:'var(--text3)'}[t.priority]||'var(--text3)';

  return `<div class="task-card ${cardCls} ${t.done?'done':''}" onclick="openTaskModal('${t.id}')">
    <div class="task-check ${t.done?'checked':''}" onclick="event.stopPropagation();toggleTask('${t.id}')"></div>
    <div class="task-body">
      <div class="task-title">
        <span class="priority-dot" style="color:${prioColor}">●</span>
        <span class="task-title-text">${esc(t.title)}</span>
      </div>
      <div class="task-meta">
        ${cat?`<span class="tag tag-cat" style="background:${cat.color}1a;color:${cat.color}">${cat.label}</span>`:''}
        ${client?`<span class="tag tag-client">${esc(client.name)}</span>`:''}
        ${t.date?`<span class="tag tag-date ${isOverdue(t)?'late':isToday(t)?'today':''}">${relDate(t.date)}</span>`:''}
        ${t.recurrent?`<span class="tag tag-recurrent">↻ ${t.recurrence||'recurrente'}</span>`:''}
        ${t.iguala?`<span class="tag tag-iguala">Iguala</span>`:''}
        ${t.cobro&&t.cobro_status==='pendiente'?`<span class="tag tag-cobro">💰 Por cobrar</span>`:''}
        ${t.cobro&&t.cobro_status==='pagado'?`<span class="tag tag-pagado">✓ Pagado</span>`:''}
        ${t.cobro&&t.cobro_status==='facturado'?`<span class="tag tag-facturado">Facturado</span>`:''}
      </div>
    </div>
    <div class="task-right">
      ${t.cobro&&t.amount>0?`<span class="task-amount">${fmt(t.amount)}</span>`:''}
      <div class="task-actions">
        ${t.cobro&&t.cobro_status==='pendiente'?`<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openPayModal('${t.id}')">$ Pagar</button>`:''}
        <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();deleteTask('${t.id}')" style="color:var(--red)">✕</button>
      </div>
    </div>
  </div>`;
}

// ─── TASK CRUD ─────────────────────────────────────────
function openTaskModal(taskId) {
  editingTaskId = taskId || null;
  isRecurrent = false; isCobro = false; isIguala = false; selectedCat = '';

  if (taskId) {
    const t = tasks.find(t => t.id === taskId);
    if (!t) return;
    document.getElementById('task-modal-title').textContent = 'Editar tarea';
    val('task-title', t.title);
    val('task-date', t.date||'');
    val('task-priority', t.priority||'normal');
    val('task-client', t.client_id||'');
    val('task-notes', t.notes||'');
    val('task-amount', t.amount||'');
    val('task-cobro-status', t.cobro_status||'pendiente');
    val('task-paid-amount', t.paid_amount||'');
    val('task-paid-date', t.paid_date||'');
    val('task-recurrence', t.recurrence||'semanal');
    selectedCat = t.cat||'';
    isRecurrent = !!t.recurrent; isCobro = !!t.cobro; isIguala = !!t.iguala;
  } else {
    document.getElementById('task-modal-title').textContent = 'Nueva tarea';
    ['task-title','task-date','task-notes','task-amount','task-paid-amount','task-paid-date'].forEach(id => val(id,''));
    val('task-priority','normal'); val('task-cobro-status','pendiente'); val('task-recurrence','semanal');
    val('task-client','');
  }

  setToggle('toggle-recurrent', isRecurrent);
  setToggle('toggle-cobro', isCobro);
  setToggle('toggle-iguala', isIguala);
  show('recurrent-options', isRecurrent);
  show('cobro-section', isCobro);
  updatePagoSection();
  buildCatGrid();
  populateClientSelects();
  openModal('task-modal');
}

function closeTaskModal() { closeModal('task-modal'); }

async function saveTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { showToast('error','Requerido','Ingresa el título de la tarea'); return; }

  const cobroStatus = g('task-cobro-status').value;
  const payload = {
    title,
    cat: selectedCat,
    client_id: g('task-client').value || null,
    date: g('task-date').value || null,
    priority: g('task-priority').value,
    done: editingTaskId ? (tasks.find(t=>t.id===editingTaskId)?.done||false) : false,
    recurrent: isRecurrent,
    recurrence: isRecurrent ? g('task-recurrence').value : null,
    cobro: isCobro,
    iguala: isIguala,
    amount: isCobro ? n(g('task-amount').value) : 0,
    cobro_status: isCobro ? cobroStatus : null,
    paid_amount: cobroStatus==='pagado' ? n(g('task-paid-amount').value) : 0,
    paid_date: cobroStatus==='pagado' ? (g('task-paid-date').value||null) : null,
    notes: g('task-notes').value,
  };

  setSyncStatus('syncing','Guardando...');
  try {
    if (supabase && SUPABASE_URL !== 'TU_SUPABASE_URL') {
      if (editingTaskId) {
        const updated = await dbUpdateTask(editingTaskId, payload);
        tasks = tasks.map(t => t.id === editingTaskId ? updated : t);
      } else {
        const created = await dbInsertTask(payload);
        tasks.unshift(created);
      }
    } else {
      // Demo mode
      if (editingTaskId) {
        tasks = tasks.map(t => t.id === editingTaskId ? {...t,...payload} : t);
      } else {
        tasks.unshift({...payload, id: 'task-'+Date.now()});
      }
    }
    setSyncStatus('online','En línea');
    showToast('success', editingTaskId ? 'Tarea actualizada' : 'Tarea creada', esc(title));
    closeTaskModal();
    renderAll();
  } catch(e) {
    console.error(e);
    setSyncStatus('offline','Error al guardar');
    showToast('error','Error','No se pudo guardar la tarea');
  }
}

async function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const done = !task.done;
  tasks = tasks.map(t => t.id === id ? {...t, done} : t);
  renderAll();
  try {
    if (supabase && SUPABASE_URL !== 'TU_SUPABASE_URL') {
      await dbUpdateTask(id, { done });
    }
  } catch(e) {
    tasks = tasks.map(t => t.id === id ? {...t, done: !done} : t);
    renderAll();
  }
}

async function deleteTask(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  tasks = tasks.filter(t => t.id !== id);
  renderAll();
  try {
    if (supabase && SUPABASE_URL !== 'TU_SUPABASE_URL') await dbDeleteTask(id);
  } catch(e) { showToast('error','Error','No se pudo eliminar'); }
}

// ─── CLIENT CRUD ───────────────────────────────────────
function openClientModal(clientId) {
  editingClientId = clientId || null;
  isClientIguala = false;
  if (clientId) {
    const c = clients.find(c => c.id === clientId);
    if (!c) return;
    document.getElementById('client-modal-title').textContent = 'Editar cliente';
    val('client-name', c.name); val('client-company', c.company||'');
    val('client-email', c.email||''); val('client-iguala-amount', c.iguala_amount||'');
    selectedClientColor = c.color; isClientIguala = c.iguala;
  } else {
    document.getElementById('client-modal-title').textContent = 'Nuevo cliente';
    ['client-name','client-company','client-email','client-iguala-amount'].forEach(id=>val(id,''));
    selectedClientColor = CLIENT_COLORS[0]; isClientIguala = false;
  }
  setToggle('toggle-client-iguala', isClientIguala);
  show('iguala-section', isClientIguala);
  buildClientColorGrid();
  openModal('client-modal');
}
function closeClientModal() { closeModal('client-modal'); }

async function saveClient() {
  const name = g('client-name').value.trim();
  if (!name) { showToast('error','Requerido','Ingresa el nombre'); return; }
  const payload = {
    name, company: g('client-company').value,
    email: g('client-email').value, color: selectedClientColor,
    iguala: isClientIguala,
    iguala_amount: isClientIguala ? n(g('client-iguala-amount').value) : 0,
  };
  try {
    if (supabase && SUPABASE_URL !== 'TU_SUPABASE_URL') {
      if (editingClientId) {
        const updated = await dbUpdateClient(editingClientId, payload);
        clients = clients.map(c => c.id === editingClientId ? updated : c);
      } else {
        const created = await dbInsertClient(payload);
        clients.push(created);
      }
    } else {
      if (editingClientId) {
        clients = clients.map(c => c.id === editingClientId ? {...c,...payload} : c);
      } else {
        clients.push({...payload, id: 'client-'+Date.now()});
      }
    }
    showToast('success', editingClientId ? 'Cliente actualizado' : 'Cliente creado', name);
    closeClientModal(); renderAll();
  } catch(e) { showToast('error','Error','No se pudo guardar'); }
}

async function deleteClient(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  clients = clients.filter(c => c.id !== id);
  renderAll();
  try { if (supabase && SUPABASE_URL !== 'TU_SUPABASE_URL') await dbDeleteClient(id); } catch(e){}
}

// ─── PAY MODAL ─────────────────────────────────────────
function openPayModal(taskId) {
  payingTaskId = taskId;
  const t = tasks.find(t => t.id === taskId);
  val('pay-amount', t?.amount||'');
  val('pay-date', todayStr());
  openModal('pay-modal');
}
function closePayModal() { closeModal('pay-modal'); }

async function confirmPay() {
  const amount = n(g('pay-amount').value);
  const date   = g('pay-date').value;
  tasks = tasks.map(t => t.id === payingTaskId ? {...t, cobro_status:'pagado', paid_amount:amount, paid_date:date} : t);
  try {
    if (supabase && SUPABASE_URL !== 'TU_SUPABASE_URL') {
      await dbUpdateTask(payingTaskId, { cobro_status:'pagado', paid_amount:amount, paid_date:date });
    }
  } catch(e){}
  closePayModal(); renderAll();
  showToast('success','Pago registrado', fmt(amount));
}

// ─── JUNTA ─────────────────────────────────────────────
async function procesarJunta() {
  const notes    = g('junta-notes').value.trim();
  const clientId = g('junta-client').value;
  if (!notes) { showToast('error','Faltan notas','Escribe los pendientes de la junta'); return; }

  const btn = g('junta-btn');
  btn.innerHTML = '<span class="spinner"></span> Procesando...';
  btn.disabled = true;

  const clientName = clientId ? (clients.find(c=>c.id===clientId)?.name||'el cliente') : 'el cliente';

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Analiza estas notas de una junta entre un freelancer/agencia y su cliente "${clientName}". Extrae los pendientes e identifica si son tarea del freelancer (yo) o del cliente.
Notas: "${notes}"
Responde SOLO en JSON sin markdown:
{"myTasks":[{"title":"..."}],"clientTasks":[{"title":"..."}]}`
        }]
      })
    });
    const data = await resp.json();
    const text = (data.content||[]).map(i=>i.text||'').join('');
    const parsed = JSON.parse(text.replace(/```json|```/g,'').trim());
    juntaResultTasks = { my: parsed.myTasks||[], client: parsed.clientTasks||[], clientId, clientName };
  } catch(e) {
    // Fallback local
    const lines = notes.split(/[.;,\n]+/).map(l=>l.trim()).filter(l=>l.length>8);
    const me=[],cli=[];
    lines.forEach(l => {
      (/el cliente|él|ella|víctor|sofía|acme|cliente/i.test(l) ? cli : me).push({title:l});
    });
    juntaResultTasks = { my: me.length?me:[{title:'Revisar pendientes de la junta'}], client:cli, clientId, clientName };
  }

  showJuntaResults();
  btn.innerHTML = '✦ Procesar con IA';
  btn.disabled = false;
}

function showJuntaResults() {
  const { my, client, clientName } = juntaResultTasks;
  show('junta-results', true);

  g('junta-my-tasks').innerHTML = my.length
    ? my.map((t,i)=>`<div class="task-result-item">
        <span class="owner owner-mine">Yo</span>
        <span class="task-result-text"><span class="task-title-text">${esc(t.title)}</span></span>
        <button class="btn btn-primary btn-sm" onclick="addJuntaTask(${i},'my')">+</button>
      </div>`).join('')
    : '<p style="color:var(--text3);font-size:12px;">No se identificaron tareas propias.</p>';

  g('junta-client-tasks').innerHTML = client.length
    ? client.map(t=>`<div class="task-result-item">
        <span class="owner owner-client">${esc(clientName)}</span>
        <span class="task-result-text"><span class="task-title-text">${esc(t.title)}</span></span>
      </div>`).join('')
    : '<p style="color:var(--text3);font-size:12px;">No se identificaron tareas del cliente.</p>';
}

function addJuntaTask(i, type) {
  const arr = type==='my' ? juntaResultTasks.my : juntaResultTasks.client;
  const t = arr[i];
  const newTask = { id:'jt-'+Date.now(), title:t.title, cat:'reunión', client_id:juntaResultTasks.clientId||null, date:g('junta-date').value||todayStr(), priority:'normal', done:false, recurrent:false, cobro:false, iguala:false, amount:0, cobro_status:null, paid_amount:0, paid_date:null, notes:'Pendiente de junta' };
  tasks.unshift(newTask);
  if (supabase && SUPABASE_URL !== 'TU_SUPABASE_URL') dbInsertTask(newTask).catch(()=>{});
  renderAll();
  showToast('success','Tarea agregada', t.title.slice(0,40));
}

function addAllMyTasks() {
  juntaResultTasks.my.forEach(t => addJuntaTask(juntaResultTasks.my.indexOf(t), 'my'));
}
function limpiarJunta() {
  val('junta-notes',''); show('junta-results', false); juntaResultTasks = {};
}

// ─── SHARE CLIENT TASKS ────────────────────────────────
function shareClientTasks() {
  const { client, clientName, clientId } = juntaResultTasks;
  if (!client?.length) { showToast('warning','Sin tareas','No hay tareas del cliente'); return; }
  const fecha = g('junta-date').value || todayStr();
  const shareText = `📋 *Pendientes - Junta ${fecha}*\nCliente: ${clientName}\n\n${client.map((t,i)=>`${i+1}. ${t.title}`).join('\n')}\n\n_TaskFlow Pro_`;
  val('share-text', shareText);

  g('share-options-list').innerHTML = `
    <div class="share-option" onclick="shareWhatsApp()"><span class="share-icon">💬</span><div><div class="share-name">WhatsApp</div><div class="share-desc">Enviar lista</div></div></div>
    <div class="share-option" onclick="shareEmail()"><span class="share-icon">✉️</span><div><div class="share-name">Email</div><div class="share-desc">Enviar por correo</div></div></div>
    <div class="share-option" onclick="exportGCal()"><span class="share-icon">📅</span><div><div class="share-name">Google Calendar</div><div class="share-desc">Crear eventos</div></div></div>
    <div class="share-option" onclick="exportICS()"><span class="share-icon">🍎</span><div><div class="share-name">Apple Calendar</div><div class="share-desc">Descargar .ics</div></div></div>
  `;
  openModal('share-modal');
}
function closeShareModal() { closeModal('share-modal'); }
function copyShareText() { navigator.clipboard.writeText(g('share-text').value).then(()=>showToast('success','Copiado','')); }
function shareWhatsApp() { window.open('https://wa.me/?text='+encodeURIComponent(g('share-text').value),'_blank'); }
function shareEmail() {
  const c = clients.find(c=>c.id===juntaResultTasks.clientId);
  window.location.href=`mailto:${c?.email||''}?subject=Pendientes+de+junta&body=${encodeURIComponent(g('share-text').value)}`;
}
function exportGCal() {
  const { client, clientName } = juntaResultTasks;
  const date = (g('junta-date').value||todayStr()).replace(/-/g,'');
  client.forEach(t => {
    const title = encodeURIComponent(`[${clientName}] ${t.title}`);
    const end = String(Number(date)+1).padStart(8,'0');
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}/${end}`,'_blank');
  });
}
function exportICS() {
  const { client, clientName } = juntaResultTasks;
  const date = (g('junta-date').value||todayStr()).replace(/-/g,'');
  const now = new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const events = client.map(t=>`BEGIN:VEVENT\nUID:${uid()}@taskflow\nDTSTAMP:${now}\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nSUMMARY:[${clientName}] ${t.title}\nEND:VEVENT`).join('\n');
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TaskFlow Pro//ES\n${events}\nEND:VCALENDAR`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));
  a.download = `junta-${clientName}-${g('junta-date').value||todayStr()}.ics`;
  a.click();
  showToast('success','iCal descargado','Importa el archivo en Apple Calendar');
}

// ─── FILTERS ───────────────────────────────────────────
function setFilter(el, f) {
  document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active'); taskFilter = f; renderAllTasks();
}
function setCatFilter(v)    { catFilter = v; renderAllTasks(); }
function setClientFilter(v) { clientFilter = v; renderAllTasks(); }
function setSearch(v)       { searchQuery = v; if (currentPage==='tareas') renderAllTasks(); }

function populateCatFilter() {
  const el = document.querySelector('.filter-select[onchange="setCatFilter(this.value)"]');
  if (!el) return;
  const used = [...new Set(tasks.map(t=>t.cat).filter(Boolean))];
  el.innerHTML = '<option value="">Categoría</option>' + used.map(c => {
    const cat = CATEGORIES.find(x=>x.id===c);
    return `<option value="${c}" ${catFilter===c?'selected':''}>${cat?cat.label:c}</option>`;
  }).join('');
}
function populateClientSelects() {
  ['task-client','junta-client'].forEach(id => {
    const el = g(id); if (!el) return;
    const first = id==='task-client'?'<option value="">Sin cliente</option>':'<option value="">Seleccionar...</option>';
    el.innerHTML = first + clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  });
  const cf = document.querySelector('.filter-select[onchange="setClientFilter(this.value)"]');
  if (cf) cf.innerHTML = '<option value="">Cliente</option>'+clients.map(c=>`<option value="${c.id}" ${clientFilter===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
}

// ─── UI HELPERS ────────────────────────────────────────
function buildCatGrid() {
  g('cat-grid').innerHTML = CATEGORIES.map(c =>
    `<div class="cat-btn${selectedCat===c.id?' selected':''}" style="${selectedCat===c.id?'background:'+c.color+';border-color:'+c.color+';':'border-color:'+c.color+'25;'}" onclick="selectCat('${c.id}')">${c.label}</div>`
  ).join('');
}
function selectCat(id) { selectedCat = id; buildCatGrid(); }

function buildPresets() {
  g('presets-row').innerHTML = PRESETS.map(p=>
    `<div class="preset-btn" onclick="applyPreset(${JSON.stringify(p).replace(/"/g,'&quot;')})">${p.title}</div>`
  ).join('');
}
function applyPreset(p) { val('task-title',p.title); val('task-priority',p.priority); selectedCat=p.cat; buildCatGrid(); }

function buildClientColorGrid() {
  g('client-color-grid').innerHTML = CLIENT_COLORS.map(c =>
    `<div style="width:24px;height:24px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${selectedClientColor===c?'white':'transparent'};transition:border-color 0.13s" onclick="selectClientColor('${c}')"></div>`
  ).join('');
}
function selectClientColor(c) { selectedClientColor = c; buildClientColorGrid(); }

function toggleRecurrent() { isRecurrent=!isRecurrent; setToggle('toggle-recurrent',isRecurrent); show('recurrent-options',isRecurrent); }
function toggleCobro()     { isCobro=!isCobro; if(isCobro)isIguala=false; setToggle('toggle-cobro',isCobro); setToggle('toggle-iguala',isIguala); show('cobro-section',isCobro); }
function toggleIguala()    { isIguala=!isIguala; if(isIguala)isCobro=false; setToggle('toggle-iguala',isIguala); setToggle('toggle-cobro',isCobro); show('cobro-section',isCobro); }
function toggleClientIguala() { isClientIguala=!isClientIguala; setToggle('toggle-client-iguala',isClientIguala); show('iguala-section',isClientIguala); }
function updatePagoSection() { show('pago-section', g('task-cobro-status').value==='pagado'); }

function setToggle(id, on) { const el=g(id); if(el) on?el.classList.add('on'):el.classList.remove('on'); }
function show(id, visible) { const el=g(id); if(el) el.style.display=visible?'block':'none'; }
function openModal(id)  { g(id)?.classList.add('open'); }
function closeModal(id) { g(id)?.classList.remove('open'); }

// ─── NOTIFICATIONS ─────────────────────────────────────
function requestNotifPermission() {
  if (!('Notification' in window)) { showToast('warning','No disponible','Tu navegador no soporta notificaciones'); return; }
  Notification.requestPermission().then(p => {
    updateNotifStatus();
    if (p==='granted') showToast('success','Notificaciones activadas','Te avisaremos de tareas importantes');
    else showToast('warning','Permiso denegado','');
  });
}
function updateNotifStatus() {
  const el = g('notif-status');
  if (!el) return;
  el.textContent = !('Notification' in window) ? 'No disponible' :
    Notification.permission==='granted' ? '🔔 Activas' : 'Activar notificaciones';
}
function checkReminders() {
  if (!('Notification' in window) || Notification.permission!=='granted') return;
  const overdue = tasks.filter(isOverdue);
  const todayT  = tasks.filter(isToday);
  if (overdue.length > 0) {
    new Notification('⚠ TaskFlow — Tareas vencidas', { body:`Tienes ${overdue.length} tarea(s) vencida(s)`, tag:'overdue' });
  } else if (todayT.length > 0) {
    new Notification('📋 TaskFlow — Para hoy', { body:`Tienes ${todayT.length} tarea(s) para hoy`, tag:'today' });
  }
}

// ─── TOAST ─────────────────────────────────────────────
let toastTimer;
function showToast(type, title, msg) {
  const el = g('toast');
  setText('toast-title', title); setText('toast-msg', msg);
  g('toast-icon').textContent = type==='success'?'✓':type==='error'?'✕':'⚠';
  el.className = `notif-toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 3000);
}

// ─── SIDEBAR MOBILE ────────────────────────────────────
function toggleSidebar() {
  g('sidebar').classList.toggle('open');
  g('overlay').classList.toggle('show');
}
function closeSidebar() {
  g('sidebar').classList.remove('open');
  g('overlay').classList.remove('show');
}

// ─── UTILS ─────────────────────────────────────────────
function uid()      { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function todayStr() { return new Date().toISOString().slice(0,10); }
function g(id)      { return document.getElementById(id); }
function val(id,v)  { const el=g(id); if(el) el.value=v; }
function setText(id,v){ const el=g(id); if(el) el.textContent=v; }
function n(v)       { return Number(v)||0; }
function esc(s)     { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(v)     { return '$'+n(v).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); }

function isOverdue(t) { return !t.done && !!t.date && t.date < todayStr(); }
function isToday(t)   { return !t.done && t.date === todayStr(); }
function isUpcoming(t) {
  if (t.done || !t.date) return false;
  const diff = Math.floor((new Date(t.date+'T12:00:00') - new Date(todayStr()+'T00:00:00')) / 86400000);
  return diff > 0 && diff <= 7;
}
function relDate(d) {
  if (!d) return '';
  const diff = Math.floor((new Date(d+'T12:00:00') - new Date(todayStr()+'T00:00:00')) / 86400000);
  if (diff===0) return 'hoy';
  if (diff===1) return 'mañana';
  if (diff===-1) return 'ayer';
  if (diff<0) return `hace ${Math.abs(diff)}d`;
  if (diff<7) return `en ${diff}d`;
  return new Date(d+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'});
}

// Cerrar modales al hacer clic en el overlay
['task-modal','client-modal','pay-modal','share-modal'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', e => {
    if (e.target.id === id) closeModal(id);
  });
});

// ─── THEME TOGGLE ──────────────────────────────────────
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('tf_theme', isLight ? 'light' : 'dark');
  updateThemeBtn(isLight);
}

function updateThemeBtn(isLight) {
  const icon  = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (icon)  icon.textContent  = isLight ? '🌙' : '☀️';
  if (label) label.textContent = isLight ? 'Modo noche' : 'Modo día';
}

function loadSavedTheme() {
  const saved = localStorage.getItem('tf_theme');
  const isLight = saved === 'light';
  if (isLight) document.body.classList.add('light');
  updateThemeBtn(isLight);
}
