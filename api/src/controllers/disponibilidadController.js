const pool = require('../config/postgres');
const { handlePgError } = require('../utils/handlePgError');

async function ahora(req, res) {
  try {
    const result = await pool.query('SELECT * FROM v_disponibilidad_inmediata');
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

async function porRango(req, res) {
  const { tipo, inicio, fin } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM fn_disponibilidad_rango($1, $2, $3)',
      [tipo, inicio, fin]
    );
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

module.exports = { ahora, porRango };
