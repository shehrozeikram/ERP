const { serializeTransferPayments } = require('../client/src/components/TajResidencia/LandTransferPaymentsPanel');

console.log("Without status:");
console.log(serializeTransferPayments([{ paymentType: 'Fee', amount: 5000 }]));

console.log("With status Pending:");
console.log(serializeTransferPayments([{ paymentType: 'Fee', amount: 5000, status: 'Pending' }]));

console.log("With status Paid:");
console.log(serializeTransferPayments([{ paymentType: 'Fee', amount: 5000, status: 'Paid' }]));
