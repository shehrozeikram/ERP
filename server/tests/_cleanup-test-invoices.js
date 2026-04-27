'use strict';
const http = require('http');

const IDS = [
  '69ef1548e699891cd5b5b03d','69ef1548e699891cd5b5b061','69ef1548e699891cd5b5b084',
  '69ef1548e699891cd5b5b0a8','69ef1548e699891cd5b5b0cc','69ef1548e699891cd5b5b0ef',
  '69ef1548e699891cd5b5b113','69ef1548e699891cd5b5b137','69ef1548e699891cd5b5b15a',
  '69ef1548e699891cd5b5b17e'
];

function req(method, path, body, token) {
  return new Promise((res, rej) => {
    const bs = body ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: 'localhost', port: 5001, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(bs    && { 'Content-Length': Buffer.byteLength(bs) }),
        ...(token && { Authorization: 'Bearer ' + token })
      }
    }, (response) => {
      let d = '';
      response.on('data', c => d += c);
      response.on('end', () => { try { res({ s: response.statusCode, b: JSON.parse(d) }); } catch { res({ s: response.statusCode, b: d }); } });
    });
    r.on('error', rej);
    if (bs) r.write(bs);
    r.end();
  });
}

(async () => {
  const login = await req('POST', '/api/auth/login', { email: 'developer@tovus.net', password: 'shehroze@tovus' });
  const token = login.b?.token || login.b?.data?.token;
  if (!token) { console.error('Login failed', login); process.exit(1); }
  console.log('Logged in OK');
  for (const id of IDS) {
    const r = await req('DELETE', '/api/taj-utilities/invoices/' + id, null, token);
    console.log(r.s === 200 ? 'DELETED' : 'FAIL   ', id, r.b?.message || '');
  }
  console.log('Done');
})();
