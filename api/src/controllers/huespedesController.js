const pool = require('../config/postgres');
const { handlePgError } = require('../utils/handlePgError');

async function hospedados(req, res) {
  try {
    const result = await pool.query('SELECT * FROM v_huespedes_hospedados');
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

async function listar(req, res) {
  try {
    const result = await pool.query('SELECT * FROM huesped ORDER BY id_huesped');
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

module.exports = { hospedados, listar };
