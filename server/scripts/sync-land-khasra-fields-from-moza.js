#!/usr/bin/env node
/**
 * One-time fix: sync denormalized khasraNo/khewatNo on registry and possession
 * lines from moza khasra master (LandMozaKhasraEntry).
 *
 * Usage:
 *   node server/scripts/sync-land-khasra-fields-from-moza.js
 *   NODE_ENV=production node server/scripts/sync-land-khasra-fields-from-moza.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { getMongoUri, getMongooseClientOptions } = require('../config/database');
const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
const LandRegistry = require('../models/tajResidencia/LandRegistry');
const LandPossession = require('../models/tajResidencia/LandPossession');

async function main() {
  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('No MongoDB URI configured');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));

  const entries = await LandMozaKhasraEntry.find({}).select('khasraNo khewatNo').lean();
  const byId = new Map(entries.map((e) => [String(e._id), e]));

  let registriesUpdated = 0;
  let possessionUpdated = 0;

  const registries = await LandRegistry.find({ isActive: true });
  for (const reg of registries) {
    let changed = false;
    for (const line of reg.lines) {
      const entry = byId.get(String(line.khasraEntry));
      if (!entry) continue;
      if (line.khasraNo !== entry.khasraNo || line.khewatNo !== entry.khewatNo) {
        line.khasraNo = entry.khasraNo;
        line.khewatNo = entry.khewatNo;
        changed = true;
      }
    }
    if (changed) {
      const khewatNos = [...new Set(reg.lines.map((l) => l.khewatNo).filter(Boolean))];
      reg.khewatNos = khewatNos;
      reg.khewatNo = khewatNos.join(', ');
      await reg.save();
      registriesUpdated += 1;
    }
  }

  const possessions = await LandPossession.find({ isActive: true });
  for (const doc of possessions) {
    let changed = false;
    for (const line of doc.lines) {
      const entry = byId.get(String(line.khasraEntry));
      if (entry && (line.khasraNo !== entry.khasraNo || line.khewatNo !== entry.khewatNo)) {
        line.khasraNo = entry.khasraNo;
        line.khewatNo = entry.khewatNo;
        changed = true;
      }
      const regEntry = byId.get(String(line.registryKhasraEntry));
      if (regEntry && (
        line.registryKhasraNo !== regEntry.khasraNo || line.registryKhewatNo !== regEntry.khewatNo
      )) {
        line.registryKhasraNo = regEntry.khasraNo;
        line.registryKhewatNo = regEntry.khewatNo;
        changed = true;
      }
    }
    if (changed) {
      const khewatNos = [...new Set(doc.lines.map((l) => l.khewatNo).filter(Boolean))];
      doc.khewatNo = khewatNos.join(', ');
      await doc.save();
      possessionUpdated += 1;
    }
  }

  console.log(`Synced khasra/khewat on ${registriesUpdated} registry record(s) and ${possessionUpdated} possession record(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
