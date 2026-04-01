// taskflow/finiquito.js
// Cálculo de finiquito laboral conforme a la Ley Federal del Trabajo (México)

// 🔹 Constantes LFT 2026
const LFT = {
  diasAguinaldo: 15,              // Art. 87: mínimo 15 días
  diasTresMeses: 90,              // Art. 50: indemnización despido injustificado
  diasVeinteAnio: 20,             // Art. 50: 20 días por año de servicio (a partir del año 16)
  primaVacacional: 0.25,          // Art. 80: prima mínima 25%
  limiteExento: 90,               // Art. 93 LISR: exento hasta 90 UMA
  smg2025general: 172.87,         // Salario Mínimo General 2025 (UMA equivalente para cálculo)
  tablaVacaciones: [              // Art. 76 LFT (Reforma 2023): días de vacaciones por antigüedad
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

// 🔹 Helper: Obtener días de vacaciones según años completos de antigüedad
function diasVacacionesPorAntiguedad(anios) {
  const entrada = LFT.tablaVacaciones.find(rango => {
    if (rango.max === null) return anios >= rango.min;
    return anios >= rango.min && anios <= rango.max;
  });
  return entrada ? entrada.dias : 12;
}

// 🔹 Función principal: Calcular finiquito con lógica CORREGIDA
function calcularFiniquito(datos) {
  // Parsear fechas con zona horaria neutra
  const ingreso = new Date(datos.fechaIngreso + 'T12:00:00');
  const baja = new Date(datos.fechaBaja + 'T12:00:00');
  
  // 🔹 Días totales trabajados (para antigüedad y cálculo de días de vacaciones)
  const diffMs = baja - ingreso;
  const diasTotales = Math.max(0, Math.floor(diffMs / 86400000));
  const aniosCompletos = Math.floor(diasTotales / 365);
  
  // 🔹 Días trabajados EN EL AÑO DE BAJA (solo para proporcional de finiquito)
  // Esto corrige el error: solo se calcula lo proporcional del año en curso
  const anioBaja = baja.getFullYear();
  const inicioAnioBaja = new Date(anioBaja, 0, 1); // 1 de enero del año de baja
  const fechaInicioProporcional = ingreso > inicioAnioBaja ? ingreso : inicioAnioBaja;
  const diasAnioActual = Math.max(1, Math.floor((baja - fechaInicioProporcional) / 86400000) + 1);
  
  const sd = Number(datos.salarioDiario) || 0;
  
  // 🔹 Vacaciones: se calculan con la tabla de antigüedad, pero proporcionales al año en curso
  const diasVacacionesAnuales = diasVacacionesPorAntiguedad(aniosCompletos);
  
  // 🔹 Factor proporcional SOLO para el año en curso (no sobre toda la antigüedad)
  const factorProporcional = diasAnioActual / 365;
  
  // ✅ Cálculos CORREGIDOS: solo proporcional del año en curso (2026 en tu ejemplo)
  const aguinaldoProporcional = sd * LFT.diasAguinaldo * factorProporcional;
  const vacacionesProporcionales = sd * diasVacacionesAnuales * factorProporcional;
  const primaVacacional = vacacionesProporcionales * LFT.primaVacacional;
  
  // Salarios no pagados (días trabajados del último período no cubierto por nómina)
  const salariosNoPagados = sd * Number(datos.diasNoPagados || 0);
  
  // Prestaciones anteriores pendientes (si el usuario indica que no se pagaron)
  const prestAnt = datos.prestacionesAnteriores ? Number(datos.montoPrestacionesAnt || 0) : 0;
  
  // Indemnizaciones según tipo de separación (solo para despido injustificado)
  let tresMeses = 0, veinteAnio = 0, salariosVencidos = 0;
  if (datos.tipoSeparacion === 'despido_injustificado') {
    tresMeses = sd * LFT.diasTresMeses;
    // 20 días por año a partir del año 16, pero se calcula desde año 1 si es menor
    const aniosParaVeinte = Math.max(1, aniosCompletos);
    veinteAnio = sd * LFT.diasVeinteAnio * aniosParaVeinte;
    // Salarios vencidos: opcional, según reclamación (Art. 48-50 LFT)
    salariosVencidos = datos.salariosVencidos ? Number(datos.montoSalariosVencidos || 0) : 0;
  }
  
  // Subtotal antes de impuestos
  const subtotal = aguinaldoProporcional + vacacionesProporcionales + primaVacacional + 
                   salariosNoPagados + prestAnt + tresMeses + veinteAnio + salariosVencidos;
  
  // ISR: exento si < 90 SMG (Art. 93 LISR). Si supera, se grava el excedente al 15%
  const limiteExento = LFT.limiteExento * LFT.smg2025general;
  const isr = subtotal > limiteExento ? (subtotal - limiteExento) * 0.15 : 0;
  const totalNeto = subtotal - isr;
  
  // 🔹 Retornar objeto con todos los conceptos desglosados
  return {
    diasTotales,              // Días totales de antigüedad (para referencia)
    diasAnioActual,           // 🔹 Días del año en curso (base del cálculo proporcional)
    aniosCompletos,           // Años completos para tabla de vacaciones
    diasVacaciones: diasVacacionesAnuales, // Días de vacaciones anuales según antigüedad
    factorProporcional,       // Factor aplicado (diasAnioActual/365)
    aguinaldo: aguinaldoProporcional,
    vacaciones: vacacionesProporcionales,
    primaVac: primaVacacional,
    salariosNoP: salariosNoPagados,
    prestAnt,                 // Prestaciones anteriores pendientes
    tresMeses,                // Indemnización 90 días (solo despido injustificado)
    veinteAnio,               // Indemnización 20 días/año (solo despido injustificado)
    salariosVencidos,         // Salarios caídos (opcional)
    subtotal,                 // Suma antes de ISR
    isr,                      // ISR retenido
    totalNeto,                // ✅ Neto a pagar
    limiteExento,             // Límite de exención ISR
  };
}

// 🔹 Helper: Formatear moneda MXN
function formatMXN(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// 🔹 Helper: Generar resumen para UI
function generarResumen(datos) {
  const resultado = calcularFiniquito(datos);
  
  return {
    trabajador: datos.nombreTrabajador,
    patron: datos.nombrePatron,
    fechaIngreso: datos.fechaIngreso,
    fechaBaja: datos.fechaBaja,
    antiguedad: `${resultado.aniosCompletos} años, ${resultado.diasTotales % 365} días`,
    salarioDiario: formatMXN(datos.salarioDiario),
    conceptos: [
      { nombre: 'Aguinaldo Proporcional', monto: resultado.aguinaldo, nota: `(${resultado.diasAnioActual} días / 365)` },
      { nombre: 'Vacaciones Proporcionales', monto: resultado.vacaciones, nota: `${resultado.diasVacaciones} días × factor` },
      { nombre: 'Prima Vacacional (25%)', monto: resultado.primaVac },
      { nombre: 'Salarios No Pagados', monto: resultado.salariosNoP },
      ...(resultado.prestAnt > 0 ? [{ nombre: 'Prestaciones Anteriores', monto: resultado.prestAnt }] : []),
      ...(resultado.tresMeses > 0 ? [{ nombre: 'Indemnización 3 meses', monto: resultado.tresMeses }] : []),
      ...(resultado.veinteAnio > 0 ? [{ nombre: 'Indemnización 20 días/año', monto: resultado.veinteAnio }] : []),
    ],
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

// 🔹 Exportar para uso en navegador/Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcularFiniquito, generarResumen, formatMXN, LFT };
}
