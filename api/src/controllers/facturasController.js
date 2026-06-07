const pool = require('../config/postgres');
const { handlePgError } = require('../utils/handlePgError');

async function registrarPago(req, res) {
  const { id } = req.params;
  const { monto, metodo } = req.body;
  try {
    await pool.query(
      'CALL sp_registrar_pago($1, $2, $3)',
      [id, monto, metodo || 'efectivo']
    );
    res.status(201).json({ ok: true, id_factura: Number(id), mensaje: 'Pago registrado' });
  } catch (err) {
    handlePgError(err, res);
  }
}

async function listar(req, res) {
  const { estado, reserva } = req.query;
  try {
    const params = [];
    const conds = [];
    if (estado) {
      params.push(estado);
      conds.push(`estado = $${params.length}`);
    }
    if (reserva) {
      params.push(reserva);
      conds.push(`id_reserva = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const sql = `SELECT id_factura, id_reserva, total, estado FROM factura ${where} ORDER BY id_factura DESC`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

module.exports = { registrarPago, listar };
