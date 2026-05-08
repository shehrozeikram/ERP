const mongoose = require('mongoose');
const path = require('path');
const User = require('../server/models/User');
const Employee = require('../server/models/hr/Employee');
const KPIEvaluation = require('../server/models/hr/KPIEvaluation');
const KPICycle = require('../server/models/hr/KPICycle');

const checkDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp_local');
    console.log('Connected to DB');

    const user = await User.findOne({ firstName: /Sardar/i, lastName: /Ikram/i });
    if (!user) {
      console.log('User Sardar Shehroze Ikram not found');
      // List some users to help
      const someUsers = await User.find().limit(5);
      console.log('Some users in DB:', someUsers.map(u => `${u.firstName} ${u.lastName}`));
      return;
    }
    console.log('User found:', user._id, user.firstName, user.lastName, 'Role:', user.role);

    const employee = await Employee.findOne({ user: user._id });
    console.log('Associated Employee:', employee ? employee._id : 'None');

    const evalsAsEvaluator = await KPIEvaluation.find({ evaluator: user._id });
    console.log('Evaluations assigned to this user:', evalsAsEvaluator.length);

    if (evalsAsEvaluator.length === 0) {
      const allEvals = await KPIEvaluation.find().limit(10).populate('employee', 'firstName lastName').populate('evaluator', 'firstName lastName');
      console.log('Last 10 evaluations created:');
      allEvals.forEach(e => {
        console.log(`- Employee: ${e.employee?.firstName} ${e.employee?.lastName}, Evaluator: ${e.evaluator ? e.evaluator.firstName + ' ' + e.evaluator.lastName : 'NONE'}, Status: ${e.status}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkDB();
