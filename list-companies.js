require('dotenv').config();
const mongoose = require('mongoose');
const Company = require('./server/models/Company');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const companies = await Company.find({}).lean();
  console.log('Total companies:', companies.length);
  companies.forEach(c => {
    console.log(`ID: ${c._id}, Name: "${c.name}", Code: "${c.code}", Status: "${c.status}"`);
  });
  process.exit(0);
})();
