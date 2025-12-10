require('dotenv').config();
const mongoose = require('mongoose');

const Department = require('../models/hr/Department');
const Employee = require('../models/hr/Employee');
const Section = require('../models/hr/Section');
const Designation = require('../models/hr/Designation');
const Project = require('../models/hr/Project');
const Position = require('../models/hr/Position');
const DocumentMaster = require('../models/hr/DocumentMaster');
const EvaluationDocument = require('../models/hr/EvaluationDocument');
const DocumentMovement = require('../models/hr/DocumentMovement');
const JobPosting = require('../models/hr/JobPosting');
const TrainingProgram = require('../models/hr/TrainingProgram');
const StaffAssignment = require('../models/hr/StaffAssignment');
const LeavePolicy = require('../models/hr/LeavePolicy');
const Audit = require('../models/audit/Audit');
const AuditSchedule = require('../models/audit/AuditSchedule');
const Contact = require('../models/crm/Contact');
const Lead = require('../models/crm/Lead');

/**
 * Script to merge "Adminstration" department into "Administration"
 */

async function mergeDepartments() {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp';
  console.log('🚀 Connecting to database...');
  await mongoose.connect(dbUri);
  console.log('✅ Connected to database');

  try {
    // Find both departments
    const sourceDept = await Department.findOne({ name: /^Adminstration$/i });
    const targetDept = await Department.findOne({ name: /^Administration$/i });

    if (!sourceDept) {
      console.log('⚠️  Source department "Adminstration" not found');
      return;
    }

    if (!targetDept) {
      console.log('⚠️  Target department "Administration" not found. Renaming source department instead...');
      sourceDept.name = 'Administration';
      await sourceDept.save();
      console.log('✅ Renamed "Adminstration" to "Administration"');
      return;
    }

    console.log(`📋 Found source department: ${sourceDept.name} (${sourceDept._id})`);
    console.log(`📋 Found target department: ${targetDept.name} (${targetDept._id})`);

    const sourceId = sourceDept._id;
    const targetId = targetDept._id;

    // Track updates
    let updateCount = 0;

    // 1. Update Employees (placementDepartment and department)
    const employeePlacementUpdates = await Employee.updateMany(
      { placementDepartment: sourceId },
      { $set: { placementDepartment: targetId } }
    );
    const employeeDeptUpdates = await Employee.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    const employeeUpdateCount = employeePlacementUpdates.modifiedCount + employeeDeptUpdates.modifiedCount;
    console.log(`✓ Updated ${employeeUpdateCount} employee record(s)`);
    updateCount += employeeUpdateCount;

    // 2. Update Sections
    const sectionUpdates = await Section.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${sectionUpdates.modifiedCount} section(s)`);
    updateCount += sectionUpdates.modifiedCount;

    // 3. Update Designations
    const designationUpdates = await Designation.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${designationUpdates.modifiedCount} designation(s)`);
    updateCount += designationUpdates.modifiedCount;

    // 4. Update Projects
    const projectUpdates = await Project.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${projectUpdates.modifiedCount} project(s)`);
    updateCount += projectUpdates.modifiedCount;

    // 5. Update Positions
    const positionUpdates = await Position.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${positionUpdates.modifiedCount} position(s)`);
    updateCount += positionUpdates.modifiedCount;

    // 6. Update DocumentMaster
    const docMasterUpdates = await DocumentMaster.updateMany(
      { 'department': sourceId },
      { $set: { 'department': targetId } }
    );
    console.log(`✓ Updated ${docMasterUpdates.modifiedCount} document master(s)`);
    updateCount += docMasterUpdates.modifiedCount;

    // 7. Update EvaluationDocument
    const evalDocUpdates = await EvaluationDocument.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${evalDocUpdates.modifiedCount} evaluation document(s)`);
    updateCount += evalDocUpdates.modifiedCount;

    // 8. Update DocumentMovement (fromDepartment and toDepartment)
    const docMovementFromUpdates = await DocumentMovement.updateMany(
      { fromDepartment: sourceId },
      { $set: { fromDepartment: targetId } }
    );
    const docMovementToUpdates = await DocumentMovement.updateMany(
      { toDepartment: sourceId },
      { $set: { toDepartment: targetId } }
    );
    const docMovementUpdateCount = docMovementFromUpdates.modifiedCount + docMovementToUpdates.modifiedCount;
    console.log(`✓ Updated ${docMovementUpdateCount} document movement(s)`);
    updateCount += docMovementUpdateCount;

    // 9. Update JobPosting
    const jobPostingUpdates = await JobPosting.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${jobPostingUpdates.modifiedCount} job posting(s)`);
    updateCount += jobPostingUpdates.modifiedCount;

    // 10. Update TrainingProgram
    const trainingUpdates = await TrainingProgram.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${trainingUpdates.modifiedCount} training program(s)`);
    updateCount += trainingUpdates.modifiedCount;

    // 11. Update StaffAssignment
    const staffAssignmentUpdates = await StaffAssignment.updateMany(
      { departmentId: sourceId },
      { $set: { departmentId: targetId } }
    );
    console.log(`✓ Updated ${staffAssignmentUpdates.modifiedCount} staff assignment(s)`);
    updateCount += staffAssignmentUpdates.modifiedCount;

    // 12. Update LeavePolicy
    const leavePolicyUpdates = await LeavePolicy.updateMany(
      { 'department': sourceId },
      { $set: { 'department': targetId } }
    );
    console.log(`✓ Updated ${leavePolicyUpdates.modifiedCount} leave policy/policies`);
    updateCount += leavePolicyUpdates.modifiedCount;

    // 13. Update Audit
    const auditUpdates = await Audit.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${auditUpdates.modifiedCount} audit record(s)`);
    updateCount += auditUpdates.modifiedCount;

    // 14. Update AuditSchedule
    const auditScheduleUpdates = await AuditSchedule.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${auditScheduleUpdates.modifiedCount} audit schedule(s)`);
    updateCount += auditScheduleUpdates.modifiedCount;

    // 15. Update Contact
    const contactUpdates = await Contact.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${contactUpdates.modifiedCount} contact(s)`);
    updateCount += contactUpdates.modifiedCount;

    // 16. Update Lead
    const leadUpdates = await Lead.updateMany(
      { department: sourceId },
      { $set: { department: targetId } }
    );
    console.log(`✓ Updated ${leadUpdates.modifiedCount} lead(s)`);
    updateCount += leadUpdates.modifiedCount;

    // 17. Update Department parentDepartment references
    const parentDeptUpdates = await Department.updateMany(
      { parentDepartment: sourceId },
      { $set: { parentDepartment: targetId } }
    );
    console.log(`✓ Updated ${parentDeptUpdates.modifiedCount} department parent reference(s)`);
    updateCount += parentDeptUpdates.modifiedCount;

    // 18. Update Department manager if source department is set as manager
    // (This is less common, but handle it if needed)

    // 19. Delete the source department
    await Department.findByIdAndDelete(sourceId);
    console.log(`✓ Deleted source department "Adminstration"`);

    console.log('\n📊 Summary:');
    console.log(`  Total records updated: ${updateCount}`);
    console.log(`  Source department deleted: Adminstration`);
    console.log(`  Target department kept: Administration`);

    console.log('\n✅ Merge completed successfully!');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the script
mergeDepartments()
  .then(() => {
    console.log('✨ Script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });

