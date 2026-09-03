import paramiko

HOST = "68.183.215.177"
USER = "root"
PASS = "sardar1Sahab"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

script = """
require('dotenv').config();
const axios = require('axios');
(async () => {
  const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const GRAPH_URL = `https://graph.facebook.com/v24.0/${WA_PHONE_ID}/messages`;
  console.log('Sending discount template to', GRAPH_URL);
  try {
    const res = await axios.post(GRAPH_URL, {
      messaging_product: 'whatsapp',
      to: '923214554035',
      type: 'template',
      template: {
        name: 'taj_discount_on_installments',
        language: { code: 'en' },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: { link: 'https://itihaasbuilders.com/images/marketing/image.jpeg' }
              }
            ]
          }
        ]
      }
    }, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` }
    });
    console.log('API RESPONSE OK:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log('API ERROR:', err.response?.data || err.message);
  }
})();
"""
stdin, stdout, stderr = ssh.exec_command(f"cd /var/www/sgc-erp && NODE_ENV=production node -e \"{script.replace(chr(34), chr(39)).replace(chr(10), ' ')}\"")
print(stdout.read().decode())
if stderr.read().decode():
    print('ERR:', stderr.read().decode())
ssh.close()
