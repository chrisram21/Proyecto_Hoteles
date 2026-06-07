const pool = require('../config/postgres');
const { handlePgError } = require('../utils/handlePgError');

async function crearReserva(req, res) {
  const { id_huesped, id_habitacion, fecha_inicio, fecha_fin, num_huespedes } = req.body;
  try {
    const result = await pool.query(
      'CALL sp_realizar_reserva($1, $2, $3, $4, $5, $6)',
      [id_huesped, id_habitacion, fecha_inicio, fecha_fin, num_huespedes, null]
    );
    const idReserva = result.rows[0] ? result.rows[0].p_id_reserva : null;
    res.status(201).json({ id_reserva: idReserva });
  } catch (err) {
    handlePgError(err, res);
  }
}

async function checkout(req, res) {
  const { id } = req.params;
  const { monto_pago, metodo } = req.body;
  try {
    await pool.query(
      'CALL sp_checkout($1, $2, $3)',
      [id, monto_pago, metodo || 'efectivo']
    );
    res.json({ ok: true, id_reserva: Number(id), mensaje: 'Check-out realizado' });
  } catch (err) {
    handlePgError(err, res);
  }
}

async function saldo(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT fn_saldo_reserva($1) AS saldo', [id]);
    res.json({ id_reserva: Number(id), saldo: result.rows[0].saldo });
  } catch (err) {
    handlePgError(err, res);
  }
}

async function listar(req, res) {
  const { estado } = req.query;
  try {
    const params = [];
    let where = '';
    if (estado) {
      params.push(estado);
      where = 'WHERE r.estado = $1';
    }
    const sql = `
      SELECT r.id_reserva,
             r.id_huesped,
             TRIM(CONCAT(h.nombre, ' ', COALESCE(h.apellido, ''))) AS huesped,
             r.id_habitacion,
             hab.numero AS habitacion,
             r.fecha_inicio,
             r.fecha_fin,
             r.estado,
             f.id_factura,
             f.total
      FROM reserva r
      JOIN huesped h ON h.id_huesped = r.id_huesped
      JOIN habitacion hab ON hab.id_habitacion = r.id_habitacion
      LEFT JOIN factura f ON f.id_reserva = r.id_reserva
      ${where}
      ORDER BY r.id_reserva DESC`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    handlePgError(err, res);
  }
}

async function detalle(req, res) {
  const { id } = req.params;
  try {
    const reserva = await pool.query('SELECT * FROM reserva WHERE id_reserva = $1', [id]);
    if (reserva.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    const facturas = await pool.query('SELECT * FROM factura WHERE id_reserva = $1', [id]);
    const saldoQ = await pool.query('SELECT fn_saldo_reserva($1) AS saldo', [id]);
    res.json({
      reserva: reserva.rows[0],
      facturas: facturas.rows,
      saldo: saldoQ.rows[0].saldo,
    });
  } catch (err) {
    handlePgError(err, res);
  }
}

module.exports = { crearReserva, checkout, saldo, listar, detalle };
