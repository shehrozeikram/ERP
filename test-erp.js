const { fetchStatementFromERP } = require('./server/utils/erpIntegration');
fetchStatementFromERP('116577').then(console.log).catch(console.error);
