'use strict';
const https = require('https');
const IDS = ['69ef23810733f55daca19df9','69ef23830733f55daca19e1c','69ef23860733f55daca19e81','69ef23890733f55daca19ea6'];
const BASE = process.env.BASE_URL || 'https://68.183.215.177';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bs = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: new URL(BASE).hostname,
      port: 443, path, method,
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json', 'Accept': 'application/json',
        ...(bs    && { 'Content-Length': Buffer.byteLength(bs) }),
        ...(token && { Authorization: 'Bearer ' + token })
      }
    }, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve({s:res.statusCode,b:JSON.parse(d)});}catch{resolve({s:res.statusCode,b:d});} }); });
    r.on('error', reject);
    if (bs) r.write(bs);
    r.end();
  });
}

(async () => {
  const login = await req('POST','/api/auth/login',{email:'developer@tovus.net',password:'shehroze@tovus'});
  const token = login.b?.token || login.b?.data?.token;
  if (!token) { console.error('Login failed'); process.exit(1); }
  console.log('Logged in OK');
  for (const id of IDS) {
    const r = await req('DELETE', '/api/taj-utilities/invoices/'+id, null, token);
    console.log(r.s===200 ? 'DELETED' : 'FAIL   ', id, r.b?.message||'');
  }
  console.log('Done');
})();
