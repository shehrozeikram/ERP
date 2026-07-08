require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../server/config/database');
const LandMoza = require('../server/models/tajResidencia/LandMoza');
const LandPurchase = require('../server/models/tajResidencia/LandPurchase');

async function run() {
  await connectDB();
  const mozas = await LandMoza.find({}, 'name isActive');
  console.log('Mozas:', mozas);
  
  const purchases = await LandPurchase.find({}, 'dealNo').limit(5);
  console.log('Purchases sample:', purchases);
  
  await disconnectDB();
}
run();
