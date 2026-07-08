require('dotenv').config({ path: __dirname + '/../../.env' });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/database');
const LandTransfer = require('../models/tajResidencia/LandTransfer');

async function run() {
  await connectDB();
  const res = await LandTransfer.deleteMany({});
  console.log(`Deleted ${res.deletedCount} LandTransfers from database.`);
  await disconnectDB();
}
run();
