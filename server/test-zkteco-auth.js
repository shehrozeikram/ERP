const axios = require("axios");

async function testLogin(username, password) {
  try {
    console.log(`🔐 Testing login for: ${username}`);
    
    const res = await axios.post("http://182.180.96:85/api/v2/auth/login/", {
      username,
      password
    });

    console.log("✅ Login Success");
    console.log("Token:", res.data.data.token);
    console.log("Superuser:", res.data.data.is_superuser);
    console.log("Full response:", JSON.stringify(res.data, null, 2));
    
    return {
      success: true,
      token: res.data.data.token,
      isSuperuser: res.data.data.is_superuser,
      data: res.data.data
    };
  } catch (err) {
    console.error(`❌ Login failed for ${username}:`, err.response?.data || err.message);
    return {
      success: false,
      error: err.response?.data || err.message
    };
  }
}

async function testMultipleAccounts() {
  console.log("🧪 Testing multiple ZKTeco accounts...\n");
  
  const accounts = [
    { username: "adil.aamir", password: "Pak123456" },
    { username: "admin", password: "admin" },
    { username: "admin", password: "123456" },
    { username: "superuser", password: "admin" },
    { username: "administrator", password: "admin" }
  ];
  
  for (const account of accounts) {
    const result = await testLogin(account.username, account.password);
    if (result.success) {
      console.log(`🎉 Found working account: ${account.username}`);
      console.log(`🔑 Token: ${result.token}`);
      console.log(`👑 Superuser: ${result.isSuperuser}`);
      break;
    }
    console.log("---");
  }
}

// Run the test
testMultipleAccounts();
