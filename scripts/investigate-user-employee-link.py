import paramiko

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"
REPO = "/var/www/sgc-erp"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

script = """
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Employee = require('./server/models/hr/Employee');
  const User = require('./server/models/User');

  // Sample 3 employees to see their fields
  const emps = await Employee.find({ phone: { $ne: null, $ne: '' } }).limit(3).select('email phone firstName lastName employeeId').lean();
  console.log('SAMPLE EMPLOYEES:', JSON.stringify(emps, null, 2));

  // Sample 3 users
  const users = await User.find({}).limit(3).select('email phone firstName lastName employeeId').lean();
  console.log('SAMPLE USERS:', JSON.stringify(users, null, 2));

  // Check if any user has employeeId field
  const usersWithEmpId = await User.countDocuments({ employeeId: { $exists: true, $ne: null } });
  console.log('Users with employeeId:', usersWithEmpId);

  await mongoose.disconnect();
});
"""

cmd = f"cd {REPO} && node -e \"{script.replace(chr(34), chr(39)).replace(chr(10), ' ')}\""
# Better: write to a temp file
import tempfile
stdin, stdout, stderr = ssh.exec_command(f"cd {REPO} && NODE_ENV=production node -e 'require(\"dotenv\").config(); const mongoose = require(\"mongoose\"); mongoose.connect(process.env.MONGODB_URI).then(async()=>{{const E=mongoose.model(\"Employee\",new mongoose.Schema({{email:String,phone:String,firstName:String,lastName:String}},{{strict:false}}),\"employees\"); const U=mongoose.model(\"User\",new mongoose.Schema({{email:String,phone:String,firstName:String,employeeId:String}},{{strict:false}}),\"users\"); const e=await E.findOne({{phone:{{$ne:null,$ne:\"\"}}}}).lean(); console.log(\"EMP:\",JSON.stringify(e,null,2)); const u=await U.findOne().lean(); console.log(\"USER:\",JSON.stringify(Object.keys(u))); await mongoose.disconnect(); }}) 2>&1'")
out = stdout.read().decode()
print(out)
ssh.close()
