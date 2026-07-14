const mongoose = require('mongoose');
require('dotenv').config();

const LandMoza = require('../models/tajResidencia/LandMoza');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandTransfer = require('../models/tajResidencia/LandTransfer');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const LandPossession = require('../models/tajResidencia/LandPossession');

async function mergeAllKakMozas() {
  try {
    console.log('Connecting to Database...', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    
    // The canonical Moza we want to keep
    const canonicalMozaId = '6a5210c11a3d9cf13e74505b';
    const canonicalMoza = await LandMoza.findById(canonicalMozaId);
    
    if (!canonicalMoza) {
      console.log('Canonical Moza not found!');
      process.exit(1);
    }
    
    console.log(`Canonical Moza: ${canonicalMoza.name} (${canonicalMoza._id})`);
    
    // Find all other Mozas matching Kak or Kaak
    const otherMozas = await LandMoza.find({ 
      name: /kak|kaak/i, 
      _id: { $ne: canonicalMoza._id } 
    });
    
    console.log(`Found ${otherMozas.length} other Mozas to merge into Canonical.`);

    for (const oldMoza of otherMozas) {
      console.log(`\n--- Merging Moza: ${oldMoza.name} (${oldMoza._id}) ---`);
      
      // 1. Map Khasra Entries
      const oldEntries = await LandMozaKhasraEntry.find({ moza: oldMoza._id });
      console.log(`Found ${oldEntries.length} khasra entries in old Moza.`);
      
      const khasraMapping = {};
      let movedEntries = 0;
      
      for (const oldE of oldEntries) {
        // Try to find equivalent in canonical
        const equiv = await LandMozaKhasraEntry.findOne({
          moza: canonicalMoza._id,
          khewatNo: oldE.khewatNo,
          khatooniNo: oldE.khatooniNo,
          khasraNo: oldE.khasraNo
        });
        
        if (equiv) {
          khasraMapping[oldE._id.toString()] = equiv._id.toString();
        } else {
          // If no equivalent, just move it
          oldE.moza = canonicalMoza._id;
          await oldE.save();
          khasraMapping[oldE._id.toString()] = oldE._id.toString(); // Map to itself since it moved
          movedEntries++;
        }
      }
      console.log(`Mapped ${Object.keys(khasraMapping).length - movedEntries} to existing canonical entries. Moved ${movedEntries} entries.`);

      // Helper to update lines
      const updateLines = (lines) => {
        let changed = false;
        if (!lines) return false;
        for (const line of lines) {
          if (line.khasraEntry && khasraMapping[line.khasraEntry.toString()]) {
            line.khasraEntry = khasraMapping[line.khasraEntry.toString()];
            changed = true;
          }
        }
        return changed;
      };

      // 2. Update Land Purchases
      const purchases = await LandPurchase.find({ moza: oldMoza._id });
      for (const p of purchases) {
        p.moza = canonicalMoza._id;
        updateLines(p.lines);
        await p.save();
      }
      console.log(`Migrated ${purchases.length} LandPurchases.`);

      // 3. Update Land Transfers
      const transfers = await LandTransfer.find({ moza: oldMoza._id });
      for (const t of transfers) {
        t.moza = canonicalMoza._id;
        updateLines(t.lines);
        await t.save();
      }
      console.log(`Migrated ${transfers.length} LandTransfers.`);

      // 4. Update Land Registries
      const registries = await LandRegistry.find({ moza: oldMoza._id });
      for (const r of registries) {
        r.moza = canonicalMoza._id;
        updateLines(r.lines);
        await r.save();
      }
      console.log(`Migrated ${registries.length} LandRegistries.`);

      // 5. Update Land Possessions
      const possessions = await LandPossession.find({ moza: oldMoza._id });
      for (const pos of possessions) {
        pos.moza = canonicalMoza._id;
        updateLines(pos.lines);
        await pos.save();
      }
      console.log(`Migrated ${possessions.length} LandPossessions.`);

      // 6. Deactivate old Moza
      oldMoza.isActive = false;
      await oldMoza.save();
      console.log(`Deactivated old Moza ${oldMoza.name}.`);
    }

    console.log('\nAll duplicates merged successfully into Canonical Kak Moza!');
    process.exit(0);

  } catch (err) {
    console.error('Error merging mozas:', err);
    process.exit(1);
  }
}

mergeAllKakMozas();
