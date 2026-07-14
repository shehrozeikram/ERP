require('dotenv').config();
const mongoose = require('mongoose');
const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || process.env.MONGO_URI;
  await mongoose.connect(uri);

  const mozas = await LandMoza.find({});
  console.log("--- Mozas in Database ---");
  for (const moza of mozas) {
    const count = await LandMozaKhasraEntry.countDocuments({ moza: moza._id });
    console.log(`Name: "${moza.name}" | Slug: "${moza.slug}" | Khasras: ${count}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
