const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectMongo } = require('./config/mongo');
const reservas = require('./routes/reservas');
const facturas = require('./routes/facturas');
const resenas = require('./routes/resenas');
const disponibilidad = require('./routes/disponibilidad');
const habitaciones = require('./routes/habitaciones');
const huespedes = require('./routes/huespedes');
const reportes = require('./routes/reportes');
const apoyo = require('./routes/apoyo');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ ok: true, servicio: 'hotel-api' }));

app.use('/reservas', reservas);
app.use('/facturas', facturas);
app.use('/resenas', resenas);
app.use('/disponibilidad', disponibilidad);
app.use('/habitaciones', habitaciones);
app.use('/huespedes', huespedes);
app.use('/reportes', reportes);
app.use('/', apoyo);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

const PORT = process.env.PORT || 3000;

connectMongo()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('No se pudo conectar a MongoDB:', err);
    process.exit(1);
  });
