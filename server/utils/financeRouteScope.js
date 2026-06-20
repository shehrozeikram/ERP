const { resolveCompanyForFinanceRoute, companyQuery, normalizeCompanyId } = require('./financeCompanyContext');
const { withCompany } = require('./financePosting');

/** Resolve company + reusable query helpers for /finance routes. */
async function financeScope(req) {
  const company = await resolveCompanyForFinanceRoute(req);
  const companyId = company._id;
  return {
    company,
    companyId,
    q: (filters = {}) => companyQuery(filters, company),
    jeMatch: (extra = {}) => ({ ...extra, companyId }),
    withCo: (payload) => withCompany(payload, companyId)
  };
}

/** Block cross-company access on detail routes. */
function assertDocCompany(doc, companyId, label = 'Record') {
  if (!doc || !companyId) return;
  const docCid = normalizeCompanyId(doc.companyId);
  if (docCid && String(docCid) !== String(companyId)) {
    const err = new Error(`${label} belongs to another finance company`);
    err.statusCode = 403;
    throw err;
  }
}

/** Load one document scoped to the request finance company (404/403). */
async function loadScopedDoc(Model, req, filter, label = 'Record') {
  const scope = await financeScope(req);
  const doc = await Model.findOne(scope.q(filter));
  if (!doc) {
    const err = new Error(`${label} not found`);
    err.statusCode = 404;
    throw err;
  }
  assertDocCompany(doc, scope.companyId, label);
  return { ...scope, doc };
}

module.exports = { financeScope, assertDocCompany, loadScopedDoc };
