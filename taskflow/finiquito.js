// taskflow/finiquito.js
// Cálculo de finiquito laboral conforme a la Ley Federal del Trabajo (México)
// Versión corregida: calcula proporcional SOLO del año en curso

// 🔹 Constantes LFT 2026
const LFT = {
  diasAguinaldo: 15,              // Art. 87: mínimo 15 días
  diasTresMeses: 90,              // Art. 50: indemnización despido injustificado
  diasVeinteAnio: 20,             // Art. 50: 20 días por año de servicio
  primaVacacional: 0.25,          // Art. 80: prima mínima 25%
  limiteExento: 90,               // Art. 93 LISR: exento hasta 90 UMA
  smg2025general: 172.87,         // Salario Mínimo General 2025
  tablaVacaciones: [              // Art. 76 LFT (Reforma 2023)
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

// 🔹 Helper: Calcular días trabajados en un año específico
function diasTrabajadosEnAnio(fechaIngreso, fechaBaja, anio) {
  const inicioAnio = new Date(anio, 0, 1);
  const finAnio = new Date(anio, 11, 31, 23, 59, 59);
  
  const inicioReal = fechaIngreso > inicioAnio ? fechaIngreso : inicioAnio;
  const finReal = fechaBaja < finAnio ? fechaBaja : finAnio;
  
  if (inicioReal > finReal) return 0;
  
  const diffMs = finReal - inicioReal;
  return Math.max(0, Math.floor(diffMs / 86400000) + 1);
}

// 🔹 Función principal: Calcular finiquito
function calcularFiniquito(datos) {
  const ingreso = new Date(datos.fechaIngreso + 'T12:00:00');
  const baja = new Date(datos.fechaBaja + 'T12:00:00');
  
  // 🔹 Días totales trabajados (solo para referencia de antigüedad)
  const diffMs = baja - ingreso;
  const diasTotales = Math.max(0, Math.floor(diffMs / 86400000));
  const aniosCompletos = Math.floor(diasTotales / 365);
  
  // 🔹 Días trabajados EN EL AÑO DE BAJA (SOLO ESTO para cálculo proporcional)
  const anioBaja = baja.getFullYear();
  const diasAnioActual = diasTrabajadosEnAnio(ingreso, baja, anioBaja);
  
  // 🔹 Factor proporcional SOLO para el año de baja
  const factorProporcional = diasAnioActual / 365;
  
  const sd = Number(datos.salarioDiario) || 0;
  
  // 🔹 Vacaciones según antigüedad total, pero proporcionales SOLO al año en curso
  const diasVacacionesAnuales = diasVacacionesPorAntiguedad(aniosCompletos);
  
  // ✅ Cálculos CORREGIDOS: solo proporcional del año de baja
  const aguinaldoProporcional = sd * LFT.diasAguinaldo * factorProporcional;
  const vacacionesProporcionales = sd * diasVacacionesAnuales * factorProporcional;
  const primaVacacional = vacacionesProporcionales * LFT.primaVacacional;
  
  // Salarios no pagados
  const salariosNoPagados = sd * Number(datos.diasNoPagados || 0);
  
  // 🔹 Prestaciones de años anteriores (según checkboxes)
  let totalPrestacionesAnteriores = 0;
  const aniosPendientes = [];
  
  if (datos.aniosPrestacionesPendientes && Array.isArray(datos.aniosPrestacionesPendientes)) {
    datos.aniosPrestacionesPendientes.forEach(anio => {
      if (anio !== 'otro') {
        aniosPendientes.push(anio);
      }
    });
  }
  
  // Monto personalizado "Otro"
  if (datos.montoOtroPrestaciones) {
    totalPrestacionesAnteriores += Number(datos.montoOtroPrestaciones) || 0;
  }
  
  // Indemnizaciones según tipo de separación
  let tresMeses = 0, veinteAnio = 0, salariosVencidos = 0;
  if (datos.tipoSeparacion === 'despido_injustificado') {
    tresMeses = sd * LFT.diasTresMeses;
    veinteAnio = sd * LFT.diasVeinteAnio * Math.max(aniosCompletos, 1);
    salariosVencidos = datos.salariosVencidos ? Number(datos.montoSalariosVencidos || 0) : 0;
  }
  
  // Subtotal
  const subtotal = aguinaldoProporcional + vacacionesProporcionales + primaVacacional + 
                   salariosNoPagados + totalPrestacionesAnteriores + 
                   tresMeses + veinteAnio + salariosVencidos;
  
  // ISR
  const limiteExento = LFT.limiteExento * LFT.smg2025general;
  const isr = subtotal > limiteExento ? (subtotal - limiteExento) * 0.15 : 0;
  const totalNeto = subtotal - isr;
  
  return {
    diasTotales,
    diasAnioActual,           // ✅ Días del año de baja
    aniosCompletos,
    diasVacaciones: diasVacacionesAnuales,
    factorProporcional,
    aguinaldo: aguinaldoProporcional,
    vacaciones: vacacionesProporcionales,
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
    { nombre: 'Aguinaldo Proporcional', monto: resultado.aguinaldo, nota: `(${resultado.diasAnioActual} días / 365)` },
    { nombre: 'Vacaciones Proporcionales', monto: resultado.vacaciones, nota: `${resultado.diasVacaciones} días × factor` },
    { nombre: 'Prima Vacacional (25%)', monto: resultado.primaVac },
    { nombre: 'Salarios No Pagados', monto: resultado.salariosNoP },
  ];
  
  // Agregar años pendientes si existen
  if (resultado.aniosPendientes.length > 0) {
    conceptos.push({
      nombre: `Prestaciones años anteriores (${resultado.aniosPendientes.join(', ')})`,
      monto: resultado.prestAnt,
      nota: 'Según selección'
    });
  }
  
  // Agregar monto "Otro" si existe
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
    trabajador: datos.nombreTrabajador,
    patron: datos.nombrePatron,
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
      diasAnioActual: resultado.diasAnioActual,
      factor: resultado.factorProporcional.toFixed(4),
      limiteExentoISR: formatMXN(resultado.limiteExento)
    }
  };
}

// 🔹 Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcularFiniquito, generarResumen, formatMXN, LFT };
}
