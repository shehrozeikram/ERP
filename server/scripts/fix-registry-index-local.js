const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const LandRegistry = require('../models/tajResidencia/LandRegistry');

// Try all possible URIs, prioritizing local
const uris = [
  'mongodb://127.0.0.1:27017/sgc_erp_local',
  'mongodb://localhost:27017/sgc_erp_local',
  process.env.MONGODB_URI_LOCAL,
  process.env.MONGO_URI,
  process.env.MONGODB_URI
].filter(Boolean);

async function tryConnect() {
  for (const uri of uris) {
    try {
      console.log('Trying to connect to:', uri);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log('Connected!');
      
      try {
        await LandRegistry.collection.dropIndex('moza_1_registryNo_1');
        console.log('Successfully dropped old moza_1_registryNo_1 index.');
      } catch (err) {
        console.log('Index moza_1_registryNo_1 might not exist:', err.message);
      }
      
      try {
        await LandRegistry.collection.dropIndex('registryNo_1');
        console.log('Successfully dropped old registryNo_1 index.');
      } catch (err) {
        console.log('Index registryNo_1 might not exist:', err.message);
      }

      try {
        await LandRegistry.syncIndexes();
        console.log('Successfully synced indexes with partialFilterExpression!');
      } catch (err) {
        console.log('Error syncing indexes:', err.message);
      }
      
      process.exit(0);
    } catch (err) {
      console.log('Failed to connect to', uri, err.message);
    }
  }
  process.exit(1);
}

tryConnect();
