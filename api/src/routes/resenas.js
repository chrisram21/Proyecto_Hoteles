const { Router } = require('express');
const { crearResena } = require('../controllers/resenasController');

const router = Router();

router.post('/', crearResena);

module.exports = router;
