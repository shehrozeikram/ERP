const mongoose = require('mongoose');

const propertyCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 1000 }
});

const PropertyCounter = mongoose.model('PropertyCounter', propertyCounterSchema);

// Initialize counter on module load (will only run once)
// Note: We don't sync with actual max srNo here to avoid circular dependency
// The pre-save hook in TajProperty will handle syncing if needed
let counterInitialized = false;
const initializeCounter = async () => {
  if (!counterInitialized) {
    try {
      await PropertyCounter.findOneAndUpdate(
        { _id: 'propertySrNo' },
        { $setOnInsert: { sequence: 1000 } },
        { upsert: true, new: true }
      );
      counterInitialized = true;
    } catch (error) {
      // Ignore initialization errors - will be handled in pre-save hook
      console.error('Error initializing PropertyCounter:', error);
    }
  }
};

// Initialize counter (non-blocking)
initializeCounter().catch(() => {});

module.exports = PropertyCounter;

