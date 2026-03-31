// taskflow/finiquito.js
// Cálculo de finiquito laboral conforme a la Ley Federal del Trabajo (México)

// 🔹 Constantes LFT 2026
const LFT = {
  diasAguinaldo: 15,
  diasTresMeses: 90,
  diasVeinteAnio: 20,
  primaVacacional: 0.25,
  limiteExento: 90,
  smg2025general: 172.87,
  tablaVacaciones: [
    { min: 0, max: 0, dias: 12 },
    { min: 1, max: 1, dias: 14 },
    { min: 2, max: 2, dias: 16 },
    { min: 3, max: 3, dias: 18 },
    { min: 4, max: 4, dias: 20 },
    { min: 5, max: 9, dias: 22 },
    { min: 10, max: 14, dias: 24 },
    { min: 15, max: 19, dias: 26 },
    { min: 20, max: 24, dias: 28 },
    { min: 25, max: 29, dias: 30 },
    { min: 30, max: 34, dias: 32 },
    { min: 35, max: null, dias: 34 }
  ]
};

// 🔹 Helper: Obtener días de vacaciones según años completos
function diasVacacionesPorAntiguedad(anios) {
  const entrada = LFT.tablaVacaciones.find(rango => {
    if (rango.max === null) return anios >= rango.min;
    return anios >= rango.min && anios <= rango.max;
  });
  return entrada ? entrada.dias : 12;
}

// 🔹 Función principal: Calcular finiquito
function calcularFiniquito(datos) {
  const ingreso = new Date(datos.fechaIngreso + 'T12:00:00');
  const baja = new Date(datos.fechaBaja + 'T12:00:00');
  
  // Días totales trabajados
  const diffMs = baja - ingreso;
  const diasTotales = Math.max(0, Math.floor(diffMs / 86400000));
  const aniosCompletos = Math.floor(diasTotales / 365);
  
  const sd = Number(datos.salarioDiario) || 0;
  
  let diasParaCalculo = 0;
  let factorProporcional = 0;
  
  // 🔹 LÓGICA CORREGIDA:
  if (datos.prestacionesAnterioresPendientes) {
    // ✅ Si NO se pagaron prestaciones anteriores, calcular sobre TODA la antigüedad
    diasParaCalculo = diasTotales;
    factorProporcional = diasTotales / 365;
  } else {
    // ✅ Si YA se pagaron, calcular solo proporcional del año en curso
    const anioBaja = baja.getFullYear();
    const inicioAnio = new Date(anioBaja, 0, 1);
    const diasAnioActual = Math.max(1, Math.floor((baja - inicioAnio) / 86400000) + 1);
    diasParaCalculo = diasAnioActual;
    factorProporcional = diasAnioActual / 365;
  }
  
  // Vacaciones según antigüedad
  const diasVacacionesAnuales = diasVacacionesPorAntiguedad(aniosCompletos);
  
  // Cálculos
  const aguinaldo = sd * LFT.diasAguinaldo * factorProporcional;
  const vacaciones = sd * diasVacacionesAnuales * factorProporcional;
  const primaVacacional = vacaciones * LFT.primaVacacional;
  const salariosNoPagados = sd * Number(datos.diasNoPagados || 0);
  
  // Prestaciones de años anteriores (monto manual)
  let totalPrestacionesAnteriores = 0;
  const aniosPendientes = [];
  
  if (datos.aniosPrestacionesPendientes && Array.isArray(datos.aniosPrestacionesPendientes)) {
    datos.aniosPrestacionesPendientes.forEach(anio => {
      if (anio !== 'otro') {
        aniosPendientes.push(anio);
      }
    });
  }
  
  if (datos.montoOtroPrestaciones) {
    totalPrestacionesAnteriores += Number(datos.montoOtroPrestaciones) || 0;
  }
  
  // Indemnizaciones
  let tresMeses = 0, veinteAnio = 0, salariosVencidos = 0;
  if (datos.tipoSeparacion === 'despido_injustificado') {
    tresMeses = sd * LFT.diasTresMeses;
    veinteAnio = sd * LFT.diasVeinteAnio * Math.max(aniosCompletos, 1);
    salariosVencidos = datos.salariosVencidos ? Number(datos.montoSalariosVencidos || 0) : 0;
  }
  
  // Subtotal
  const subtotal = aguinaldo + vacaciones + primaVacacional + 
                   salariosNoPagados + totalPrestacionesAnteriores + 
                   tresMeses + veinteAnio + salariosVencidos;
  
  // ISR
  const limiteExento = LFT.limiteExento * LFT.smg2025general;
  const isr = subtotal > limiteExento ? (subtotal - limiteExento) * 0.15 : 0;
  const totalNeto = subtotal - isr;
  
  return {
    diasTotales,
    diasParaCalculo,
    aniosCompletos,
    diasVacaciones: diasVacacionesAnuales,
    factorProporcional,
    aguinaldo,
    vacaciones,
    primaVac: primaVacacional,
    salariosNoP: salariosNoPagados,
    prestAnt: totalPrestacionesAnteriores,
    aniosPendientes,
    tresMeses,
    veinteAnio,
    salariosVencidos,
    subtotal,
    isr,
    totalNeto,
    limiteExento,
  };
}

