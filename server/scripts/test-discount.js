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
