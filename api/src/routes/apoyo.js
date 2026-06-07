const { Router } = require('express');
const { tiposHabitacion, servicios } = require('../controllers/apoyoController');

const router = Router();

router.get('/tipos-habitacion', tiposHabitacion);
router.get('/servicios', servicios);

module.exports = router;
