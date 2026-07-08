require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../server/config/database');
const LandTransfer = require('../server/models/tajResidencia/LandTransfer');

async function run() {
  await connectDB();
  const res = await LandTransfer.deleteMany({});
  console.log(`Deleted ${res.deletedCount} LandTransfers.`);
  await disconnectDB();
}
run();
