// ─── MÓDULO FINIQUITO/LIQUIDACIÓN ─────────────────────
// DRANUR Legal & Tax Advisory — Sacid2Do

// Logo se carga desde el archivo
let LOGO_B64 = '';
(function(){
  const img = new Image();
  img.onload = function(){
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img,0,0);
    LOGO_B64 = c.toDataURL('image/png');
  };
  img.src = 'logo.png';
})();

// ─── ESTADO ──────────────────────────────────────────────────
let editingFiniquitoId = null;
let finiquitos = [];
let calculoActual = {};

// ─── CONSTANTES LFT 2024/2025 ────────────────────────────────
const LFT = {
  diasAguinaldo: 15,        // Art. 87 LFT
  diasVacaciones: 12,       // Art. 76 LFT (reforma 2023, primer año)
  primaVacacional: 0.25,    // Art. 80 LFT (25%)
  diasTresMeses: 90,        // Art. 50 LFT (despido injustificado)
  diasVeinteAnio: 20,       // Art. 50 LFT (20 días por año)
  smg2025: 278.80,          // SMG 2025 zona libre frontera norte
  smg2025general: 248.93,   // SMG 2025 general
  limiteExento: 90,         // Art. 93 LISR (90 SMG exentos)
};

// Tabla de vacaciones por antigüedad Art. 76 LFT reforma 2023
function diasVacacionesPorAntiguedad(anios) {
  if (anios < 1)  return 12;
  if (anios < 2)  return 12;
  if (anios < 3)  return 14;
  if (anios < 4)  return 16;
  if (anios < 5)  return 18;
  if (anios < 6)  return 20;
  if (anios < 11) return 22;
  if (anios < 16) return 24;
  if (anios < 21) return 26;
  if (anios < 26) return 28;
  return 30;
}

// ─── CÁLCULO PRINCIPAL ───────────────────────────────────────
function calcularFiniquito(datos) {
  const ingreso = new Date(datos.fechaIngreso + 'T12:00:00');
  const baja    = new Date(datos.fechaBaja    + 'T12:00:00');
  const diffMs  = baja - ingreso;
  const diasTrabajados = Math.floor(diffMs / 86400000);
  const aniosTrabajados = diasTrabajados / 365;
  const factor = diasTrabajados / 365;

  const sd = Number(datos.salarioDiario);
  const diasVac = diasVacacionesPorAntiguedad(Math.floor(aniosTrabajados));

  // Cálculos base
  const aguinaldo      = sd * LFT.diasAguinaldo * factor;
  const vacaciones     = sd * diasVac * factor;
  const primaVac       = vacaciones * LFT.primaVacacional;
  const salariosNoP    = sd * Number(datos.diasNoPagados || 0);

  // Prestaciones anteriores pendientes
  const prestAnt = datos.prestacionesAnteriores ? Number(datos.montoPrestacionesAnt || 0) : 0;

  // Según tipo de separación
  let tresMeses = 0, veinteAnio = 0, salariosVencidos = 0;

  if (datos.tipoSeparacion === 'despido_injustificado') {
    tresMeses   = sd * LFT.diasTresMeses;
    veinteAnio  = sd * LFT.diasVeinteAnio * Math.max(aniosTrabajados, 1);
  }
  if (datos.tipoSeparacion === 'despido_justificado') {
    // Solo finiquito, sin indemnización
  }

  const subtotal = aguinaldo + vacaciones + primaVac + salariosNoP + prestAnt + tresMeses + veinteAnio + salariosVencidos;

  // ISR: exento si < 90 SMG
  const limiteExento = LFT.limiteExento * LFT.smg2025general;
  const isr = subtotal > limiteExento ? (subtotal - limiteExento) * 0.15 : 0;
  const totalNeto = subtotal - isr;

  return {
    diasTrabajados,
    aniosTrabajados,
    diasVacaciones: diasVac,
    factor,
    aguinaldo,
    vacaciones,
    primaVac,
    salariosNoP,
    prestAnt,
    tresMeses,
    veinteAnio,
    salariosVencidos,
    subtotal,
    isr,
    totalNeto,
    limiteExento,
  };
}

