const {
  activeAmount,
  vehicleAllowanceAmount,
  fuelAllowanceAmount
} = require('./allowanceHelpers');

const extractPayrollBreakdown = (payroll = {}) => {
  const allowances = payroll.allowances || {};
  const houseFlexible = activeAmount(allowances.houseRent);
  const houseCore = Number(payroll.houseRentAllowance) || 0;
  const medicalFlexible = activeAmount(allowances.medical);
  const medicalCore = Number(payroll.medicalAllowance) || 0;

  return {
    standardGrossSalary: Math.round(Number(payroll.grossSalary) || 0),
    basic: Math.round(Number(payroll.basicSalary) || 0),
    arrears: Math.round(Number(payroll.arrears) || 0),
    conveyanceAllowance: Math.round(activeAmount(allowances.conveyance)),
    houseAllowance: Math.round(houseCore + houseFlexible),
    foodAllowance: Math.round(activeAmount(allowances.food)),
    vehicleAllowance: Math.round(vehicleAllowanceAmount(allowances)),
    medicalAllowance: Math.round(medicalCore + medicalFlexible),
    fuelAllowance: Math.round(fuelAllowanceAmount(allowances)),
    grossSalary: Math.round(Number(payroll.totalEarnings) || Number(payroll.grossSalary) || 0),
    incomeTax: Math.round(Number(payroll.incomeTax) || 0),
    companyLoan: Math.round(Number(payroll.companyLoanDeduction) || Number(payroll.loanDeductions) || 0),
    eobiDeduction: Math.round(Number(payroll.eobi) || 0),
    empSecurityDed: Math.round(Number(payroll.providentFund) || 0),
    netPayable: Math.round(Number(payroll.netSalary) || 0)
  };
};

module.exports = {
  extractPayrollBreakdown
};
