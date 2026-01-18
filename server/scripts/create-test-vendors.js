const mongoose = require('mongoose');
require('dotenv').config();
const Supplier = require('../models/hr/Supplier');
const User = require('../models/User');

const testVendors = [
  {
    name: 'Tech Solutions Ltd',
    contactPerson: 'Ahmed Khan',
    phone: '+92-300-1234567',
    email: 'ahmed.khan@techsolutions.pk',
    address: '123 Main Street, Karachi, Pakistan',
    paymentTerms: 'Credit 30 days',
    status: 'Active',
    notes: 'Primary IT equipment supplier'
  },
  {
    name: 'Office Supplies Co',
    contactPerson: 'Fatima Ali',
    phone: '+92-321-2345678',
    email: 'fatima.ali@officesupplies.pk',
    address: '456 Business Avenue, Lahore, Pakistan',
    paymentTerms: 'Credit 15 days',
    status: 'Active',
    notes: 'Stationery and office supplies'
  },
  {
    name: 'Furniture World',
    contactPerson: 'Hassan Malik',
    phone: '+92-333-3456789',
    email: 'hassan.malik@furnitureworld.pk',
    address: '789 Industrial Road, Islamabad, Pakistan',
    paymentTerms: 'Credit 30 days',
    status: 'Active',
    notes: 'Office furniture and fixtures'
  },
  {
    name: 'Maintenance Services Inc',
    contactPerson: 'Sara Ahmed',
    phone: '+92-344-4567890',
    email: 'sara.ahmed@maintenance.pk',
    address: '321 Service Lane, Faisalabad, Pakistan',
    paymentTerms: 'Cash',
    status: 'Active',
    notes: 'Building maintenance and repairs'
  },
  {
    name: 'Raw Materials Supplier',
    contactPerson: 'Usman Sheikh',
    phone: '+92-355-5678901',
    email: 'usman.sheikh@rawmaterials.pk',
    address: '654 Warehouse Street, Multan, Pakistan',
    paymentTerms: 'Credit 7 days',
    status: 'Active',
    notes: 'Industrial raw materials'
  }
];

async function createTestVendors() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Get a system user or create one for createdBy
    let systemUser = await User.findOne({ role: 'super_admin' });
    if (!systemUser) {
      systemUser = await User.findOne();
    }

    const createdVendors = [];
    
    for (const vendorData of testVendors) {
      // Check if vendor already exists
      const existingVendor = await Supplier.findOne({ 
        $or: [
          { email: vendorData.email },
          { name: vendorData.name }
        ]
      });

      if (existingVendor) {
        console.log(`⏭️  Vendor "${vendorData.name}" already exists, skipping...`);
        continue;
      }

      // Generate supplierId
      const lastSupplier = await Supplier.findOne().sort({ supplierId: -1 });
      let newSupplierId = 'SUP-0001';
      
      if (lastSupplier && lastSupplier.supplierId) {
        const lastNum = parseInt(lastSupplier.supplierId.split('-')[1]);
        newSupplierId = `SUP-${String(lastNum + 1).padStart(4, '0')}`;
      }

      const vendor = new Supplier({
        ...vendorData,
        supplierId: newSupplierId,
        createdBy: systemUser ? systemUser._id : null
      });

      await vendor.save();
      createdVendors.push(vendor);
      console.log(`✅ Created vendor: ${vendor.name} (${vendor.supplierId})`);
    }

    console.log(`\n✅ Successfully created ${createdVendors.length} test vendors`);
    console.log('Vendors created:');
    createdVendors.forEach(v => {
      console.log(`  - ${v.name} (${v.supplierId}) - ${v.email}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test vendors:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

createTestVendors();