// ─── DB FINIQUITOS ────────────────────────────────────────────
async function dbGetFiniquitos() {
  const { data, error } = await supabaseClient.from('finiquitos').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
async function dbInsertFiniquito(f) {
  const { data, error } = await supabaseClient.from('finiquitos').insert([f]).select().single();
  if (error) throw error;
  return data;
}
async function dbUpdateFiniquito(id, f) {
  const { data, error } = await supabaseClient.from('finiquitos').update({...f, updated_at: new Date().toISOString()}).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
async function dbDeleteFiniquito(id) {
  const { error } = await supabaseClient.from('finiquitos').delete().eq('id', id);
  if (error) throw error;
}

// ─── RENDER PÁGINA ────────────────────────────────────────────
async function renderFiniquitos() {
  try {
    finiquitos = await dbGetFiniquitos();
  } catch(e) { finiquitos = []; }
  renderFiniquitosList();
}

function renderFiniquitosList() {
  const el = g('finiquitos-list');
  if (!el) return;

  const tipoLabels = {
    renuncia_voluntaria:     'Renuncia voluntaria',
    despido_justificado:     'Despido justificado',
    despido_injustificado:   'Despido injustificado',
    mutuo_acuerdo:           'Mutuo acuerdo',
  };

  if (!finiquitos.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📄</div>
      <div class="empty-title">Sin finiquitos registrados</div>
      <div class="empty-sub">Crea el primero con el botón de arriba</div>
    </div>`;
    return;
  }

  el.innerHTML = finiquitos.map(f => `
    <div class="task-card" onclick="openFiniquitoModal('${f.id}')">
      <div class="task-body">
        <div class="task-title">
          <span class="priority-dot" style="color:var(--accent)">●</span>
          <span class="task-title-text">${esc(f.trabajador_nombre)}</span>
        </div>
        <div class="task-meta">
          <span class="tag tag-cat">${tipoLabels[f.tipo_separacion] || f.tipo_separacion}</span>
          <span class="tag tag-client">${esc(f.patron_nombre)}</span>
          <span class="tag tag-date">${f.fecha_baja}</span>
          ${f.es_persona_moral ? '<span class="tag tag-iguala">Persona Moral</span>' : ''}
          <span class="tag" style="background:rgba(34,211,165,.12);color:var(--green);font-weight:700">
            ${fmt(f.total_neto)}
          </span>
        </div>
      </div>
      <div class="task-right">
        <div class="task-actions">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();descargarPDF('${f.id}')">⬇ PDF</button>
          <button class="btn btn-ghost btn-icon btn-sm" onclick="event.stopPropagation();deleteFiniquito('${f.id}')" style="color:var(--red)">✕</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ─── MODAL FINIQUITO ──────────────────────────────────────────
function openFiniquitoModal(finiquitoId) {
  editingFiniquitoId = finiquitoId || null;
  calculoActual = {};

  if (finiquitoId) {
    const f = finiquitos.find(x => x.id === finiquitoId);
    if (!f) return;
    val('fq-trabajador', f.trabajador_nombre);
    val('fq-trabajador-rfc', f.trabajador_rfc || '');
    val('fq-trabajador-ine', f.trabajador_ine || '');
    val('fq-patron', f.patron_nombre);
    val('fq-patron-rfc', f.patron_rfc || '');
    val('fq-rep-legal', f.rep_legal || '');
    val('fq-tipo', f.tipo_separacion);
    val('fq-ingreso', f.fecha_ingreso);
    val('fq-baja', f.fecha_baja);
    val('fq-salario', f.salario_diario);
    val('fq-dias-no-pagados', f.dias_no_pagados || 0);
    val('fq-ciudad', f.ciudad || 'Toluca');
    val('fq-estado', f.estado || 'Estado de México');
    val('fq-notas', f.notas || '');
    val('fq-monto-prest-ant', f.monto_prestaciones_ant || '');

    const esMoral = f.es_persona_moral;
    setToggle('toggle-fq-moral', esMoral);
    show('fq-moral-section', esMoral);
    const prestAnt = f.prestaciones_anteriores;
    setToggle('toggle-fq-prest-ant', prestAnt);
    show('fq-prest-ant-section', prestAnt);
    document.getElementById('fq-modal-title').textContent = 'Editar finiquito';
  } else {
    document.getElementById('fq-modal-title').textContent = 'Nuevo finiquito / liquidación';
    ['fq-trabajador','fq-trabajador-rfc','fq-trabajador-ine','fq-patron','fq-patron-rfc','fq-rep-legal',
     'fq-notas','fq-monto-prest-ant'].forEach(id => val(id, ''));
    val('fq-tipo', 'renuncia_voluntaria');
    val('fq-ingreso', '');
    val('fq-baja', todayStr());
    val('fq-salario', '');
    val('fq-dias-no-pagados', '0');
    val('fq-ciudad', 'Toluca');
    val('fq-estado', 'Estado de México');
    setToggle('toggle-fq-moral', false);
    show('fq-moral-section', false);
    setToggle('toggle-fq-prest-ant', false);
    show('fq-prest-ant-section', false);
  }

  actualizarCalculo();
  openModal('finiquito-modal');
}

function closeFiniquitoModal() { closeModal('finiquito-modal'); }

function actualizarCalculo() {
  const ingreso = g('fq-ingreso')?.value;
  const baja    = g('fq-baja')?.value;
  const salario = Number(g('fq-salario')?.value || 0);
  const tipo    = g('fq-tipo')?.value || 'renuncia_voluntaria';

  if (!ingreso || !baja || !salario) {
    g('fq-preview').innerHTML = '<p style="color:var(--text3);font-size:13px;text-align:center;padding:20px;">Completa los datos para ver el cálculo</p>';
    return;
  }

  const moral = g('toggle-fq-moral')?.classList.contains('on');
  const prestAnt = g('toggle-fq-prest-ant')?.classList.contains('on');

  calculoActual = calcularFiniquito({
    fechaIngreso: ingreso,
    fechaBaja: baja,
    salarioDiario: salario,
    tipoSeparacion: tipo,
    diasNoPagados: Number(g('fq-dias-no-pagados')?.value || 0),
    prestacionesAnteriores: prestAnt,
    montoPrestacionesAnt: Number(g('fq-monto-prest-ant')?.value || 0),
  });

  const c = calculoActual;
  const tipoLabel = {
    renuncia_voluntaria:   'Renuncia Voluntaria',
    despido_justificado:   'Despido Justificado',
    despido_injustificado: 'Despido Injustificado',
    mutuo_acuerdo:         'Mutuo Acuerdo',
  }[tipo] || tipo;

  g('fq-preview').innerHTML = `
    <div class="fq-preview-header">
      <span class="tag tag-cat">${tipoLabel}</span>
      <span style="font-size:11px;color:var(--text3)">${Math.floor(c.diasTrabajados)} días trabajados · ${Math.floor(c.aniosTrabajados * 12)} meses</span>
    </div>
    <div class="fq-calc-grid">
      <div class="fq-row"><span>Aguinaldo proporcional</span><span>${fmt(c.aguinaldo)}</span></div>
      <div class="fq-row"><span>Vacaciones proporcionales (${c.diasVacaciones} días)</span><span>${fmt(c.vacaciones)}</span></div>
      <div class="fq-row"><span>Prima vacacional (25%)</span><span>${fmt(c.primaVac)}</span></div>
      ${c.salariosNoP > 0 ? `<div class="fq-row"><span>Salarios no pagados</span><span>${fmt(c.salariosNoP)}</span></div>` : ''}
      ${c.prestAnt > 0 ? `<div class="fq-row"><span>Prestaciones anteriores</span><span>${fmt(c.prestAnt)}</span></div>` : ''}
      ${c.tresMeses > 0 ? `<div class="fq-row"><span>Indemnización 3 meses (Art. 50)</span><span>${fmt(c.tresMeses)}</span></div>` : ''}
      ${c.veinteAnio > 0 ? `<div class="fq-row"><span>20 días por año (Art. 50)</span><span>${fmt(c.veinteAnio)}</span></div>` : ''}
      <div class="fq-row fq-subtotal"><span>Subtotal</span><span>${fmt(c.subtotal)}</span></div>
      <div class="fq-row"><span>ISR retenido (Art. 93 LISR)</span><span style="color:var(--red)">${fmt(c.isr)}</span></div>
    </div>
    <div class="fq-total">
      <span>TOTAL NETO A PAGAR</span>
      <span>${fmt(c.totalNeto)}</span>
    </div>
  `;
}

async function saveFiniquito() {
  const trabajador = g('fq-trabajador').value.trim();
  const patron     = g('fq-patron').value.trim();
  const ingreso    = g('fq-ingreso').value;
  const baja       = g('fq-baja').value;
  const salario    = Number(g('fq-salario').value);
  if (!trabajador || !patron || !ingreso || !baja || !salario) {
    showToast('error', 'Campos requeridos', 'Completa trabajador, patrón, fechas y salario');
    return;
  }

  const c = calculoActual;
  const mora = g('toggle-fq-moral').classList.contains('on');
  const prestAnt = g('toggle-fq-prest-ant').classList.contains('on');
  const ref = `DRN-FIN-${new Date().getFullYear()}-${String(finiquitos.length + 1).padStart(3,'0')}`;

  const payload = {
    ref: editingFiniquitoId ? (finiquitos.find(x=>x.id===editingFiniquitoId)?.ref || ref) : ref,
    tipo_separacion:      g('fq-tipo').value,
    trabajador_nombre:    trabajador,
    trabajador_rfc:       g('fq-trabajador-rfc').value,
    trabajador_ine:       g('fq-trabajador-ine')?.value || '',
    patron_nombre:        patron,
    patron_rfc:           g('fq-patron-rfc').value,
    es_persona_moral:     mora,
    rep_legal:            mora ? g('fq-rep-legal').value : null,
    fecha_ingreso:        ingreso,
    fecha_baja:           baja,
    salario_diario:       salario,
    dias_no_pagados:      Number(g('fq-dias-no-pagados').value || 0),
    prestaciones_anteriores: prestAnt,
    monto_prestaciones_ant:  prestAnt ? Number(g('fq-monto-prest-ant').value || 0) : 0,
    dias_trabajados:      c.diasTrabajados,
    aguinaldo:            c.aguinaldo,
    vacaciones:           c.vacaciones,
    prima_vacacional:     c.primaVac,
    salarios_caidos:      c.salariosVencidos || 0,
    tres_meses:           c.tresMeses || 0,
    veinte_dias_anio:     c.veinteAnio || 0,
    partes_proporcionales: c.prestAnt || 0,
    total_neto:           c.totalNeto,
    ciudad:               g('fq-ciudad').value || 'Toluca',
    estado:               g('fq-estado').value || 'Estado de México',
    notas:                g('fq-notas').value,
  };

  try {
    if (supabaseClient && SUPABASE_URL !== 'TU_SUPABASE_URL') {
      if (editingFiniquitoId) {
        const updated = await dbUpdateFiniquito(editingFiniquitoId, payload);
        finiquitos = finiquitos.map(x => x.id === editingFiniquitoId ? updated : x);
      } else {
        const created = await dbInsertFiniquito(payload);
        finiquitos.unshift(created);
      }
    } else {
      if (editingFiniquitoId) {
        finiquitos = finiquitos.map(x => x.id === editingFiniquitoId ? {...x,...payload} : x);
      } else {
        finiquitos.unshift({...payload, id:'fq-'+Date.now()});
      }
    }
    showToast('success', 'Finiquito guardado', trabajador);
    closeFiniquitoModal();
    renderFiniquitosList();
    // Auto-download PDF
    setTimeout(() => descargarPDF(editingFiniquitoId || finiquitos[0].id), 300);
  } catch(e) {
    console.error(e);
    showToast('error', 'Error al guardar', e.message);
  }
}

async function deleteFiniquito(id) {
  if (!confirm('¿Eliminar este finiquito?')) return;
  finiquitos = finiquitos.filter(x => x.id !== id);
  renderFiniquitosList();
  try { if (supabaseClient && SUPABASE_URL !== 'TU_SUPABASE_URL') await dbDeleteFiniquito(id); } catch(e){}
}

// ─── GENERADOR PDF ────────────────────────────────────────────
function descargarPDF(id) {
  const f = finiquitos.find(x => x.id === id);
  if (!f) return;

  // Use jsPDF (loaded via CDN in index.html)
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W = 215.9, M = 18;
  let y = 0;

  const purple     = [58, 10, 110];
  const purpleLight= [245, 240, 255];
  const purpleMid  = [124, 92, 252];
  const grayLight  = [245, 245, 248];
  const grayMid    = [180, 180, 195];
  const textDark   = [20, 20, 35];
  const textMid    = [90, 90, 120];
  const white      = [255, 255, 255];
  const green      = [13, 120, 90];
  const greenLight = [230, 250, 244];

  // ── HEADER ──────────────────────────────────────────────────
  // Header: white background with purple top border
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, 38, 'F');
  doc.setFillColor(...purple);
  doc.rect(0, 0, W, 3, 'F');

  // Logo
  try { doc.addImage(LOGO_B64, 'PNG', M, 5, 22, 16); } catch(e) {}

  // Título derecha
  doc.setTextColor(...purple);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CÁLCULO DE FINIQUITO', W - M, 14, {align:'right'});
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textMid);
  doc.text(`REF: ${f.ref || 'DRN-FIN-'+new Date().getFullYear()+'-001'}`, W - M, 20, {align:'right'});
  doc.text(`Fecha: ${new Date(f.fecha_baja+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}`, W - M, 25, {align:'right'});
  doc.setTextColor(...[180, 50, 50]);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8);
  doc.text('DOCUMENTO CONFIDENCIAL', W - M, 31, {align:'right'});
  y = 44;

  // ── SECCIÓN I ────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...purple);
  doc.text('I. RESUMEN EJECUTIVO', M, y);
  doc.setDrawColor(...purpleMid);
  doc.setLineWidth(0.5);
  doc.line(M, y+2, W-M, y+2);
  y += 7;

  // Grid 2x3
  const col1 = M, col2 = W/2 + 2;
  const cellH = 16, cellW = W/2 - M - 2;

  const cells = [
    ['TRABAJADOR', f.trabajador_nombre, 'PATRÓN', f.es_persona_moral ? (f.rep_legal ? f.patron_nombre + '\nRep: ' + f.rep_legal : f.patron_nombre) : f.patron_nombre],
    ['FECHA DE INGRESO', new Date(f.fecha_ingreso+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}), 'FECHA DE BAJA', new Date(f.fecha_baja+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})],
    ['ANTIGÜEDAD', (() => { const d=Math.floor(f.dias_trabajados||0); const a=Math.floor(d/365); const dias=d-(a*365); return `${a} año${a!==1?'s':''}, ${dias} días`; })(), 'TIPO DE SEPARACIÓN', {renuncia_voluntaria:'Renuncia Voluntaria',despido_justificado:'Despido Justificado',despido_injustificado:'Despido Injustificado',mutuo_acuerdo:'Mutuo Acuerdo'}[f.tipo_separacion]||f.tipo_separacion],
  ];

  cells.forEach((row, ri) => {
    // Left cell
    doc.setFillColor(...grayLight);
    doc.roundedRect(col1, y, cellW, cellH, 2, 2, 'F');
    doc.setDrawColor(...grayMid);
    doc.setLineWidth(0.3);
    doc.roundedRect(col1, y, cellW, cellH, 2, 2, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...textMid);
    doc.text(row[0], col1+4, y+5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...textDark);
    // Handle multiline
    const lines1 = row[1].split('\n');
    lines1.forEach((ln, li) => doc.text(ln, col1+4, y+10+(li*4)));

    // Right cell
    doc.setFillColor(...grayLight);
    doc.roundedRect(col2, y, cellW, cellH, 2, 2, 'F');
    doc.setDrawColor(...grayMid);
    doc.roundedRect(col2, y, cellW, cellH, 2, 2, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...textMid);
    doc.text(row[2], col2+4, y+5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...textDark);
    const lines2 = row[3].split('\n');
    lines2.forEach((ln, li) => doc.text(ln, col2+4, y+10+(li*4)));

    y += cellH + 2;
  });

  // Salario + Total highlight
  doc.setFillColor(...grayLight);
  doc.roundedRect(col1, y, cellW, cellH, 2, 2, 'F');
  doc.setDrawColor(...grayMid); doc.setLineWidth(0.3);
  doc.roundedRect(col1, y, cellW, cellH, 2, 2, 'S');
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...textMid);
  doc.text('SALARIO DIARIO', col1+4, y+5);
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...textDark);
  doc.text(`$${Number(f.salario_diario).toLocaleString('es-MX',{minimumFractionDigits:2})} MXN`, col1+4, y+11);

  // Total verde destacado
  doc.setFillColor(...greenLight);
  doc.roundedRect(col2, y, cellW, cellH, 2, 2, 'F');
  doc.setDrawColor(...green); doc.setLineWidth(0.8);
  doc.roundedRect(col2, y, cellW, cellH, 2, 2, 'S');
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...green);
  doc.text('NETO A PAGAR', col2+4, y+5);
  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...green);
  doc.text(`$${Number(f.total_neto).toLocaleString('es-MX',{minimumFractionDigits:2})} MXN`, col2+4, y+12);
  y += cellH + 8;

  // ── SECCIÓN II ───────────────────────────────────────────────
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...purple);
  doc.text('II. BASE PARA CÁLCULO', M, y);
  doc.setDrawColor(...purpleMid); doc.setLineWidth(0.5);
  doc.line(M, y+2, W-M, y+2);
  y += 7;

  // Table header
  const tW = W - 2*M;
  const cols = [tW*0.5, tW*0.28, tW*0.22];
  doc.setFillColor(...purple);
  doc.roundedRect(M, y, tW, 7, 1, 1, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(...white);
  doc.text('Concepto', M+3, y+5);
  doc.text('Fundamento', M+cols[0]+3, y+5);
  doc.text('Valor', M+cols[0]+cols[1]+3, y+5);
  y += 7;

  const baseRows = [
    ['Salario Diario Ordinario', 'Art. 82 LFT', `$${Number(f.salario_diario).toLocaleString('es-MX',{minimumFractionDigits:2})}`],
    ['Días trabajados en el período', '—', `${Math.floor(f.dias_trabajados||0)} días`],
    ['Factor de proporcionalidad (días/365)', 'Art. 87 LFT', `${(Number(f.dias_trabajados||0)/365).toFixed(5)}`],
  ];
  baseRows.forEach((row, i) => {
    doc.setFillColor(...(i%2===0 ? white : grayLight));
    doc.rect(M, y, tW, 6, 'F');
    doc.setDrawColor(...grayMid); doc.setLineWidth(0.2);
    doc.line(M, y+6, M+tW, y+6);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...textDark);
    doc.text(row[0], M+3, y+4.2);
    doc.setTextColor(...textMid);
    doc.text(row[1], M+cols[0]+3, y+4.2);
    doc.setTextColor(...textDark);
    doc.text(row[2], M+cols[0]+cols[1]+3, y+4.2);
    y += 6;
  });
  y += 6;

  // ── SECCIÓN III ──────────────────────────────────────────────
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...purple);
  doc.text('III. DESGLOSE DE CONCEPTOS', M, y);
  doc.setDrawColor(...purpleMid); doc.setLineWidth(0.5);
  doc.line(M, y+2, W-M, y+2);
  y += 7;

  const cols2 = [tW*0.32, tW*0.20, tW*0.28, tW*0.20];
  doc.setFillColor(...purple);
  doc.roundedRect(M, y, tW, 7, 1, 1, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...white);
  let cx = M;
  ['Concepto','Fund. Legal','Fórmula / Cálculo','Importe (MXN)'].forEach((h,i) => {
    doc.text(h, cx+3, y+5); cx += cols2[i];
  });
  y += 7;

  const sd = Number(f.salario_diario);
  const dias = Math.floor(f.dias_trabajados || 0);
  const factor = (dias/365).toFixed(5);
  const dv = Math.floor(Number(f.vacaciones || 0) / sd / (dias/365));

  const detalleRows = [
    ['Aguinaldo Proporcional', 'Art. 87 LFT', `$${sd.toFixed(2)}×15×(${dias}/365)`, f.aguinaldo, false],
    ['Vacaciones Proporcionales', 'Art. 76 LFT\n(Reforma 2023)', `$${sd.toFixed(2)}×${dv}×(${dias}/365)`, f.vacaciones, false],
    ['Prima Vacacional (25%)', 'Art. 80 LFT', `$${Number(f.vacaciones).toFixed(2)}×25%`, f.prima_vacacional, false],
    ...(Number(f.salarios_caidos||0)>0 ? [['Salarios no pagados','—',`$${sd.toFixed(2)}×días`,f.salarios_caidos,false]] : []),
    ...(Number(f.partes_proporcionales||0)>0 ? [['Prestaciones anteriores','—','Monto pendiente',f.partes_proporcionales,false]] : []),
    ...(Number(f.tres_meses||0)>0 ? [['Indemnización 3 meses','Art. 50 LFT',`$${sd.toFixed(2)}×90 días`,f.tres_meses,false]] : []),
    ...(Number(f.veinte_dias_anio||0)>0 ? [['20 días por año antigüedad','Art. 50 LFT',`$${sd.toFixed(2)}×20×años`,f.veinte_dias_anio,false]] : []),
    ['SUBTOTAL LIQUIDACIÓN', '', '', Number(f.aguinaldo||0)+Number(f.vacaciones||0)+Number(f.prima_vacacional||0)+Number(f.tres_meses||0)+Number(f.veinte_dias_anio||0)+Number(f.partes_proporcionales||0)+Number(f.salarios_caidos||0), true],
    ['ISR Retenido', 'Art. 93 LISR', 'Monto exento (< 90 SMG)', 0, false],
  ];

  detalleRows.forEach((row, i) => {
    const isSubtotal = row[4];
    if (isSubtotal) {
      doc.setFillColor(...purpleLight);
    } else {
      doc.setFillColor(...(i%2===0 ? white : grayLight));
    }
    doc.rect(M, y, tW, 7, 'F');
    doc.setDrawColor(...grayMid); doc.setLineWidth(0.2);
    doc.line(M, y+7, M+tW, y+7);

    doc.setFont('helvetica', isSubtotal?'bold':'normal');
    doc.setFontSize(8); doc.setTextColor(...textDark);
    let cx2 = M;
    const rowTexts = [row[0], row[1].replace('\n',' '), row[2], row[3]>0||isSubtotal?`$${Number(row[3]).toLocaleString('es-MX',{minimumFractionDigits:2})}`:'$0.00'];
    rowTexts.forEach((t,ti) => {
      if (ti===3) doc.setTextColor(...(isSubtotal ? [58,10,110] : textDark));
      doc.text(t, cx2+3, y+4.8);
      cx2 += cols2[ti];
    });
    y += 7;
  });

  // Total final
  y += 2;
  doc.setFillColor(...purple);
  doc.roundedRect(M, y, tW, 9, 2, 2, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...white);
  doc.text('TOTAL NETO A PAGAR', M+3, y+6);
  doc.setFontSize(11);
  doc.text(`$${Number(f.total_neto).toLocaleString('es-MX',{minimumFractionDigits:2})}`, M+tW-3, y+6, {align:'right'});
  y += 16;

  // ── SECCIÓN IV ───────────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 18; }
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...purple);
  doc.text('IV. DECLARACIONES Y CLÁUSULAS', M, y);
  doc.setDrawColor(...purpleMid); doc.setLineWidth(0.5);
  doc.line(M, y+2, W-M, y+2);
  y += 7;

  const clausulas = [
    `PRIMERA. El trabajador ${f.trabajador_nombre} manifiesta haber recibido a entera satisfacción la cantidad de $${Number(f.total_neto).toLocaleString('es-MX',{minimumFractionDigits:2})} M.N., en concepto de finiquito laboral, comprensivo de todos los conceptos derivados de la relación laboral conforme a la Ley Federal del Trabajo.`,
    `SEGUNDA. El trabajador declara, bajo protesta de decir verdad, que con el pago señalado queda total y definitivamente liquidado, sin que exista cantidad alguna pendiente por concepto de salarios, prestaciones, comisiones, bonos u otros beneficios derivados de la relación laboral.`,
    `TERCERA. Las partes se otorgan el más amplio finiquito y carta de pago, obligándose a no intentar reclamación judicial o extrajudicial alguna con motivo de la relación laboral, en términos del artículo 33 de la Ley Federal del Trabajo.`,
    `CUARTA. El presente documento se firma en la Ciudad de ${f.ciudad}, ${f.estado}, el día ${new Date(f.fecha_baja+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}, en presencia de los testigos que al calce suscriben.`,
  ];

  clausulas.forEach(cl => {
    const lines = doc.splitTextToSize(cl, tW);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...textDark);
    doc.text(lines, M, y);
    y += lines.length * 4.5 + 3;
  });

  y += 6;
  // ── FIRMAS ──────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = 18; }
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...purple);
  doc.text('V. FIRMAS DE CONFORMIDAD', M, y);
  doc.setDrawColor(...purpleMid); doc.setLineWidth(0.5);
  doc.line(M, y+2, W-M, y+2);
  y += 12;

  const fw = (tW - 6) / 4;
  const firmas = [
    [f.trabajador_nombre, 'Trabajador'],
    [f.es_persona_moral && f.rep_legal ? f.rep_legal : f.patron_nombre, f.es_persona_moral ? 'Patrón / Rep. Legal' : 'Patrón'],
    ['Nombre y firma', 'Testigo 1'],
    ['Nombre y firma', 'Testigo 2'],
  ];

  firmas.forEach((firma, i) => {
    const fx = M + i * (fw + 2);
    doc.setDrawColor(...grayMid); doc.setLineWidth(0.5);
    doc.line(fx, y+18, fx+fw, y+18);
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...textDark);
    const nameLines = doc.splitTextToSize(firma[0], fw);
    nameLines.forEach((ln,li) => doc.text(ln, fx + fw/2, y+22+(li*4), {align:'center'}));
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...textMid);
    doc.text(firma[1], fx + fw/2, y+22+(nameLines.length*4)+2, {align:'center'});
  });

  y += 38;
  // ── FOOTER ──────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(...purple);
    doc.rect(0, 274, W, 12, 'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...white);
    doc.text('DRANUR Legal & Tax Advisory', M, 281);
    doc.text('Documento generado conforme a la Ley Federal del Trabajo vigente', W/2, 281, {align:'center'});
    doc.text(`Página ${p} de ${pageCount}`, W-M, 281, {align:'right'});
  }

  const nombreArchivo = `Finiquito_${f.trabajador_nombre.replace(/\s+/g,'_')}_DRANUR.pdf`;
  doc.save(nombreArchivo);
  showToast('success', 'PDF descargado', nombreArchivo);
}

// ─── TOGGLES MODAL ────────────────────────────────────────────
function toggleFqMoral() {
  const on = !g('toggle-fq-moral').classList.contains('on');
  setToggle('toggle-fq-moral', on);
  show('fq-moral-section', on);
}
function toggleFqPrestAnt() {
  const on = !g('toggle-fq-prest-ant').classList.contains('on');
  setToggle('toggle-fq-prest-ant', on);
  show('fq-prest-ant-section', on);
}
