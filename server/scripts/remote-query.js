const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`node -e "
    const mongoose = require('mongoose');
    
    // Define minimal schemas to bypass strict model validation
    const glSchema = new mongoose.Schema({}, { strict: false, collection: 'generalledgers' });
    const GeneralLedger = mongoose.model('GeneralLedger', glSchema);
    const accountSchema = new mongoose.Schema({}, { strict: false, collection: 'accounts' });
    const Account = mongoose.model('Account', accountSchema);
    
    async function run() {
      try {
        await mongoose.connect('mongodb://127.0.0.1:27017/sgc_erp_v2');
        console.log('Connected to MongoDB');
        
        const gls = await GeneralLedger.find({}).lean();
        console.log('Checking ' + gls.length + ' GL entries...');
        
        let count = 0;
        for (const gl of gls) {
          if (!gl.account) continue;
          const acct = await Account.findById(gl.account).select('companyId').lean();
          if (acct && acct.companyId && String(acct.companyId) !== String(gl.companyId)) {
            console.log('GL ' + gl._id + ' wrong company. Expected: ' + acct.companyId + ', Found: ' + gl.companyId);
            await GeneralLedger.updateOne({ _id: gl._id }, { \\$set: { companyId: acct.companyId } });
            count++;
          }
        }
        
        console.log('Fixed ' + count + ' GL entries.');
      } catch (err) {
        console.error(err);
      } finally {
        mongoose.disconnect();
      }
    }
    run();
  "`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '68.183.215.177',
  port: 22,
  username: 'root',
  password: 'sardar1Sahab'
});
