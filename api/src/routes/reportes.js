const { Router } = require('express');
const {
  ocupacion,
  topHuespedes,
  satisfaccion,
  aspectosMejorables,
  incidencias,
  perfilRecurrente,
} = require('../controllers/reportesController');

const router = Router();

router.get('/ocupacion', ocupacion);
router.get('/top-huespedes', topHuespedes);
router.get('/satisfaccion', satisfaccion);
router.get('/aspectos-mejorables', aspectosMejorables);
router.get('/incidencias', incidencias);
router.get('/perfil-recurrente', perfilRecurrente);

module.exports = router;
