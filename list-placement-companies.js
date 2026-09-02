require('dotenv').config();
const mongoose = require('mongoose');
const PlacementCompany = require('./server/models/PlacementCompany');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const companies = await PlacementCompany.find({}).lean();
  console.log('Total placement companies:', companies.length);
  companies.forEach(c => {
    console.log(`ID: ${c._id}, Name: "${c.name}", Code: "${c.code}", isActive: ${c.isActive}`);
  });
  process.exit(0);
})();
