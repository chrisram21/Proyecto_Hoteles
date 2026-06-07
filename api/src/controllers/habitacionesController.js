const pool = require('../config/postgres');
const { handlePgError } = require('../utils/handlePgError');

async function listar(req, res) {
  try {
    const sql = `
      SELECT hab.id_habitacion,
             hab.numero,
             hab.piso,
             hab.estado,
             hab.id_tipo,
             t.nombre AS tipo
      FROM habitacion hab
      JOIN tipo_habitacion t ON t.id_tipo = hab.id_tipo
      ORDER BY hab.id_habitacion`;
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

module.exports = { listar };
