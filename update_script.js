const { connectDB } = require('./server/config/database');
const Employee = require('./server/models/hr/Employee');

(async () => {
  try {
    await connectDB();
    const result = await Employee.updateMany(
      { 'eobi.isActive': true },
      { $set: { 'eobi.amount': 407 } }
    );
    console.log('BULK_EOBI_UPDATE_SUCCESS:', JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
