require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = require('../models/User');
  const { notifyApprovers } = require('../utils/approvalWhatsAppNotifier');

  const user = await User.findOne({ phone: '03214554035' });
  console.log('User found:', !!user, user?._id);
  if(user) {
    console.log('Sending WA...');
    await notifyApprovers([user._id], { docType: 'TEST', docNumber: '123' });
    console.log('Sent WA function done.');
  } else {
    const all = await User.find({ phone: { $exists: true, $ne: '' } }).select('phone').lean();
    console.log('Available phones:', all.map(a => a.phone));
  }

  await mongoose.disconnect();
}).catch(console.error);
