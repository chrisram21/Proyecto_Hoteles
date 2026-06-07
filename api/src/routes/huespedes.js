const { Router } = require('express');
const { hospedados, listar } = require('../controllers/huespedesController');

const router = Router();

router.get('/hospedados', hospedados);
router.get('/', listar);

module.exports = router;
