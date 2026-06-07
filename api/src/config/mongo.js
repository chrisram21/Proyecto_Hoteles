const mongoose = require('mongoose');
require('dotenv').config();

async function connectMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel_db';
  await mongoose.connect(uri);
  return mongoose.connection;
}

function db() {
  return mongoose.connection.db;
}

module.exports = { mongoose, connectMongo, db };
