const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const LandRegistry = require('../models/tajResidencia/LandRegistry');

const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || process.env.MONGO_URI;

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  try {
    // Drop the problematic index if it exists (which causes issues with empty registryNos)
    await LandRegistry.collection.dropIndex('moza_1_registryNo_1');
    console.log('Successfully dropped old moza_1_registryNo_1 index.');
  } catch (err) {
    console.log('Index moza_1_registryNo_1 might not exist or already dropped:', err.message);
  }
  
  try {
    await LandRegistry.collection.dropIndex('registryNo_1');
    console.log('Successfully dropped old registryNo_1 index.');
  } catch (err) {
    console.log('Index registryNo_1 might not exist or already dropped:', err.message);
  }

  try {
    // Sync indexes with the current Mongoose schema (which correctly allows empty registryNos)
    await LandRegistry.syncIndexes();
    console.log('Successfully synced indexes with partialFilterExpression!');
  } catch (err) {
    console.log('Error syncing indexes:', err.message);
  }
  
  process.exit(0);
});
