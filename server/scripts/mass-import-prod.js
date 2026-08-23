const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Try to load production env if it exists (on server), otherwise local
require('dotenv').config({ path: path.join(__dirname, '../../.env.production') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') }); // fallback

const User = require('../models/User');

async function runMassImport() {
  console.log('🚀 Starting Mass Leave Import...');
  try {
    const uri = 'mongodb://admin:9d6a1b546b2933c59aff1db8366a19df7c0773f546dff638@127.0.0.1:27017/sgc_erp?authSource=admin';
    console.log(`🔗 Connecting to MongoDB...`);
    await mongoose.connect(uri, { family: 4 });
    console.log('✅ Connected to MongoDB');

    // 2. Find admin user and generate token
    const adminUser = await User.findOne({ email: 'ceo@sgc.com' }) || await User.findOne({ role: 'super_admin' });
    if (!adminUser) {
      throw new Error('Could not find an admin user to generate token');
    }
    const token = adminUser.generateAuthToken();
    console.log(`✅ Generated token for admin: ${adminUser.email}`);

    // 3. Prepare form data with Leave01.xlsx
    const filePath = path.resolve(__dirname, '../../docs/Leave01.xlsx');
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at ${filePath}`);
    }
    
    console.log(`📖 Reading Excel file (${fs.statSync(filePath).size} bytes)...`);
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    // 4. Send POST request to API
    console.log('📤 Sending import request to API. This may take a few minutes...');
    const port = process.env.PORT || 3000;
    const response = await axios.post(`http://127.0.0.1:${port}/api/leaves/import`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 300000 // 5 minutes timeout for mass import
    });

    console.log('\n✅ Import API Response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

runMassImport();
