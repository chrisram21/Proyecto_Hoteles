const path = require('path');
const { db } = require('../config/mongo');
const { normalizarResena } = require(path.join(__dirname, '..', '..', '..', 'normalizarResena.js'));

async function crearResena(req, res) {
  try {
    const doc = normalizarResena(req.body);
    const result = await db().collection('resenas').insertOne(doc);
    res.status(201).json({
      ok: true,
      id: result.insertedId,
      promedio: doc.promedio,
    });
  } catch (err) {
    if (err instanceof Error && /Calificaci/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err && err.code === 121) {
      return res.status(400).json({ error: 'El documento no cumple el validador de la coleccion resenas' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { crearResena };
