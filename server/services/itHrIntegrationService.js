const Employee = require('../models/hr/Employee');
const ITAsset = require('../models/it/ITAsset');
const AssetAssignment = require('../models/it/AssetAssignment');
const SoftwareInventory = require('../models/it/SoftwareInventory');
const LicenseAssignment = require('../models/it/LicenseAssignment');

class ITHrIntegrationService {
  
  /**
   * Assign IT asset to employee with HR integration
   */
  static async assignAssetToEmployee(assetId, employeeId, assignedBy, assignmentData) {
    try {
      // Validate asset exists and is available
      const asset = await ITAsset.findById(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }
      
      if (asset.assignedTo.employee) {
        throw new Error('Asset is already assigned to another employee');
      }

      // Validate employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Create asset assignment record
      const assignment = new AssetAssignment({
        asset: assetId,
        employee: employeeId,
        assignedBy: assignedBy,
        ...assignmentData
      });

      await assignment.save();

      // Update asset assignment
      await ITAsset.findByIdAndUpdate(assetId, {
        'assignedTo.employee': employeeId,
        'assignedTo.assignedDate': new Date(),
        'assignedTo.assignedBy': assignedBy,
        'assignedTo.notes': assignmentData.notes
      });

      // Update employee's assigned assets
      await employee.assignAsset(assetId, assignedBy, assignmentData);

      // Populate and return the assignment
      const populatedAssignment = await AssetAssignment.findById(assignment._id)
        .populate('asset', 'assetTag assetName category brand model')
        .populate('employee', 'firstName lastName employeeId department')
        .populate('assignedBy', 'firstName lastName');

      return {
        success: true,
        data: populatedAssignment,
        message: 'Asset assigned successfully to employee'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Return asset from employee with HR integration
   */
  static async returnAssetFromEmployee(assetId, employeeId, returnedBy, returnData) {
    try {
      // Find active assignment
      const assignment = await AssetAssignment.findOne({
        asset: assetId,
        employee: employeeId,
        status: 'Active'
      });

      if (!assignment) {
        throw new Error('No active assignment found for this asset and employee');
      }

      // Update assignment
      assignment.status = 'Returned';
      assignment.actualReturnDate = new Date();
      assignment.returnedBy = returnedBy;
      Object.assign(assignment, returnData);
      await assignment.save();

      // Update asset
      await ITAsset.findByIdAndUpdate(assetId, {
        'assignedTo.employee': null,
        'assignedTo.assignedDate': null,
        'assignedTo.assignedBy': null,
        'assignedTo.returnDate': new Date(),
        'assignedTo.notes': returnData.notes,
        condition: returnData.conditionAtReturn
      });

      // Update employee's asset record
      const employee = await Employee.findById(employeeId);
      if (employee) {
        await employee.returnAsset(assetId, returnData);
      }

      // Populate and return the assignment
      const populatedAssignment = await AssetAssignment.findById(assignment._id)
        .populate('asset', 'assetTag assetName category brand model')
        .populate('employee', 'firstName lastName employeeId')
        .populate('assignedBy', 'firstName lastName');

      return {
        success: true,
        data: populatedAssignment,
        message: 'Asset returned successfully from employee'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Assign software license to employee with HR integration
   */
  static async assignLicenseToEmployee(softwareId, employeeId, assignedBy, assignmentData) {
    try {
      // Validate software exists and has available licenses
      const software = await SoftwareInventory.findById(softwareId);
      if (!software) {
        throw new Error('Software not found');
      }

      if (software.licenseCount.used >= software.licenseCount.total) {
        throw new Error('No available licenses for this software');
      }

      // Validate employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Check if employee already has this license
      const existingAssignment = await LicenseAssignment.findOne({
        software: softwareId,
        employee: employeeId,
        status: 'Active'
      });

      if (existingAssignment) {
        throw new Error('Employee already has an active license for this software');
      }

      // Create license assignment record
      const assignment = new LicenseAssignment({
        software: softwareId,
        employee: employeeId,
        assignedBy: assignedBy,
        ...assignmentData
      });

      await assignment.save();

      // Update software license count
      await SoftwareInventory.findByIdAndUpdate(softwareId, {
        $inc: { 'licenseCount.used': 1 },
        $set: { 'licenseCount.available': software.licenseCount.total - (software.licenseCount.used + 1) }
      });

      // Update employee's assigned licenses
      await employee.assignLicense(softwareId, assignedBy, assignmentData);

      // Populate and return the assignment
      const populatedAssignment = await LicenseAssignment.findById(assignment._id)
        .populate('software', 'softwareName version category')
        .populate('employee', 'firstName lastName employeeId')
        .populate('assignedBy', 'firstName lastName');

      return {
        success: true,
        data: populatedAssignment,
        message: 'Software license assigned successfully to employee'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Revoke software license from employee with HR integration
   */
  static async revokeLicenseFromEmployee(softwareId, employeeId, revokedBy, revocationData) {
    try {
      // Find active license assignment
      const assignment = await LicenseAssignment.findOne({
        software: softwareId,
        employee: employeeId,
        status: 'Active'
      });

      if (!assignment) {
        throw new Error('No active license assignment found for this software and employee');
      }

      // Update assignment
      assignment.status = 'Revoked';
      assignment.revokedDate = new Date();
      assignment.revokedBy = revokedBy;
      Object.assign(assignment, revocationData);
      await assignment.save();

      // Update software license count
      await SoftwareInventory.findByIdAndUpdate(softwareId, {
        $inc: { 'licenseCount.used': -1 },
        $set: { 'licenseCount.available': software.licenseCount.total - (software.licenseCount.used - 1) }
      });

      // Update employee's license record
      const employee = await Employee.findById(employeeId);
      if (employee) {
        await employee.revokeLicense(softwareId, revocationData);
      }

      // Populate and return the assignment
      const populatedAssignment = await LicenseAssignment.findById(assignment._id)
        .populate('software', 'softwareName version category')
        .populate('employee', 'firstName lastName employeeId')
        .populate('assignedBy', 'firstName lastName');

      return {
        success: true,
        data: populatedAssignment,
        message: 'Software license revoked successfully from employee'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get employee's IT assets and licenses
   */
  static async getEmployeeITAssets(employeeId) {
    try {
      const employee = await Employee.findById(employeeId)
        .populate('assignedAssets.asset', 'assetTag assetName category brand model serialNumber')
        .populate('assignedAssets.assignedBy', 'firstName lastName')
        .populate('assignedLicenses.software', 'softwareName version category licenseType')
        .populate('assignedLicenses.assignedBy', 'firstName lastName');

      if (!employee) {
        throw new Error('Employee not found');
      }

      const activeAssets = employee.getActiveAssets();
      const activeLicenses = employee.getActiveLicenses();

      return {
        success: true,
        data: {
          employee: {
            _id: employee._id,
            employeeId: employee.employeeId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            department: employee.department
          },
          activeAssets,
          activeLicenses,
          assetHistory: employee.assignedAssets,
          licenseHistory: employee.assignedLicenses
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get department's IT assets and licenses
   */
  static async getDepartmentITAssets(departmentId) {
    try {
      const employees = await Employee.find({ 
        department: departmentId,
        isActive: true 
      })
        .populate('assignedAssets.asset', 'assetTag assetName category brand model')
        .populate('assignedLicenses.software', 'softwareName version category')
        .select('employeeId firstName lastName assignedAssets assignedLicenses');

      const departmentAssets = [];
      const departmentLicenses = [];

      employees.forEach(employee => {
        const activeAssets = employee.getActiveAssets();
        const activeLicenses = employee.getActiveLicenses();

        activeAssets.forEach(asset => {
          departmentAssets.push({
            ...asset.toObject(),
            assignedTo: {
              employeeId: employee.employeeId,
              employeeName: `${employee.firstName} ${employee.lastName}`
            }
          });
        });

        activeLicenses.forEach(license => {
          departmentLicenses.push({
            ...license.toObject(),
            assignedTo: {
              employeeId: employee.employeeId,
              employeeName: `${employee.firstName} ${employee.lastName}`
            }
          });
        });
      });

      return {
        success: true,
        data: {
          departmentId,
          totalEmployees: employees.length,
          totalAssets: departmentAssets.length,
          totalLicenses: departmentLicenses.length,
          assets: departmentAssets,
          licenses: departmentLicenses
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Transfer asset between employees
   */
  static async transferAsset(assetId, fromEmployeeId, toEmployeeId, transferredBy, transferData) {
    try {
      // First return asset from current employee
      const returnResult = await this.returnAssetFromEmployee(
        assetId, 
        fromEmployeeId, 
        transferredBy, 
        { 
          conditionAtReturn: transferData.conditionAtTransfer,
          notes: `Transferred to ${toEmployeeId}`,
          ...transferData
        }
      );

      if (!returnResult.success) {
        throw new Error(`Failed to return asset: ${returnResult.error}`);
      }

      // Then assign to new employee
      const assignResult = await this.assignAssetToEmployee(
        assetId,
        toEmployeeId,
        transferredBy,
        {
          assignmentReason: 'Transfer',
          conditionAtAssignment: transferData.conditionAtTransfer,
          notes: `Transferred from ${fromEmployeeId}`,
          ...transferData
        }
      );

      if (!assignResult.success) {
        throw new Error(`Failed to assign asset: ${assignResult.error}`);
      }

      return {
        success: true,
        data: {
          returnRecord: returnResult.data,
          assignmentRecord: assignResult.data
        },
        message: 'Asset transferred successfully between employees'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ITHrIntegrationService;
