/**
 * Verify employee 6035 (or 06035) appears in "employees without user" list.
 * Run: TEST_EMAIL=admin@example.com TEST_PASSWORD=yourpass node tests/verify-employee-6035-without-user.js
 * Or ensure server is running and set REACT_APP_API_URL if different from http://localhost:5001/api
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

const API_URL = process.env.REACT_APP_API_URL || process.env.TEST_API_URL || 'http://localhost:5001/api';
const TARGET_EMPLOYEE_CODE = '6035';

let authToken = null;
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

async function login() {
  const email = process.env.TEST_EMAIL || process.env.EMAIL_USER;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    console.error('Set TEST_EMAIL and TEST_PASSWORD (e.g. admin credentials)');
    process.exit(1);
  }
  const res = await axios.post(`${API_URL}/auth/login`, { email, password });
  if (!res.data?.success || !res.data?.data?.token) {
    console.error('Login failed:', res.data?.message || 'No token');
    process.exit(1);
  }
  authToken = res.data.data.token;
  console.log('Logged in as', email);
}

async function run() {
  console.log('API URL:', API_URL);
  console.log('Target employee code:', TARGET_EMPLOYEE_CODE);
  await login();

  const res = await api.get('/hr/employees', {
    params: { getAll: 'true', withoutUser: 'true' }
  });
  const data = res.data?.data;
  const list = Array.isArray(data) ? data : (data && data.employees) ? data.employees : [];
  console.log('Employees without user count:', list.length);

  const match = list.find(emp => {
    const id = (emp.employeeId || '').toString().replace(/^0+/, '') || emp.employeeId;
    return id === TARGET_EMPLOYEE_CODE || (emp.employeeId || '').toString().includes(TARGET_EMPLOYEE_CODE);
  });
  if (match) {
    console.log('SUCCESS: Employee', TARGET_EMPLOYEE_CODE, 'is in the list:', match.firstName, match.lastName, match.employeeId);
  } else {
    console.log('NOT FOUND: No employee with code', TARGET_EMPLOYEE_CODE, 'in the list.');
    const sample = list.slice(0, 5).map(e => ({ employeeId: e.employeeId, name: `${e.firstName} ${e.lastName}` }));
    console.log('Sample employee IDs in list:', sample);
  }
}

run().catch(err => {
  console.error('Error:', err.response?.data || err.message);
  process.exit(1);
});
