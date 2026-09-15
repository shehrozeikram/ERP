const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}).toArray();
    
    users.forEach(u => {
      if (u.firstName?.toLowerCase().includes('kashif') || u.firstName?.toLowerCase().includes('fahad')) {
        console.log(`User: ${u.firstName} ${u.lastName} (Email: ${u.email}, ID: ${u._id})`);
      }
    });
    mongoose.disconnect();
  })
  .catch(console.error);
