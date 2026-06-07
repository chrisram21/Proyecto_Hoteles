const { Int32 } = require('mongodb');
const pool = require('../config/postgres');
const { db } = require('../config/mongo');
const { handlePgError } = require('../utils/handlePgError');

async function ocupacion(req, res) {
  try {
    const result = await pool.query('SELECT * FROM mv_ocupacion_mensual');
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

async function topHuespedes(req, res) {
  try {
    const result = await pool.query('SELECT * FROM mv_top_huespedes');
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

async function satisfaccion(req, res) {
  try {
    const pipeline = [
      {
        $group: {
          _id: { $dateTrunc: { date: '$fecha', unit: 'quarter' } },
          limpieza: { $avg: '$calificaciones.limpieza' },
          atencion: { $avg: '$calificaciones.atencion' },
          ubicacion: { $avg: '$calificaciones.ubicacion' },
          confort: { $avg: '$calificaciones.confort' },
          calidad_precio: { $avg: '$calificaciones.calidad_precio' },
          promedio_general: { $avg: '$promedio' },
          total_resenas: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          trimestre: '$_id',
          limpieza: { $round: ['$limpieza', 2] },
          atencion: { $round: ['$atencion', 2] },
          ubicacion: { $round: ['$ubicacion', 2] },
          confort: { $round: ['$confort', 2] },
          calidad_precio: { $round: ['$calidad_precio', 2] },
          promedio_general: { $round: ['$promedio_general', 2] },
          total_resenas: 1,
        },
      },
    ];
    const rows = await db().collection('resenas').aggregate(pipeline).toArray();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function aspectosMejorables(req, res) {
  try {
    const pipeline = [
      { $unwind: '$aspectos_mejorables' },
      {
        $group: {
          _id: {
            aspecto: '$aspectos_mejorables',
            trimestre: { $dateTrunc: { date: '$fecha', unit: 'quarter' } },
          },
          menciones: { $sum: 1 },
        },
      },
      { $sort: { '_id.trimestre': 1 } },
      {
        $group: {
          _id: '$_id.aspecto',
          total: { $sum: '$menciones' },
          tendencia: { $push: { trimestre: '$_id.trimestre', menciones: '$menciones' } },
        },
      },
      { $sort: { total: -1 } },
      { $project: { _id: 0, aspecto: '$_id', total: 1, tendencia: 1 } },
    ];
    const rows = await db().collection('resenas').aggregate(pipeline).toArray();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function incidencias(req, res) {
  try {
    const pipeline = [
      {
        $facet: {
          por_categoria: [
            { $group: { _id: '$categoria', total: { $sum: 1 } } },
            { $project: { _id: 0, categoria: '$_id', total: 1 } },
            { $sort: { total: -1 } },
          ],
          tasa_resolucion: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                resueltas: {
                  $sum: { $cond: [{ $eq: ['$estado_resolucion', 'resuelta'] }, 1, 0] },
                },
              },
            },
            {
              $project: {
                _id: 0,
                total: 1,
                resueltas: 1,
                porcentaje: {
                  $cond: [
                    { $eq: ['$total', 0] },
                    0,
                    { $round: [{ $multiply: [{ $divide: ['$resueltas', '$total'] }, 100] }, 2] },
                  ],
                },
              },
            },
          ],
          tiempo_resolucion_horas: [
            { $match: { estado_resolucion: 'resuelta', 'acciones.0': { $exists: true } } },
            {
              $project: {
                horas: {
                  $divide: [
                    { $subtract: [{ $max: '$acciones.fecha' }, '$fecha_reporte'] },
                    1000 * 60 * 60,
                  ],
                },
              },
            },
            { $group: { _id: null, promedio_horas: { $avg: '$horas' } } },
            { $project: { _id: 0, promedio_horas: { $round: ['$promedio_horas', 2] } } },
          ],
        },
      },
    ];
    const rows = await db().collection('incidencias').aggregate(pipeline).toArray();
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function perfilRecurrente(req, res) {
  try {
    const pg = await pool.query(
      "SELECT id_huesped FROM reserva WHERE estado = 'completada' GROUP BY id_huesped HAVING COUNT(*) > 3"
    );
    const ids = pg.rows.map((r) => new Int32(r.id_huesped));

    const pipeline = [
      { $match: { huesped_id: { $in: ids } } },
      {
        $facet: {
          idiomas: [
            { $unwind: '$idiomas' },
            { $group: { _id: '$idiomas', total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $project: { _id: 0, valor: '$_id', total: 1 } },
          ],
          alergias: [
            { $unwind: '$alergias' },
            { $group: { _id: '$alergias', total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $project: { _id: 0, valor: '$_id', total: 1 } },
          ],
          almohada: [
            { $group: { _id: '$preferencias.tipo_almohada', total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $project: { _id: 0, valor: '$_id', total: 1 } },
          ],
          vista: [
            { $group: { _id: '$preferencias.vista', total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $project: { _id: 0, valor: '$_id', total: 1 } },
          ],
        },
      },
    ];
    const perfiles = await db().collection('perfiles_huesped').aggregate(pipeline).toArray();

    res.json({
      huespedes_recurrentes: pg.rows.map((r) => r.id_huesped),
      total_recurrentes: pg.rows.length,
      perfiles: perfiles[0] || {},
    });
  } catch (err) {
    handlePgError(err, res);
  }
}

module.exports = {
  ocupacion,
  topHuespedes,
  satisfaccion,
  aspectosMejorables,
  incidencias,
  perfilRecurrente,
};
