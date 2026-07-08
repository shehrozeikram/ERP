require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../server/config/database');
const LandTransfer = require('../server/models/tajResidencia/LandTransfer');

async function run() {
  await connectDB();
  const transfers = await LandTransfer.find({}).limit(5).select('referenceNo transferNo');
  console.log(transfers);
  await disconnectDB();
}
run();
