const { Router } = require('express');
const { listar } = require('../controllers/habitacionesController');

const router = Router();

router.get('/', listar);

module.exports = router;
