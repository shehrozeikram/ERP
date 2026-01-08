require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
const User = require('../models/User');
const Electricity = require('../models/tajResidencia/Electricity');

async function deleteCAMInvoices() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Find user by name (case-insensitive)
    const user = await User.findOne({
      $or: [
        {
          firstName: { $regex: /^sardar$/i },
          lastName: { $regex: /^umer\s*tanveer$/i }
        },
        {
          firstName: { $regex: /^sardar\s*umer$/i },
          lastName: { $regex: /^tanveer$/i }
        },
        {
          firstName: { $regex: /^sardar$/i },
          lastName: { $regex: /^umer$/i }
        }
      ]
    });

    if (!user) {
      console.error('❌ User "sardar umer tanveer" not found');
      console.log('Available users with similar names:');
      const similarUsers = await User.find({
        $or: [
          { firstName: { $regex: /sardar/i } },
          { firstName: { $regex: /umer/i } },
          { lastName: { $regex: /tanveer/i } }
        ]
      }).select('firstName lastName email');
      similarUsers.forEach(u => {
        console.log(`  - ${u.firstName} ${u.lastName} (${u.email})`);
      });
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`   User ID: ${user._id}`);

    console.log('\n🔍 Searching for CAM invoices...');
    console.log(`   Created by: ${user.firstName} ${user.lastName}`);
    console.log(`   Filter: All CAM invoices (no date restriction)`);

    // First, let's check total invoices by this user
    const totalInvoices = await PropertyInvoice.countDocuments({ createdBy: user._id });
    console.log(`   Total invoices by this user: ${totalInvoices}`);
    
    const totalCAMInvoices = await PropertyInvoice.countDocuments({ 
      chargeTypes: { $in: ['CAM'] },
      createdBy: user._id 
    });
    console.log(`   Total CAM invoices by this user: ${totalCAMInvoices}`);

    // Find all CAM invoices created by this user (no date restriction)
    const invoices = await PropertyInvoice.find({
      chargeTypes: { $in: ['CAM'] },
      createdBy: user._id
    })
    .populate('electricityBill')
    .sort({ createdAt: -1 }); // Sort by creation date descending (newest first)

    if (invoices.length === 0) {
      console.log('\n⚠️  No invoices found matching the criteria');
      process.exit(0);
    }

    console.log(`\n📋 Found ${invoices.length} invoices to delete:`);
    invoices.forEach((inv, index) => {
      const periodFrom = inv.periodFrom ? new Date(inv.periodFrom).toISOString().split('T')[0] : 'N/A';
      const periodTo = inv.periodTo ? new Date(inv.periodTo).toISOString().split('T')[0] : 'N/A';
      const createdAt = inv.createdAt ? new Date(inv.createdAt).toISOString().split('T')[0] : 'N/A';
      console.log(`   ${index + 1}. ${inv.invoiceNumber} - Period: ${periodFrom} to ${periodTo} - Created: ${createdAt}`);
    });

    // Confirm deletion
    console.log(`\n⚠️  WARNING: This will delete ${invoices.length} invoices!`);
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    let deletedCount = 0;
    let errorCount = 0;

    console.log('\n🗑️  Deleting invoices...');

    for (const invoice of invoices) {
      try {
        // If invoice has ELECTRICITY charge type and references an electricity bill, delete it
        if (invoice.chargeTypes?.includes('ELECTRICITY') && invoice.electricityBill) {
          const electricityBillId = invoice.electricityBill._id || invoice.electricityBill;
          await Electricity.findByIdAndDelete(electricityBillId);
          console.log(`   ✅ Deleted associated electricity bill: ${electricityBillId}`);
        }

        await PropertyInvoice.findByIdAndDelete(invoice._id);
        deletedCount++;
        console.log(`   ✅ Deleted invoice: ${invoice.invoiceNumber} (${deletedCount}/${invoices.length})`);
      } catch (err) {
        errorCount++;
        console.error(`   ❌ Error deleting invoice ${invoice.invoiceNumber}:`, err.message);
      }
    }

    console.log(`\n✅ Deletion complete!`);
    console.log(`   Deleted: ${deletedCount} invoices`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount} invoices`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the script
deleteCAMInvoices();
