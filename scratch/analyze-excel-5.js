require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../server/config/database');
const LandTransfer = require('../server/models/tajResidencia/LandTransfer');

async function run() {
  await connectDB();
  const count = await LandTransfer.countDocuments();
  console.log(`Total LandTransfers in DB: ${count}`);
  await disconnectDB();
}
run();
