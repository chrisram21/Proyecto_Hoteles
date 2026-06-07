const { Router } = require('express');
const { crearReserva, checkout, saldo, listar, detalle } = require('../controllers/reservasController');

const router = Router();

router.get('/', listar);
router.post('/', crearReserva);
router.post('/:id/checkout', checkout);
router.get('/:id/saldo', saldo);
router.get('/:id/detalle', detalle);

module.exports = router;
