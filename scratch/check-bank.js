require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../server/config/database');
const CompanyBank = require('../server/models/finance/CompanyBank');
const Account = require('../server/models/finance/Account');

async function run() {
  await connectDB();
  const banks = await CompanyBank.find({});
  console.log('CompanyBank:', banks);
  const accounts = await Account.find({ accountNumber: "1004" });
  console.log('Account 1004:', accounts);
  await disconnectDB();
}
run();
