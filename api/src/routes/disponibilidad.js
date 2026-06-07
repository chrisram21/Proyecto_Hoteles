const { Router } = require('express');
const { ahora, porRango } = require('../controllers/disponibilidadController');

const router = Router();

router.get('/ahora', ahora);
router.get('/', porRango);

module.exports = router;
