#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');
const { normalizeArea, addAreas, formatKMS, subtractAreas, toSarsais } = require('../utils/landAreaUnits');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));
  console.log('DB', mongoose.connection.name);

  require('../models/tajResidencia/LandMoza');
  const LandMozaKhasraEntry = require('../models/tajResidencia/LandMozaKhasraEntry');
  const LandPossession = require('../models/tajResidencia/LandPossession');
  const LandRegistry = require('../models/tajResidencia/LandRegistry');

  const all = await LandMozaKhasraEntry.find({ khasraNo: '1253' }).populate('moza', 'name slug').lean();
  console.log('ENTRIES', all.length);
  for (const e of all) {
    console.log(JSON.stringify({
      id: String(e._id),
      moza: e.moza?.name,
      khewatNo: e.khewatNo,
      landInKhasra: e.landInKhasra
    }));
  }

  const ids = all.map((e) => e._id);
  const possessions = await LandPossession.find({
    isActive: true,
    $or: [{ 'lines.khasraEntry': { $in: ids } }, { 'lines.khasraNo': '1253' }]
  })
    .select('possessionRef moza lines')
    .populate('moza', 'name')
    .lean();

  console.log('POS', possessions.length);
  for (const p of possessions) {
    for (const l of p.lines || []) {
      if (String(l.khasraNo).trim() !== '1253' && !ids.some((id) => String(id) === String(l.khasraEntry))) {
        continue;
      }
      console.log(JSON.stringify({
        ref: p.possessionRef,
        moza: p.moza?.name,
        entry: String(l.khasraEntry || ''),
        area: l.possessedArea
      }));
    }
  }

  const regs = await LandRegistry.find({
    isActive: true,
    $or: [{ 'lines.khasraEntry': { $in: ids } }, { 'lines.khasraNo': '1253' }]
  })
    .select('registryNo moza lines')
    .populate('moza', 'name')
    .lean();

  console.log('REG', regs.length);
  for (const r of regs) {
    for (const l of r.lines || []) {
      if (String(l.khasraNo).trim() !== '1253' && !ids.some((id) => String(id) === String(l.khasraEntry))) {
        continue;
      }
      console.log(JSON.stringify({
        reg: r.registryNo,
        moza: r.moza?.name,
        entry: String(l.khasraEntry || ''),
        acquired: l.acquiredArea,
        khasraArea: l.khasraArea
      }));
    }
  }

  for (const e of all) {
    let prior = { kanal: 0, marla: 0, sarsai: 0 };
    for (const p of possessions) {
      for (const l of p.lines || []) {
        if (String(l.khasraEntry) === String(e._id)) {
          prior = addAreas(prior, normalizeArea(l.possessedArea));
        }
      }
    }
    const plot = normalizeArea(e.landInKhasra);
    console.log(
      'SUMMARY',
      e.moza?.name,
      'plot',
      formatKMS(plot),
      `(${toSarsais(plot)})`,
      'prior',
      formatKMS(prior),
      `(${toSarsais(prior)})`,
      'rem',
      formatKMS(subtractAreas(plot, prior))
    );
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
