const pool = require('../config/postgres');
const { handlePgError } = require('../utils/handlePgError');

async function tiposHabitacion(req, res) {
  try {
    const result = await pool.query('SELECT * FROM tipo_habitacion ORDER BY id_tipo');
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

async function servicios(req, res) {
  try {
    const result = await pool.query('SELECT * FROM servicio_extra ORDER BY id_servicio');
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

module.exports = { tiposHabitacion, servicios };
