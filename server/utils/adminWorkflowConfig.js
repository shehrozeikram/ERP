/**
 * Admin Workflow Configuration
 * Defines which admin submodules support workflow and their model/API details
 */

const ADMIN_WORKFLOW_MODULES = {
  payment_settlement: {
    name: 'Payment Settlement',
    modelPath: '../models/hr/PaymentSettlement',
    collection: 'paymentsettlements',
    apiPath: '/api/payment-settlements',
    workflowStatusField: 'workflowStatus',
    titleField: 'referenceNumber',
    descriptionField: 'toWhomPaid',
    amountField: 'grandTotal',
    dateField: 'date',
    routePath: '/admin/payment-settlement',
    icon: 'Payment'
  }
  // Future submodules can be added here:
  // rental_agreements: {
  //   name: 'Rental Agreements',
  //   modelPath: '../models/hr/RentalAgreement',
  //   workflowStatusField: 'workflowStatus',
  //   titleField: 'agreementNumber',
  //   descriptionField: 'propertyName',
  //   routePath: '/admin/rental-agreements',
  //   icon: 'Business'
  // },
  // utility_bills_management: { ... },
  // etc.
};

// Get all workflow-enabled submodules
const getWorkflowModules = () => {
  return Object.keys(ADMIN_WORKFLOW_MODULES);
};

// Get module configuration
const getModuleConfig = (submodule) => {
  return ADMIN_WORKFLOW_MODULES[submodule];
};

// Check if a submodule supports workflow
const supportsWorkflow = (submodule) => {
  return ADMIN_WORKFLOW_MODULES.hasOwnProperty(submodule);
};

module.exports = {
  ADMIN_WORKFLOW_MODULES,
  getWorkflowModules,
  getModuleConfig,
  supportsWorkflow
};

