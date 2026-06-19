/** Allowed HR company fields (code removed — legacy DB index dropped separately). */
const COMPANY_FIELDS = [
  'name',
  'type',
  'industry',
  'website',
  'contactInfo',
  'isActive',
  'establishedDate',
  'notes',
  'description'
];

const sanitizeCompanyPayload = (body = {}) => {
  const payload = {};
  COMPANY_FIELDS.forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key];
  });
  return payload;
};

module.exports = { sanitizeCompanyPayload, COMPANY_FIELDS };
