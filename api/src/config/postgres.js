const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE || 'hotel_db',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
});

module.exports = pool;
