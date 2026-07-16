require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./server/models/User');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const user = await User.findOne({ 
      $or: [
        { firstName: /ahsan/i },
        { lastName: /ahsan/i },
        { email: /ahsan/i }
      ]
    });
    console.log(user ? `Found: ${user.firstName} ${user.lastName} - Role: ${user.role}` : 'User not found');
    process.exit(0);
  });
