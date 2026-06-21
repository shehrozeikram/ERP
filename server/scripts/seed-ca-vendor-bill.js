require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const CashApproval = require('../models/procurement/CashApproval');
const AccountsPayable = require('../models/finance/AccountsPayable');
const Supplier = require('../models/hr/Supplier');
const User = require('../models/User');

async function seedCashApprovalAndVendorBill() {
  try {
    await mongoose.connect(process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB.');

    // 1. Get a random user to be the creator
    const user = await User.findOne({ email: 'ceo@sgc.com' });
    if (!user) {
      throw new Error('User ceo@sgc.com not found in the database. Please seed users first.');
    }

    // 2. Get a vendor/supplier
    let vendor = await Supplier.findOne();
    if (!vendor) {
      console.log('No vendor found. Creating a dummy vendor...');
      vendor = await Supplier.create({
        name: 'Dummy Vendor ' + Date.now(),
        email: 'dummy@example.com'
      });
    }

    // 3. Create a Cash Approval in Pending Finance status
    const cashApproval = new CashApproval({
      originatingModule: 'procurement',
      purpose: 'Seeding Cash Approval for Vendor Bill Demo',
      vendor: vendor._id,
      status: 'Pending Finance',
      priority: 'Urgent',
      items: [{
        itemName: 'Demo Material',
        quantity: 10,
        unit: 'kg',
        unitPrice: 500,
        amount: 5000
      }],
      subtotal: 5000,
      totalAmount: 5000,
      createdBy: user._id
    });
    await cashApproval.save();
    console.log(`Created Cash Approval (Pending Finance): ${cashApproval.caNumber}`);

    // 4. Create an Accounts Payable (Vendor Bill) linked to the Cash Approval
    // Note: there isn't a direct CA reference type, but we can set referenceType to 'manual'
    // and note the CA in internalNotes.
    const vendorBill = new AccountsPayable({
      vendor: {
        name: vendor.name,
        email: vendor.email,
        vendorId: vendor._id
      },
      billNumber: `VB-DEMO-${Date.now()}`,
      billDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      subtotal: 5000,
      totalAmount: 5000,
      status: 'draft',
      department: 'procurement',
      referenceType: 'manual', // or generic if applicable
      internalNotes: `Linked to Cash Approval: ${cashApproval.caNumber}`,
      lineItems: [{
        description: 'Demo Material from Cash Approval',
        quantity: 10,
        unitPrice: 500
      }],
      createdBy: user._id
    });
    await vendorBill.save();
    console.log(`Created Vendor Bill (Draft): ${vendorBill.billNumber}`);

    console.log('\nSeed completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seedCashApprovalAndVendorBill();
