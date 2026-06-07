const { Router } = require('express');
const { registrarPago, listar } = require('../controllers/facturasController');

const router = Router();

router.get('/', listar);
router.post('/:id/pagos', registrarPago);

module.exports = router;
