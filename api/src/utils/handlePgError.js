function handlePgError(err, res) {
  if (err && (err.code === 'P0001' || err.code === 'P0002' || err.code === 'P0003')) {
    return res.status(400).json({ error: err.message });
  }
  if (err && typeof err.code === 'string' && err.code.startsWith('23')) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { handlePgError };
