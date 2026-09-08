const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Indent = require('../models/general/Indent');
const PurchaseOrder = require('../models/procurement/PurchaseOrder');

async function debugFulfillment() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  
  // Find an indent that is Partially Fulfilled
  const indent = await Indent.findOne({ status: 'Partially Fulfilled' }).sort({ createdAt: -1 });
  if (!indent) {
    console.log("No Partially Fulfilled indent found.");
    process.exit(0);
  }
  
  console.log(`Analyzing Indent: ${indent.indentNumber}`);
  console.log('Indent Items:');
  indent.items.forEach(i => {
    console.log(` - ${i.itemName}: ${i.quantity}`);
  });

  const pos = await PurchaseOrder.find({
    indent: indent._id,
    status: { $nin: ['Cancelled', 'Rejected'] }
  });
  
  console.log(`Found ${pos.length} active POs.`);
  const orderedQuantities = {};
  pos.forEach(po => {
    po.items.forEach(item => {
      const desc = (item.description || '').trim().toLowerCase();
      if (!orderedQuantities[desc]) orderedQuantities[desc] = 0;
      orderedQuantities[desc] += item.quantity;
      console.log(` PO Item: ${item.description} (qty: ${item.quantity}) -> mapped to '${desc}'`);
    });
  });
  
  console.log('Ordered Quantities Map:', orderedQuantities);
  
  let allFulfilled = true;
  let anyFulfilled = false;

  indent.items.forEach(item => {
    const desc = (item.itemName || '').trim().toLowerCase();
    const orderedQty = orderedQuantities[desc] || 0;
    
    console.log(`Checking Indent Item: '${item.itemName}' (mapped to '${desc}'). Required: ${item.quantity}, Ordered: ${orderedQty}`);

    if (orderedQty >= item.quantity) {
      anyFulfilled = true;
    } else {
      allFulfilled = false;
      if (orderedQty > 0) anyFulfilled = true;
      console.log(` -> Failed allFulfilled constraint on '${item.itemName}'`);
    }
  });

  console.log(`Result: anyFulfilled=${anyFulfilled}, allFulfilled=${allFulfilled}`);
  process.exit(0);
}

debugFulfillment();
