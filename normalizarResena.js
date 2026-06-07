const { Int32 } = require('mongodb');

function normalizarLista(arr) {
  if (!Array.isArray(arr)) return [];
  const limpios = arr.map(s => String(s).trim().toLowerCase()).filter(s => s.length > 0);
  return [...new Set(limpios)];   // elimina duplicados
}

function normalizarResena(datos) {
  const metricas = ['limpieza', 'atencion', 'ubicacion', 'confort', 'calidad_precio'];
  const cal = datos.calificaciones || {};

  // 1) VALIDAR: cada métrica debe ser entero entre 1 y 5
  for (const m of metricas) {
    const v = cal[m];
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      throw new Error(`Calificación inválida en "${m}": debe ser un entero entre 1 y 5`);
    }
  }

  // 2) CALCULAR el promedio (denormalización justificada)
  const suma = metricas.reduce((acc, m) => acc + cal[m], 0);
  const promedio = Math.round((suma / metricas.length) * 100) / 100;

  // 3) DEVOLVER el documento limpio y tipado
  return {
    reserva_id: new Int32(datos.reserva_id),   // en mongosh, usar NumberInt(...)
    huesped_id: new Int32(datos.huesped_id),
    fecha: datos.fecha ? new Date(datos.fecha) : new Date(),
    calificaciones: {
      limpieza:       new Int32(cal.limpieza),
      atencion:       new Int32(cal.atencion),
      ubicacion:      new Int32(cal.ubicacion),
      confort:        new Int32(cal.confort),
      calidad_precio: new Int32(cal.calidad_precio),
    },
    promedio,
    comentario: datos.comentario ? String(datos.comentario).trim() : '',
    aspectos_destacables: normalizarLista(datos.aspectos_destacables),
    aspectos_mejorables: normalizarLista(datos.aspectos_mejorables),
  };
}

module.exports = { normalizarResena, normalizarLista };