// 🔹 Helper: Formatear moneda
function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// 🔹 Helper: Generar resumen
function generarResumen(datos) {
  const resultado = calcularFiniquito(datos);
  
  const conceptos = [
    { 
      nombre: 'Aguinaldo Proporcional', 
      monto: resultado.aguinaldo, 
      nota: `(${resultado.diasParaCalculo} días / 365)` 
    },
    { 
      nombre: 'Vacaciones Proporcionales', 
      monto: resultado.vacaciones, 
      nota: `${resultado.diasVacaciones} días × factor` 
    },
    { 
      nombre: 'Prima Vacacional (25%)', 
      monto: resultado.primaVac 
    },
    { 
      nombre: 'Salarios No Pagados', 
      monto: resultado.salariosNoP 
    },
  ];
  
  if (resultado.aniosPendientes.length > 0) {
    conceptos.push({
      nombre: `Prestaciones años anteriores (${resultado.aniosPendientes.join(', ')})`,
      monto: resultado.prestAnt,
      nota: 'Según selección'
    });
  }
  
  if (datos.montoOtroPrestaciones && Number(datos.montoOtroPrestaciones) > 0) {
    conceptos.push({
      nombre: 'Otros conceptos pendientes',
      monto: Number(datos.montoOtroPrestaciones),
      nota: 'Monto personalizado'
    });
  }
  
  if (resultado.tresMeses > 0) {
    conceptos.push({ nombre: 'Indemnización 3 meses', monto: resultado.tresMeses });
  }
  if (resultado.veinteAnio > 0) {
    conceptos.push({ nombre: 'Indemnización 20 días/año', monto: resultado.veinteAnio });
  }
  
  return {
    trabajador: datos.nombreTrabajador || 'TRABAJADOR',
    patron: datos.nombrePatron || 'PATRÓN',
    fechaIngreso: datos.fechaIngreso,
    fechaBaja: datos.fechaBaja,
    antiguedad: `${resultado.aniosCompletos} años, ${resultado.diasTotales % 365} días`,
    salarioDiario: formatMXN(datos.salarioDiario),
    conceptos,
    subtotal: resultado.subtotal,
    isr: resultado.isr,
    totalNeto: resultado.totalNeto,
    detalleTecnico: {
      diasTotales: resultado.diasTotales,
      diasParaCalculo: resultado.diasParaCalculo,
      factor: resultado.factorProporcional.toFixed(4),
      limiteExentoISR: formatMXN(resultado.limiteExento)
    }
  };
}

// 🔹 Guardar cálculo en localStorage
function guardarCalculo(nombre, datos, resultado) {
  const calculos = JSON.parse(localStorage.getItem('finiquitos') || '[]');
  const nuevoCalculo = {
    id: Date.now(),
    nombre: nombre || `Finiquito ${new Date().toLocaleDateString()}`,
    fecha: new Date().toISOString(),
    datos,
    resultado
  };
  calculos.push(nuevoCalculo);
  localStorage.setItem('finiquitos', JSON.stringify(calculos));
  return nuevoCalculo.id;
}

// 🔹 Cargar cálculo desde localStorage
function cargarCalculo(id) {
  const calculos = JSON.parse(localStorage.getItem('finiquitos') || '[]');
  return calculos.find(c => c.id === id);
}

// 🔹 Obtener todos los cálculos guardados
function obtenerCalculosGuardados() {
  return JSON.parse(localStorage.getItem('finiquitos') || '[]');
}

// 🔹 Eliminar cálculo guardado
function eliminarCalculo(id) {
  const calculos = JSON.parse(localStorage.getItem('finiquitos') || '[]');
  const filtrados = calculos.filter(c => c.id !== id);
  localStorage.setItem('finiquitos', JSON.stringify(filtrados));
}

// 🔹 Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    calcularFiniquito, 
    generarResumen, 
    formatMXN, 
    LFT,
    guardarCalculo,
    cargarCalculo,
    obtenerCalculosGuardados,
    eliminarCalculo
  };
}
