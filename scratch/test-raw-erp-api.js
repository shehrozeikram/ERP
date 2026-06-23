const axios = require('axios');

async function test(orderCode) {
  try {
    const response = await axios.post(
      'http://erp.taj-residencia.com/api/v1/db/default.aspx',
      {
        db: 'IERP',
        procedure: 'SP_RPT_CustomerAccountStatement',
        isWrite: false,
        parameters: { OrderCode: parseInt(orderCode, 10) }
      },
      {
        headers: {
          'X-API-Key': 'tovus_sec_key_2026_dfdsalsdfjhf23423h324h234kj234lkjhH434',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    console.log(`OrderCode: ${orderCode}`);
    console.log(JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
  } catch (err) {
    console.error(`OrderCode: ${orderCode} - Error:`, err.message);
    if (err.response) {
      console.error('Data:', err.response.data);
    }
  }
}

async function run() {
  await test('119586');
  await test('116363');
  await test('119533');
}

run();
