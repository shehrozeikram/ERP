import paramiko, os

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

script = """
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = require('./server/models/User');
  const { notifyApprovers } = require('./server/utils/approvalWhatsAppNotifier');

  // get Shehroze
  const user = await User.findOne({ phone: '03214554035' });
  console.log('User found:', !!user, user?._id);
  if(user) {
    console.log('Sending WA...');
    await notifyApprovers([user._id], { docType: 'TEST', docNumber: '123' });
    console.log('Sent WA function done.');
  }

  await mongoose.disconnect();
}).catch(console.error);
"""

stdin, stdout, stderr = ssh.exec_command(f"cd /var/www/sgc-erp && NODE_ENV=production node -e \"{script.replace(chr(34), chr(39)).replace(chr(10), ' ')}\"")
print(stdout.read().decode())
if stderr.read().decode():
    print('ERR:', stderr.read().decode())
ssh.close()
