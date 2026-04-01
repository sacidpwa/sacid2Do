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
  
  // Días totales trabajados (solo para referencia)
  const diffMs = baja - ingreso;
  const diasTotales = Math.max(0, Math.floor(diffMs / 86400000));
  const aniosCompletos = Math.floor(diasTotales / 365);
  
  const sd = Number(datos.salarioDiario) || 0;
  
  // ✅ Días trabajados EN EL AÑO DE BAJA (solo esto para cálculo proporcional)
  const anioBaja = baja.getFullYear();
  const diasAnioActual = diasTrabajadosEnAnio(ingreso, baja, anioBaja);
  const factorProporcional = diasAnioActual / 365;
  
  // Vacaciones según antigüedad
  const diasVacacionesAnuales = diasVacacionesPorAntiguedad(aniosCompletos);
  
  // ✅ Cálculos proporcionales SOLO del año en curso
  const aguinaldoProporcional = sd * LFT.diasAguinaldo * factorProporcional;
  const vacacionesProporcionales = sd * diasVacacionesAnuales * factorProporcional;
  const primaVacacional = vacacionesProporcionales * LFT.primaVacacional;
  
  // Salarios no pagados
  const salariosNoPagados = sd * Number(datos.diasNoPagados || 0);
  
  // ✅ Prestaciones de años anteriores (SOLO si está activado el toggle)
  let totalPrestacionesAnteriores = 0;
  if (datos.prestacionesAnteriores) {
    totalPrestacionesAnteriores = Number(datos.montoPrestacionesAnt || 0);
  }
  
  // Indemnizaciones según tipo de separación
  let tresMeses = 0, veinteAnio = 0;
  if (datos.tipoSeparacion === 'despido_injustificado') {
    tresMeses = sd * LFT.diasTresMeses;
    veinteAnio = sd * LFT.diasVeinteAnio * Math.max(aniosCompletos, 1);
  }
  
  // Subtotal
  const subtotal = aguinaldoProporcional + vacacionesProporcionales + primaVacacional + 
                   salariosNoPagados + totalPrestacionesAnteriores + 
                   tresMeses + veinteAnio;
  
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
    tresMeses,
    veinteAnio,
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
  
  if (resultado.prestAnt > 0) {
    conceptos.push({ nombre: 'Prestaciones Anteriores', monto: resultado.prestAnt });
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
